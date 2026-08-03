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
#
# Markdown is not prose to this repository. A README carries a Venn block that
# has to check, a package README is required to exist, and no file of any kind
# may carry a dash or credit a tool, and all three of those are guards that live
# in `verify`. Skipping them on a change to the very files they are about is a
# guard anybody can walk past by editing one line of a README.
PROSE='^(\.github/ISSUE_TEMPLATE/|LICENSE$)'
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
