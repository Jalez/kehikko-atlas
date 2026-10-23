#!/usr/bin/env sh
#
# Start Atlas. No arguments. `PORT` from the environment, or 7830. It registers
# itself with the address it ends up answering at.
#
# ## One port, and the built page when it is this checkout's
#
# A module is one origin or it is nothing. The protocol refuses a manifest whose
# `entry` points anywhere but the origin that served the manifest, so the page,
# the manifest and the health check all answer here — see the `doors` plugin in
# `vite.config.ts`, or the protocol's `run` in `serve.ts`.
#
# There is a build: `bun run build` compiles the page into `dist/` and stamps it
# with the commit (`dist/.kehikot-built`), and `serve.ts` serves it on the same
# doors and the same port with a fraction of the memory a Vite dev server holds.
# A host builds an installed copy when it installs or updates it, at the tag; a
# start never builds.
#
# There used to be a `dist/` with no stamp: the page was built once, a small
# server handed it off disk, and the build was skipped when `dist` already
# existed. What that bought was a stale page served with a 200, which is every
# symptom of a working program and none of the changes, and it cost an
# afternoon before anybody suspected the build rather than the code. So the
# built page is served only when its stamp is the commit checked out here,
# checked at the bottom of this file; a checkout somebody edits has no stamp, or
# one of an older commit, and gets Vite. `serve.ts` refuses a stale build itself
# too (a 503 that says why).
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

# No port on this line, and no `--strictPort`. The port is said once, as
# `PREFERRED_PORT` in `manifest.ts`, and `serves()` in `vite.config.ts` decides:
# `PORT` when whoever started this named one, 7830 otherwise, loopback only. A
# free port is taken in silence; Atlas already answering there ends this start
# cleanly rather than making a second copy; anything else in the way is a loud
# move to the next free port. Either way the port actually bound is written to
# this module's registration, which is how a host finds it.
# The built page, when its stamp is this checkout's HEAD. Read here, in the
# shell, so choosing costs a `git rev-parse` and not a process.
BUILT=
if [ -f dist/.kehikot-built ] && [ -f dist/index.html ]; then
  read -r BUILT < dist/.kehikot-built || true
fi
if [ -n "$BUILT" ] && [ "$BUILT" = "$(git rev-parse HEAD 2>/dev/null)" ]; then
  exec bun run serve.ts
fi
if [ -n "$BUILT" ]; then
  echo "atlas: dist/ is a build of $(printf %.7s "$BUILT"), not of this checkout, so Vite serves the page. \`bun run build\` would make it current." >&2
fi

exec bunx vite $VITE_FORCE
