from __future__ import annotations

import argparse
import importlib.metadata
import importlib.util
import json
import os
import platform
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile


EXPECTED_MACHINE = 62  # ELF EM_X86_64
EXPECTED_RUNTIME_PACKAGES = (
    "fastapi",
    "mangum",
    "psycopg",
    "SQLAlchemy",
    "argon2-cffi",
    "pydantic",
    "pydantic-settings",
    "PyJWT",
    "httpx",
    "openpyxl",
)


class LambdaContext:
    aws_request_id = "phase3-package-smoke"

    def get_remaining_time_in_millis(self) -> int:
        return 30_000


def elf_machine(path: Path) -> int | None:
    header = path.read_bytes()[:20]
    if len(header) < 20 or header[:4] != b"\x7fELF":
        return None
    byteorder = "little" if header[5] == 1 else "big"
    return int.from_bytes(header[18:20], byteorder=byteorder)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify an unpacked Lambda ZIP in the target Linux runtime.")
    parser.add_argument("zip_path", type=Path)
    args = parser.parse_args()

    assert sys.version_info[:2] == (3, 13), sys.version
    assert platform.system() == "Linux", platform.system()
    assert platform.machine() == "x86_64", platform.machine()

    zip_path = args.zip_path.resolve()
    with ZipFile(zip_path) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert "app/handler.py" in names
        assert not any(name.endswith(".env") or "__pycache__" in name or name.endswith(".pyc") for name in names)
        uncompressed_bytes = sum(info.file_size for info in archive.infolist())
        file_count = len(archive.infolist())
        with tempfile.TemporaryDirectory(prefix="lambda-package-") as temp_dir:
            archive.extractall(temp_dir)
            root = Path(temp_dir)
            sys.path.insert(0, str(root))

            import argon2
            import fastapi
            import mangum
            import psycopg
            import sqlalchemy
            from argon2 import PasswordHasher
            from psycopg import pq
            from sqlalchemy.pool import NullPool

            from app.db import engine
            from app.handler import handler

            assert fastapi.FastAPI is not None
            assert mangum.Mangum is not None
            assert sqlalchemy.create_engine is not None
            assert psycopg.connect is not None
            assert argon2.PasswordHasher is not None
            assert pq.__impl__ == "binary"
            assert isinstance(engine.pool, NullPool)
            assert callable(handler)

            password_hasher = PasswordHasher()
            encoded = password_hasher.hash("phase3-native-smoke")
            assert password_hasher.verify(encoded, "phase3-native-smoke")

            native_extensions = sorted(root.rglob("*.so"))
            assert native_extensions
            invalid_native = [
                path.relative_to(root).as_posix()
                for path in native_extensions
                if elf_machine(path) != EXPECTED_MACHINE
            ]
            assert not invalid_native, f"non-x86_64 native extensions: {invalid_native}"

            for module_name in (
                "psycopg_binary.pq",
                "_argon2_cffi_bindings._ffi",
                "pydantic_core._pydantic_core",
            ):
                spec = importlib.util.find_spec(module_name)
                assert spec is not None and spec.origin and spec.origin.endswith(".so"), module_name

            dependency_versions = {
                package: importlib.metadata.version(package) for package in EXPECTED_RUNTIME_PACKAGES
            }

            event = {
                "resource": "/{proxy+}",
                "path": "/health",
                "httpMethod": "GET",
                "headers": {},
                "multiValueHeaders": {},
                "queryStringParameters": None,
                "multiValueQueryStringParameters": None,
                "pathParameters": {"proxy": "health"},
                "stageVariables": None,
                "requestContext": {
                    "resourcePath": "/{proxy+}",
                    "httpMethod": "GET",
                    "path": "/prod/health",
                    "stage": "prod",
                    "protocol": "HTTP/1.1",
                    "identity": {
                        "sourceIp": "127.0.0.1",
                        "userAgent": "phase3-package-smoke",
                    },
                },
                "body": None,
                "isBase64Encoded": False,
            }
            response = handler(event, LambdaContext())
            assert response["statusCode"] == 200
            assert json.loads(response["body"]) == {"status": "ok"}

    print("runtime=python3.13")
    print("platform=linux-x86_64")
    for package, version in dependency_versions.items():
        print(f"dependency={package}=={version}")
    print("psycopg_implementation=binary")
    print(f"native_extension_count={len(native_extensions)}")
    print("native_extensions_elf_x86_64=True")
    print("lambda_pool=NullPool")
    print("handler_import=True")
    print("handler_health_status=200")
    print(f"zip_file_count={file_count}")
    print(f"zip_bytes={zip_path.stat().st_size}")
    print(f"unzipped_bytes={uncompressed_bytes}")


if __name__ == "__main__":
    os.environ.setdefault("APP_RUNTIME", "lambda")
    os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://placeholder:placeholder@localhost/placeholder?sslmode=require")
    os.environ.setdefault("JWT_SECRET", "phase3-placeholder-secret-at-least-32-chars")
    os.environ.setdefault("CORS_ORIGINS", "https://example.invalid")
    os.environ.setdefault("LLM_ENABLED", "false")
    main()
