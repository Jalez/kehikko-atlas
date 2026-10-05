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

# Install when nothing is installed, AND whenever bun.lock or package.json is
# newer than the last install here — the same rule as the host's own run.sh. A
# pull that moves the protocol pin leaves the old package in node_modules, and
# a page that imports a name the old package does not have draws nothing.
# `--frozen-lockfile`, so a start installs exactly what bun.lock says and never
# rewrites it behind somebody's back. The stamp is written only after an
# install that succeeded.
INSTALLED=node_modules/.kehikot-installed
VITE_FORCE=
if [ ! -d node_modules ] || [ ! -f "$INSTALLED" ] || [ bun.lock -nt "$INSTALLED" ] || [ package.json -nt "$INSTALLED" ]; then
  echo "installing…" >&2
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile >&2 || { echo "bun install --frozen-lockfile failed: bun.lock does not match package.json. Run \`bun install\` and commit bun.lock." >&2; exit 1; }
  else
    bun install >&2
  fi
  touch "$INSTALLED"
  # Rebuild Vite's pre-bundle rather than trust one made from the old packages.
  VITE_FORCE=--force
fi

exec bunx vite --host 127.0.0.1 --port "${PORT:-7830}" --strictPort $VITE_FORCE
