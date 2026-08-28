#!/usr/bin/env sh
#
# Start Atlas. No arguments. `PORT` from the environment, or 7830.
#
# ## One port, and no build
#
# A module is one origin or it is nothing. The protocol refuses a manifest whose
# `entry` points anywhere but the origin that served the manifest, so the page,
# the manifest and the health check all answer here — see the `doors` plugin in
# `vite.config.ts`, which is how the two that are not the page get served.
#
# There used to be a `dist/`: the page was built once, a small server handed it
# off disk, and the build was skipped when `dist` already existed. That is the
# shape of a deployment and this program is not deployed — it runs on the
# machine of the person editing it. What the shape actually bought was a stale
# page served with a 200, which is every symptom of a working program and none
# of the changes, and it cost an afternoon before anybody suspected the build
# rather than the code.
#
# `exec`, and in the foreground, because whoever started this holds the process
# that serves. A script that forked and returned would leave them with a pid
# that stops nothing.
set -eu
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "installing…" >&2
  bun install >&2
fi

exec bunx vite --host 127.0.0.1 --port "${PORT:-7830}" --strictPort
