# Usage:
# get the git commit hash from space between and run `./scripts/cherry-pick-sb.sh <commit hash>`
# e.g.:
# ./scripts/cherry-pick-sb.sh 3fb30af6712905940ab05373f10bccc7c02e9083

git fetch space-between
git cherry-pick $1