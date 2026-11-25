#!/usr/bin/env bash
# Shows a one-time terminal notice when this plugin is installed or its files change
# (plugin update, or /reload-plugins after an update). Silent otherwise.
# Runs on SessionStart and UserPromptSubmit (see hooks.json). Dependency-free bash.
set -u

root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
manifest="$root/.claude-plugin/plugin.json"
[ -f "$manifest" ] || exit 0

field() { sed -n "s/^[[:space:]]*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$manifest" | head -n 1; }
name="$(field displayName)"; [ -n "$name" ] || name="$(field name)"
version="$(field version)"; [ -n "$version" ] || version="unknown"

data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/$(field name)}"
state="$data/last-seen"

# Fingerprint every plugin file (path and content), so edits count even without a version bump.
fingerprint="$(
  cd "$root" || exit 0
  find . -type f ! -name '.DS_Store' ! -path './.git/*' | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s\n' "$f"; cat "$f"
  done | cksum | tr -s ' ' '-'
)"
[ -n "$fingerprint" ] || exit 0

last_fp=""; last_version=""
if [ -f "$state" ]; then
  last_fp="$(sed -n 's/^fingerprint=//p' "$state" | head -n 1)"
  last_version="$(sed -n 's/^version=//p' "$state" | head -n 1)"
fi
[ "$fingerprint" = "$last_fp" ] && exit 0

# One-line summary: the first plain line under the first "## " heading of CHANGELOG.md.
notes=""
if [ -f "$root/CHANGELOG.md" ]; then
  notes="$(awk '/^## /{n++; next} n==1 && NF && !/^[-*#]/ {print; exit}' "$root/CHANGELOG.md" | cut -c1-300)"
fi

if [ -z "$last_fp" ]; then
  msg="$name v$version is ready."
elif [ "$version" != "$last_version" ]; then
  msg="$name updated to v$version (was v$last_version)."
else
  msg="$name v$version reloaded with changes."
fi
[ -n "$notes" ] && msg="$msg What's new: $notes"

mkdir -p "$data" 2>/dev/null && printf 'fingerprint=%s\nversion=%s\n' "$fingerprint" "$version" > "$state" 2>/dev/null

esc="$(printf '%s' "$msg" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\000-\037')"
printf '{"systemMessage": "%s"}\n' "$esc"
exit 0
