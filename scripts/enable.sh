#!/bin/sh

restore() {
    src="$1"
    dst="$2/$(basename "$1")"

    [ -f "$src" ] || { echo "Source file missing: $src" >&2; exit 1; }
    [ -d "$2" ] || { echo "Destination folder missing: $2" >&2; exit 1; }
    if [ -e "$dst" ] || [ -L "$dst" ]; then
        echo "Destination already exists: $dst" >&2
        exit 1
    fi

    cp "$src" "$dst" || { echo "Failed to restore $src to $dst" >&2; exit 1; }
}


if [[ $UID -ne 0 ]]; then
echo "$0 must be run as root."
exit 1
fi

set -x

# #As needed through script, logged in user is variable below
loggedInUser=dusan

# #Get loggedInUser ID
userID=$( id -u $loggedInUser )

SCRIPT_FOLDER=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKUP_FOLDER="$SCRIPT_FOLDER/../backup"

restore $BACKUP_FOLDER/com.zscaler.tray.plist /Library/LaunchAgents/
launchctl enable gui/$userID/com.zscaler.tray.plist
launchctl bootstrap gui/$userID /Library/LaunchAgents/com.zscaler.tray.plist

restore $BACKUP_FOLDER/com.zscaler.service.plist /Library/LaunchDaemons/
launchctl enable system/com.zscaler.service.plist
launchctl bootstrap system /Library/LaunchDaemons/com.zscaler.service.plist

restore $BACKUP_FOLDER/com.zscaler.tunnel.plist /Library/LaunchDaemons/
launchctl enable system/com.zscaler.tunnel.plist
launchctl bootstrap system /Library/LaunchDaemons/com.zscaler.tunnel.plist

restore $BACKUP_FOLDER/com.zscaler.UPMServiceController.plist /Library/LaunchDaemons/
launchctl enable system/com.zscaler.UPMServiceController.plist
launchctl bootstrap system /Library/LaunchDaemons/com.zscaler.UPMServiceController.plist
