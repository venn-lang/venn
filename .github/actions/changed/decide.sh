#!/usr/bin/env bash
# Reads the changed paths on stdin and writes `code=true|false` to $GITHUB_OUTPUT.
#
# Separate from fetching the list so it can be run without a repository, a
# network or GitHub. The list is the easy half; this is the half that decided a
# changeset was prose and nearly dropped a changelog.
set -euo pipefail

# By exclusion: a path counts as code unless it is named here, so anything new
# is built and tested until someone decides otherwise. The other way round, a
# path nobody thought of would go out untested.
PROSE='^(docs/|\.github/ISSUE_TEMPLATE/|LICENSE$|.*\.md$)'
# Matches nothing unless the caller asked for something.
ALSO="${ALSO:-\$^}"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

files=$(cat)

# An empty list means the comparison told us nothing, not that nothing changed.
# Build it rather than trust a silence.
if [ -z "$files" ]; then
  echo "Nothing came back, so run everything."
  echo "code=true" >>"$OUT"
  exit 0
fi

echo "$files"
if echo "$files" | grep -qvE "$PROSE"; then
  echo "code=true" >>"$OUT"
elif echo "$files" | grep -qE "$ALSO"; then
  echo "Prose, but the caller counts these as code."
  echo "code=true" >>"$OUT"
else
  echo "Only prose changed."
  echo "code=false" >>"$OUT"
fi
