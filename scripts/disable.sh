#!/bin/sh

backup() {
    src="$1"
    dst="$2/$(basename "$1")"

    [ -e "$src" ] || return 0
    [ -f "$src" ] || { echo "Source is not a regular file: $src" >&2; exit 1; }
    [ ! -e "$dst" ] || cmp -s "$src" "$dst" || { echo "Destination exists and differs: $dst" >&2; exit 1; }

    cp "$src" "$dst" || exit 1
}

if [[ $UID -ne 0 ]]; then
    echo "$0 must be run as root."
    exit 1
fi

set -x

# As needed through script, logged in user is variable below
loggedInUser=dusan

# Get loggedInUser ID
userID=$( id -u $loggedInUser )

SCRIPT_FOLDER=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKUP_FOLDER="$SCRIPT_FOLDER/../backup"

backup /Library/LaunchAgents/com.zscaler.tray.plist $BACKUP_FOLDER
backup /Library/LaunchDaemons/com.zscaler.service.plist $BACKUP_FOLDER
backup /Library/LaunchDaemons/com.zscaler.tunnel.plist $BACKUP_FOLDER
backup /Library/LaunchDaemons/com.zscaler.UPMServiceController.plist $BACKUP_FOLDER

launchctl disable gui/$userID/com.zscaler.tray.plist
launchctl bootout gui/$userID /Library/LaunchAgents/com.zscaler.tray.plist
rm /Library/LaunchAgents/com.zscaler.tray.plist

launchctl disable system/com.zscaler.service.plist
launchctl bootout system /Library/LaunchDaemons/com.zscaler.service.plist
rm /Library/LaunchDaemons/com.zscaler.service.plist

launchctl disable system/com.zscaler.tunnel.plist
launchctl bootout system /Library/LaunchDaemons/com.zscaler.tunnel.plist
rm /Library/LaunchDaemons/com.zscaler.tunnel.plist

launchctl disable system/com.zscaler.UPMServiceController.plist
launchctl bootout system /Library/LaunchDaemons/com.zscaler.UPMServiceController.plist
rm /Library/LaunchDaemons/com.zscaler.UPMServiceController.plist

launchctl list | grep -i zscaler | awk '{print $3}' | xargs -I{} launchctl disable "system/{}"
launchctl list | grep -i zscaler | awk '{print $1}' | xargs -I{} kill -9 "{}"

