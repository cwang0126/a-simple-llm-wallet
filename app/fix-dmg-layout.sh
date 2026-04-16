#!/usr/bin/env bash
# Repositions .VolumeIcon.icns inside the DMG to the bottom-center,
# so it doesn't overlap the app/Applications icons when hidden files are shown.
# Run after: npm run tauri build

set -e

DMG=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -1)

if [[ -z "$DMG" ]]; then
  echo "No .dmg found in src-tauri/target/release/bundle/dmg"
  exit 1
fi

echo "Patching layout: $DMG"

MOUNT=$(mktemp -d)
# Attach read-write (no SLA, no auto-open)
hdiutil attach "$DMG" -mountpoint "$MOUNT" -noautoopen -quiet

# Move .VolumeIcon.icns to bottom-center of the DMG window (350, 430)
# Window bounds are ~660x400 starting at (155,141); icons at y=215
osascript << APPLESCRIPT
tell application "Finder"
  set theDisk to POSIX file "$MOUNT" as alias
  tell disk (name of (info for theDisk))
    open
    delay 0.5
    set position of item ".VolumeIcon.icns" to {350, 430}
    close
  end tell
end tell
APPLESCRIPT

hdiutil detach "$MOUNT" -quiet
rmdir "$MOUNT"

echo "Done — .VolumeIcon.icns moved to bottom-center"
