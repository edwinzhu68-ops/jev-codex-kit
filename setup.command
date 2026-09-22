#!/bin/sh
cd "$(dirname "$0")" || exit 1
sh setup.sh
result=$?
printf '\nSetup finished (exit %s). Press Enter to close.\n' "$result"
read -r answer
exit "$result"
