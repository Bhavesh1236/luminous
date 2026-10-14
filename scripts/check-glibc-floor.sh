#!/usr/bin/env bash
# Fail if an AppImage needs a newer glibc than the oldest one we support.
#
# An AppImage uses the host's glibc, and its binary and bundled libraries need
# whatever glibc the build machine had. Built on Ubuntu 24.04 they needed 2.39,
# so v3.0.0 didn't start on Ubuntu 22.04 / Debian 12 or in the AppImage
# catalog's test (#1700). release.yml builds the Linux leg on ubuntu-22.04 and
# runs this on the result.
#
# Usage: check-glibc-floor.sh <file.AppImage> [max glibc version, default 2.35]
# Needs objdump (binutils).
set -euo pipefail

APPIMAGE=$(realpath "$1")
MAX="${2:-2.35}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
chmod +x "$APPIMAGE"
(cd "$WORK" && "$APPIMAGE" --appimage-extract > /dev/null)

# file<TAB>highest GLIBC_x.y it references, for every ELF file in the AppImage
REPORT="$WORK/report.tsv"
: > "$REPORT"
while IFS= read -r -d '' F; do
  [ "$(head -c 4 "$F" | od -An -c | tr -d ' ')" = '177ELF' ] || continue
  V=$(objdump -T "$F" 2> /dev/null | grep -oE 'GLIBC_[0-9]+(\.[0-9]+)*' | sed 's/^GLIBC_//' | sort -uV | tail -n 1 || true)
  if [ -n "$V" ]; then printf '%s\t%s\n' "${F#"$WORK/squashfs-root/"}" "$V" >> "$REPORT"; fi
done < <(find "$WORK/squashfs-root" -type f -print0)

[ -s "$REPORT" ] || { echo "ERROR: found no ELF files referencing glibc in $1" >&2; exit 1; }

NEED=$(cut -f 2 "$REPORT" | sort -uV | tail -n 1)
echo "Highest glibc required: $NEED (allowed: $MAX)"
if [ "$(printf '%s\n%s\n' "$NEED" "$MAX" | sort -V | tail -n 1)" != "$MAX" ]; then
  echo "ERROR: $(basename "$1") needs glibc $NEED, newer than $MAX. Files over the limit:" >&2
  while IFS=$'\t' read -r F V; do
    [ "$(printf '%s\n%s\n' "$V" "$MAX" | sort -V | tail -n 1)" = "$MAX" ] || echo "  $F: GLIBC_$V" >&2
  done < "$REPORT"
  exit 1
fi
