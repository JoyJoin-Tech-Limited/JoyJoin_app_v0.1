#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

prefix='apps/mini-program/src\/'
renamed_count=0

while IFS= read -r -d '' file; do
  [[ "$file" == "$prefix"* ]] || continue

  suffix="${file#"$prefix"}"
  target="apps/mini-program/src/$suffix"

  if [[ "$file" == "$target" ]]; then
    continue
  fi

  git mv -f -- "$file" "$target"
  renamed_count=$((renamed_count + 1))
done < <(git ls-files -z)

echo "Renamed $renamed_count path(s)."
