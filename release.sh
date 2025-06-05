#!/bin/bash

# 检查是否提供了标签参数
if [ -z "$1" ]; then
  echo "错误：请提供一个标签作为参数。"
  echo "用法: ./release.sh <tag_name>"
  exit 1
fi

TAG_NAME=$1

echo "正在创建并推送标签: $TAG_NAME"

# 检查 Git 状态，确保工作目录干净
if ! git diff-index --quiet HEAD --; then
  echo "错误：工作目录不干净。请先提交或暂存您的更改。"
  exit 1
fi

# 创建标签
git tag "$TAG_NAME"
if [ $? -ne 0 ]; then
  echo "错误：创建标签 $TAG_NAME 失败。"
  exit 1
fi

# 推送标签到远程仓库 (假设远程仓库名为 origin)
git push origin "$TAG_NAME"
if [ $? -ne 0 ]; then
  echo "错误：推送标签 $TAG_NAME 到远程仓库失败。"
  # 可选：如果推送失败，你可能想删除本地标签
  # git tag -d "$TAG_NAME"
  exit 1
fi

echo "标签 $TAG_NAME 创建并推送成功。"
echo "正在执行 npm run dist..."

# 执行打包命令
npm run dist

if [ $? -ne 0 ]; then
  echo "错误：npm run dist 执行失败。"
  exit 1
fi

echo "构建完成。"
