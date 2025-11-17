#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR=${1:-build}
IMAGE_TAG=${IMAGE_TAG:-xcodereviewer:bundle}

echo "🔧 构建一体化镜像 ${IMAGE_TAG}"
docker build -t "${IMAGE_TAG}" .

mkdir -p "${BUILD_DIR}"
OUTPUT="${BUILD_DIR}/$(echo "${IMAGE_TAG}" | tr ':' '_').tar"

echo "💾 保存镜像到 ${OUTPUT}"
docker save "${IMAGE_TAG}" -o "${OUTPUT}"

echo "✅ 镜像打包完成，可以用 'docker load -i ${OUTPUT}' 在其他服务器导入"
