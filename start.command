#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  exec node scripts/server.mjs
fi
# Convenience for this workspace; ordinary installations only need Node.js 22+.
for game_node in ../.local/rea/.local-runtime/node-*/bin/node(N); do
  if [[ -x "$game_node" ]]; then exec "$game_node" scripts/server.mjs; fi
done
print 'Node.js 22 or later is required. Install it, then run npm start in this folder.'
exit 1
