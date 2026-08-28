#!/usr/bin/env bun
/**
 * A stub host, for looking at this app the way a person will see it.
 *
 *   bun run harness/host.ts            # then open http://localhost:7831
 *
 * NOT a test, and not part of the app. `bun test` covers the wire, the reading,
 * the grouping and the words, and it covers them without a browser because that
 * is where those failures actually live. This exists for the other half: what
 * the page LOOKS like when a host is talking to it, which no assertion catches
 * and which is the only way to find out that a fifteen-epic project pushes the
 * rest of the map off the screen.
 *
 * It is a deliberately unhelpful host. It answers the list method, it refuses
 * on demand, it goes silent on demand, and it answers navigation with whichever
 * outcome the buttons are set to — because the interesting screens in this app
 * are the ones where the host is unhelpful, and a harness that only ever
 * behaves well would exercise the one screen that needed the least care.
 */
import { WELL_KNOWN } from 'roadmap-module-protocol'

const PORT = Number(process.env.PORT ?? 7831)
const MODULE = process.env.MODULE ?? 'http://localhost:7830'

const PAGE = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><title>Stub host</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 0; display: grid; grid-template-columns: 300px 1fr; height: 100vh; }
  aside { padding: 16px; border-right: 1px solid #ccc; overflow: auto; }
  h1 { font-size: 15px; margin: 0 0 12px; }
  fieldset { border: 1px solid #ddd; margin: 0 0 12px; padding: 8px; }
  legend { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  button { display: block; width: 100%; margin: 2px 0; padding: 5px; font: inherit; cursor: pointer; }
  label { display: block; font-size: 12px; margin: 4px 0; }
  #log { font: 11px ui-monospace, monospace; white-space: pre-wrap; color: #444; }
  main { display: grid; }
  iframe { width: 100%; height: 100%; border: 0; }
  .narrow iframe { width: 360px; border-right: 1px dashed #999; }
</style></head>
<body>
<aside>
  <h1>Stub host</h1>
  <fieldset><legend>answer to the list</legend>
    <button data-answer="full">a full roadmap (5 projects, 27 epics)</button>
    <button data-answer="lopsided">one project of 15, four of one</button>
    <button data-answer="messy">half-readable: bad slugs, missing fields</button>
    <button data-answer="bare">a bare array, not the agreed shape</button>
    <button data-answer="empty">genuinely no epics</button>
    <button data-answer="rubbish">an answer with no list in it</button>
    <button data-answer="refuse">refuse it (failed)</button>
    <button data-answer="unknown">refuse it (unknown-method)</button>
    <button data-answer="silence">say nothing at all</button>
  </fieldset>
  <fieldset><legend>answer to a navigation</legend>
    <label><input type="radio" name="nav" value="moved" checked> moved</label>
    <label><input type="radio" name="nav" value="declined"> declined</label>
    <label><input type="radio" name="nav" value="no-such-target"> no-such-target</label>
    <label><input type="radio" name="nav" value="unknown-method"> refuse: unknown-method</label>
  </fieldset>
  <fieldset><legend>context and frame</legend>
    <button id="theme">toggle theme</button>
    <button id="ghost">say the reader is in a project with no epics</button>
    <button id="narrow">toggle a narrow column</button>
    <button id="goto">send a roadmap.goto</button>
  </fieldset>
  <div id="log"></div>
</aside>
<main><iframe id="f" src="${MODULE}/app"></iframe></main>
<script type="module">
const frame = document.getElementById('f')
const log = (...a) => { document.getElementById('log').textContent = a.join(' ') + '\\n' + document.getElementById('log').textContent }

let answer = 'full'
let theme = 'light'
let context = { epic: 'off-means-off', project: 'Roadmap', theme }

const PROJECTS = ['Roadmap', 'Courier', 'Protocol', 'Workbench', 'Paper']
const make = (n, project) => Array.from({ length: n }, (_, i) => ({
  slug: (project.toLowerCase() + '-' + (i + 1)).replace(/[^a-z0-9-]/g, '-'),
  title: project + ' epic ' + (i + 1),
  lede: 'What has to become true for somebody before ' + project.toLowerCase() + ' number ' + (i + 1) + ' is done.',
  project,
  steps: (i * 3) % 14,
}))

const ANSWERS = {
  full: () => ({ epics: [
    ...make(9, 'Roadmap'), ...make(6, 'Courier'), ...make(7, 'Protocol'),
    ...make(4, 'Workbench'), ...make(1, 'Paper'),
  ].map((e, i) => (i % 5 === 4 ? { ...e, lede: undefined, steps: undefined } : e)) }),
  lopsided: () => ({ epics: [
    ...make(15, 'Roadmap'), ...make(1, 'Courier'), ...make(1, 'Protocol'),
    ...make(1, 'Workbench'), ...make(1, 'Paper'),
  ] }),
  messy: () => ({ epics: [
    { slug: 'off-means-off', title: 'Off means off', project: 'Roadmap', steps: 9 },
    { title: 'no slug at all', project: 'Roadmap' },
    { slug: 'NOT A SLUG', title: 'bent out of shape' },
    'a string where an epic should be',
    { slug: 'a-loose-one', title: 'Filed under nothing', steps: [1,2,3] },
    { slug: 'off-means-off', title: 'the same slug twice' },
    { slug: 'rich', title: 'A host that knows more', project: 'Courier', owner: 'jo', stage: 'in-review', refs: ['gh#41'] },
  ] }),
  bare: () => make(4, 'Roadmap'),
  empty: () => ({ epics: [] }),
  rubbish: () => ({ total: 12, page: 1 }),
}

window.addEventListener('message', (e) => {
  const m = e.data
  if (!m || typeof m.type !== 'string' || !m.type.startsWith('roadmap.')) return
  log('module →', m.type, m.method ?? m.height ?? (m.found !== undefined ? 'found=' + m.found : ''))

  if (m.type === 'roadmap.ready') return

  if (m.type === 'roadmap.request') {
    if (m.method.endsWith('.list')) {
      if (answer === 'silence') return log('  (saying nothing)')
      if (answer === 'refuse') return reply(m.id, false, { reason: 'failed', error: 'the store is not open right now' })
      if (answer === 'unknown') return reply(m.id, false, { reason: 'unknown-method', error: 'this host does not answer ' + m.method })
      return reply(m.id, true, ANSWERS[answer]())
    }
    if (m.method === 'state.set') {
      /* Kept in sessionStorage rather than a variable, so that reloading this
         harness page is the same gesture as reloading the canvas — which is the
         only way to see whether the module actually remembers anything. A real
         host keeps this in its own database, keyed by module, and never looks
         inside the string. Neither does this. */
      sessionStorage.setItem('atlas-state', m.params.state)
      log('  host kept ' + m.params.state.length + ' bytes for the module')
      return reply(m.id, true, {})
    }
    if (m.method === 'view.goto') {
      const chosen = document.querySelector('input[name=nav]:checked').value
      if (chosen === 'unknown-method') {
        return reply(m.id, false, { reason: 'unknown-method', error: 'this host speaks protocol 1 and cannot be asked to move' })
      }
      const why = { moved: '', declined: 'the reader has unsaved edits open', 'no-such-target': 'nothing here is called ' + m.params.epic }[chosen]
      reply(m.id, true, { outcome: chosen, epic: chosen === 'moved' ? m.params.epic : null, why })
      if (chosen === 'moved') { context = { ...context, epic: m.params.epic }; sendContext() }
      return
    }
    return reply(m.id, false, { reason: 'unknown-method', error: 'no such method here: ' + m.method })
  }
})

function reply(id, ok, rest) {
  /*
   * A successful answer carries its payload under a 'data' field; a refusal
   * carries 'reason' and 'error' at the top level. This harness used to spread
   * BOTH at the top level, which meant every successful answer it ever gave
   * arrived with no data at all — the module read it as an answer it could not
   * understand and drew the "could not read the answer" screen, for every shape,
   * including the ones meant to be perfectly readable.
   *
   * It looked like the module being fussy. It was this function, and it is worth
   * the comment because the harness is where somebody goes to decide whether the
   * module or the host is at fault.
   *
   * No backticks in this comment, deliberately: it lives inside the page that is
   * served as a template literal, and one would end the string.
   */
  const body = ok ? { data: rest } : rest
  frame.contentWindow.postMessage({ type: 'roadmap.response', id, ok, ...body }, '*')
  log('  host → response', ok ? 'ok' : rest.reason)
}
function sendContext() {
  frame.contentWindow.postMessage({ type: 'roadmap.context', protocol: 2, ...context }, '*')
}
function greet() {
  /* Handed back verbatim on every greeting, which is the whole of the protocol's
     state mechanism. Null when nothing has been kept — a first run — because
     that is the value the module has to be correct about too. */
  const state = sessionStorage.getItem('atlas-state')
  frame.contentWindow.postMessage(
    { type: 'roadmap.hello', protocol: 2, session: 'stub-1', context, state },
    '*',
  )
  log('host → hello' + (state ? ' (with ' + state.length + ' bytes kept)' : ' (keeping nothing)'))
}

frame.addEventListener('load', greet)

document.querySelectorAll('[data-answer]').forEach((b) =>
  b.addEventListener('click', () => { answer = b.dataset.answer; log('answer set to', answer); frame.contentWindow.location.reload() }))
document.getElementById('theme').addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light'; context = { ...context, theme }; sendContext()
})
document.getElementById('ghost').addEventListener('click', () => {
  context = { ...context, epic: null, project: 'A Project With Nothing In It' }; sendContext()
})
document.getElementById('narrow').addEventListener('click', () => document.body.classList.toggle('narrow'))
document.getElementById('goto').addEventListener('click', () => {
  frame.contentWindow.postMessage({ type: 'roadmap.goto', id: 'g-1', ref: 'gh#41' }, '*')
})
</script>
</body></html>`

Bun.serve({
  port: PORT,
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/') {
      return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    return new Response('the stub host serves one page\n', { status: 404 })
  },
})

console.log(`Stub host on http://localhost:${PORT}, framing ${MODULE}/app`)
console.log(`(the module's manifest would be at ${MODULE}${WELL_KNOWN})`)
