from __future__ import annotations

import argparse
import stat
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a reproducible Lambda ZIP from a package directory.")
    parser.add_argument("package_dir", type=Path)
    parser.add_argument("output_zip", type=Path)
    args = parser.parse_args()

    package_dir = args.package_dir.resolve()
    output_zip = args.output_zip.resolve()
    output_zip.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output_zip, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(path for path in package_dir.rglob("*") if path.is_file()):
            relative = source.relative_to(package_dir).as_posix()
            info = ZipInfo(relative, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = (stat.S_IMODE(source.stat().st_mode) & 0xFFFF) << 16
            archive.writestr(info, source.read_bytes(), compresslevel=9)


if __name__ == "__main__":
    main()
