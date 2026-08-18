#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
APP_NAME="Mono"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$BUILD_DIR/$APP_NAME.iconset"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
mkdir -p "$BUILD_DIR/ModuleCache"

cp "$ROOT_DIR/macos/MonoApp/Info.plist" "$CONTENTS_DIR/Info.plist"
clang "$ROOT_DIR/macos/MonoApp/main.m" \
  -o "$MACOS_DIR/$APP_NAME" \
  -fobjc-arc \
  -fmodules-cache-path="$BUILD_DIR/ModuleCache" \
  -mmacosx-version-min=11.0 \
  -Wno-deprecated-declarations \
  -framework Cocoa \
  -framework WebKit

mkdir -p "$RESOURCES_DIR/mono-pwa"
rsync -a --exclude '.DS_Store' "$ROOT_DIR/mono-pwa/" "$RESOURCES_DIR/mono-pwa/"

if [[ -f "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" ]]; then
  mkdir -p "$ICONSET_DIR"
  sips -z 16 16 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
  sips -z 32 32 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
  sips -z 64 64 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
  sips -z 256 256 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
  sips -z 512 512 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
  cp "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" "$ICONSET_DIR/icon_512x512.png"
  sips -z 1024 1024 "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
  if ! iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns" 2>/dev/null; then
    sips -s format icns "$ROOT_DIR/mono-pwa/assets/icons/icon-512.png" --out "$RESOURCES_DIR/AppIcon.icns" >/dev/null
  fi
fi

codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null

echo "Built: $APP_BUNDLE"
