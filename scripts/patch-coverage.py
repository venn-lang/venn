"""
What `codecov/patch` will say, before the pull request is opened.

Run `pnpm test:coverage` first, then this. It reads `coverage/lcov.info` and
counts only the lines this branch added, which is what codecov calls the patch.

Branches are counted too, and that is the point: a line can run and still leave
one side of its `??` or its `if` untried, and codecov calls that a partial and
holds it against the patch. Counting lines alone reads 100% for a patch codecov
fails.

A file git has never seen is counted whole. `git diff` says nothing about an
untracked file, so a patch made mostly of new files read as a handful of lines
in the ones it touched, and answered 100% for work nothing had covered.
"""
import io, os, re, subprocess, sys

base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
# Decoded as utf-8 rather than as whatever the console is: a diff holds source,
# and on Windows the default codec stops at the first byte it does not know.
diff = subprocess.run(
    ["git", "diff", "-U0", base, "--", "packages"],
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
).stdout
added, path = {}, None
for line in diff.splitlines():
    if line.startswith("+++ b/"):
        path = line[6:].strip()
    elif line.startswith("@@") and path:
        m = re.search(r"\+(\d+)(?:,(\d+))?", line)
        if m:
            start, count = int(m.group(1)), int(m.group(2) or 1)
            added.setdefault(path, set()).update(range(start, start + count))

untracked = subprocess.run(
    ["git", "ls-files", "--others", "--exclude-standard", "--", "packages"],
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
).stdout.split()
for path in untracked:
    if not path.endswith(".ts") or path.endswith(".test.ts"):
        continue
    lines = sum(1 for _ in io.open(path, encoding="utf-8", errors="replace"))
    added.setdefault(path, set()).update(range(1, lines + 1))

hits, misses, partials, cur = {}, {}, {}, None
branch = {}
for line in io.open("coverage/lcov.info", encoding="utf-8", errors="replace"):
    if line.startswith("SF:"):
        cur = line[3:].strip().replace("\\", "/").split("flow-language/")[-1]
    elif line.startswith("DA:") and cur in added:
        n, count = line[3:].strip().split(",")[:2]
        if int(n) in added[cur]:
            (hits if int(count) > 0 else misses).setdefault(cur, []).append(int(n))
    elif line.startswith("BRDA:") and cur in added:
        n, _block, _id, taken = line[5:].strip().split(",")
        if int(n) in added[cur]:
            branch.setdefault(cur, {}).setdefault(int(n), []).append(taken)

for f, lines in branch.items():
    for n, taken in lines.items():
        if any(t == "0" or t == "-" for t in taken) and any(t not in ("0", "-") for t in taken):
            partials.setdefault(f, []).append(n)

h = sum(len(v) for v in hits.values())
m = sum(len(v) for v in misses.values())
p = sum(len(set(v)) for v in partials.values())
for f in sorted(set(hits) | set(misses) | set(partials)):
    miss, part = misses.get(f, []), sorted(set(partials.get(f, [])))
    note = ""
    if miss:
        note += f"  missing {miss}"
    if part:
        note += f"  partial {part}"
    print(f"{len(hits.get(f, [])):>4} hit {len(miss):>3} miss {len(part):>3} partial  {f}{note}")
total = h + m
print(f"\nlines {h}/{total}" + (f" = {100 * h / total:.1f}%" if total else ""))
print(f"partial branches: {p}   (codecov counts these against the patch)")
