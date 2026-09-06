#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${API_DIR}/build/lambda"
PACKAGE_DIR="${BUILD_DIR}/package"
ZIP_PATH="${BUILD_DIR}/survey-api-lambda.zip"
LAMBDA_IMAGE="public.ecr.aws/lambda/python:3.13"

rm -rf "${BUILD_DIR}"
mkdir -p "${PACKAGE_DIR}"

docker run --rm --platform linux/amd64 \
  --entrypoint /bin/bash \
  -v "${API_DIR}/requirements-lambda.txt:/tmp/requirements-lambda.txt:ro" \
  -v "${PACKAGE_DIR}:/asset-output" \
  "${LAMBDA_IMAGE}" \
  -lc 'python -m pip install --disable-pip-version-check --no-cache-dir --only-binary=:all: -r /tmp/requirements-lambda.txt --target /asset-output'

cp -R "${API_DIR}/app" "${PACKAGE_DIR}/app"
find "${PACKAGE_DIR}" -type d -name '__pycache__' -prune -exec rm -rf {} +
find "${PACKAGE_DIR}" -type f -name '*.pyc' -delete

docker run --rm --platform linux/amd64 \
  --entrypoint /bin/bash \
  -v "${BUILD_DIR}:/build" \
  -v "${SCRIPT_DIR}/create_lambda_zip.py:/tools/create_lambda_zip.py:ro" \
  "${LAMBDA_IMAGE}" \
  -lc 'python /tools/create_lambda_zip.py /build/package /build/survey-api-lambda.zip'

docker run --rm --platform linux/amd64 \
  --entrypoint /bin/bash \
  -v "${ZIP_PATH}:/artifact/survey-api-lambda.zip:ro" \
  -v "${SCRIPT_DIR}/verify_lambda_package.py:/tools/verify_lambda_package.py:ro" \
  "${LAMBDA_IMAGE}" \
  -lc 'python /tools/verify_lambda_package.py /artifact/survey-api-lambda.zip'

echo "artifact=${ZIP_PATH}"
