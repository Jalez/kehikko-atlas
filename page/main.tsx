/*
 * Imported first, and for its side effect, which is the only import in this
 * program that has one. The protocol's client installs the page's message
 * listener synchronously, before React is asked to do anything, because the
 * host greets on the frame's `load` event and React's effects run after that.
 * See the essay in the client's `mailbox.ts`.
 */
import 'kehikot-module-protocol/client'
import { probeServer } from 'kehikot-module-protocol/client'
import { ROOT_ELEMENT } from 'kehikot-module-protocol'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import './styles.css'

/**
 * The entry point, and nothing else in it.
 *
 * One side effect, and it is deliberate: importing the client starts
 * listening. Everything else about the conversation is owned by `useAtlas`, so
 * the DECISIONS still begin when React mounts and end when it unmounts —
 * including under `StrictMode`'s double-mount. What no longer depends on that
 * timing is whether anybody was on the window when the host first spoke.
 */
const root = document.getElementById(ROOT_ELEMENT)
if (!root) throw new Error(`the page has no #${ROOT_ELEMENT} to mount into`)

/**
 * Ask whether this app's own server is still there, at the one moment the page
 * is told it may not be.
 *
 * Nothing on this map comes from that server — every row is the host's answer
 * — so no question the page asks would ever notice it had stopped. Vite's dev
 * client does notice: its socket closes. That is the cue to ask, and the answer
 * is what puts up the cover with Try again; when the server is back Vite
 * reloads the page by itself. Absent from a built page and from the tests,
 * where there is no `import.meta.hot`.
 */
import.meta.hot?.on('vite:ws:disconnect', () => void probeServer())

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
