/*
 * Imported first, and for its side effect, which is the only import in this
 * program that has one. It installs the page's message listener synchronously,
 * before React is asked to do anything, because the host greets on the frame's
 * `load` event and React's effects run after that. See `mailbox.ts`.
 */
import './mailbox.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import './styles.css'

/**
 * The entry point, and nothing else in it.
 *
 * One side effect, and it is deliberate: importing `mailbox.ts` starts
 * listening. Everything else about the conversation is owned by `useAtlas`, so
 * the DECISIONS still begin when React mounts and end when it unmounts —
 * including under `StrictMode`'s double-mount. What no longer depends on that
 * timing is whether anybody was on the window when the host first spoke.
 */
const root = document.getElementById('atlas')
if (!root) throw new Error('index.html has no #atlas to mount into')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
