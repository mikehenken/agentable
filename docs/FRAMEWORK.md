# Agentable

A framework for building canvases that people and agents share.

Agentable renders panels (real, interactive UI) onto a spatial surface, and gives an AI agent the
same public API a human host application would use to place, populate, and rearrange them. The
output embeds into any web page as a web component, into React applications as a component, or
into a host application that builds directly on the primitives.

This document is the orientation layer. It explains what exists, where each piece is used, and
why it was built that way. It is written for three readers: someone evaluating the framework,
a developer extending it, and an AI agent about to modify it. The last section lists invariants
that must not be broken, and the reason behind each.

> **Status.** Agentable is in early development. This document describes the framework as it is
> today. Where a decision is made but not yet implemented, it is marked **Planned**. For a candid
> account of what is incomplete, broken, or carrying debt, read
> [FRAMEWORK-ASSESSMENT.md](development/FRAMEWORK-ASSESSMENT.md), which is deliberately
> unflattering.

---

## 1. Philosophy

Six beliefs shape nearly every decision in the codebase. When a design question comes up that this
document does not answer, reason from these.

**The core is generic. Packs carry meaning.** Core knows about panels, canvases, tokens,
toolbars, and registries. It does not know what a job posting is, what Sandals is, or what a
career concierge does. Domain content lives in packs (`packages/career-pack`,
`packages/support-inbox-pack`). Dependencies flow from pack to core and never the reverse. This is
the single most load-bearing rule in the project, because it is what makes the framework a
framework rather than one client's application with configuration bolted on.

**Embeddability is not a feature, it is the shape of the thing.** Every surface is built to drop
into a page that someone else owns, styled by tokens the host supplies, isolated so neither side
leaks CSS into the other. If a capability cannot survive being embedded in a stranger's website,
it does not belong in core.

**Tokens are the only brand surface.** There is exactly one way to make agentable look like your
company, and it is CSS custom properties. Not theme objects, not props threaded through
components, not forked stylesheets. A hardcoded hex value in a component body is a bug.

**Events out, configuration in.** Components communicate outward with `CustomEvent`, which crosses
framework boundaries and shadow boundaries alike. Callbacks exist as an ergonomic shim in the
JS-API surface, implemented on top of the events, never as the primary interface.

**The agent is a user, not a backdoor.** An AI agent places a panel through the same
`openPanelInCanvas` a host application calls. There is no privileged agent-only path into the
canvas. This keeps one code path tested instead of two, and it means anything the agent can do,
a developer can do, and inspect, and reproduce.

**Nothing half-wired.** Because the framework is young, an unimplemented promise is worse than an
absent feature: it costs a reader time and it lies to an AI agent reading the code. A stub gets
implemented or deleted, not left as a placeholder with a hopeful docstring.

---

## 2. The layer model

```
   Host application Your React app, a marketing page, a CMS, an iframe
        |
   Packs career-pack, support-inbox-pack
        | Domain panels, prompts, fixtures, branding
        v
   Core (agentable-canvas) Panels, canvas engines, config, tokens, agent runtime
        |
   Engines tldraw (spatial) | DOM (regions and tabs)
```

Core exposes generic primitives: toolbars, canvas modes, theme tokens, the panel registry and its
slots, the nav rail mechanism, and the config schema. Packs supply everything with a domain
opinion: navigation content, panel definitions, chrome, data, and branding.

**No file under `src/` may import from `packages/`.** This is enforced by
`tests/unit/careerPackBundleBoundary.test.ts`, whose allowlist may only shrink. Adding an entry
requires an explicit owner decision. Equally forbidden: branching core behavior on a tenant name
(`tenant === 'sandals'`). If core needs to behave differently for a tenant, that difference is a
configuration field or a pack, never a string comparison.

The reason is practical rather than ideological. The first client is a career concierge, and
without this boundary the framework would quietly become a career concierge application. The
boundary is what lets the second client cost a fraction of the first.

---

## 3. Canvas surfaces

Two engines exist, and they are genuinely different runtimes rather than modes of one thing.

The **tldraw engine** provides a spatial surface with a camera: pan, zoom, world coordinates,
shapes that exist outside the viewport. It supports three modes, declared in `src/engine/types.ts`:

| Mode | Camera | Use it for |
|---|---|---|
| `infinite` | Free pan and zoom | Exploratory workspaces, agent-driven drawing, whiteboards |
| `bounded` | Constrained to a `bounds` rect, with `behavior: 'contain' \| 'inside'` | Embedded canvases inside a page, where the surface must stay put |
| `fixed` | Locked | Kiosk and demo surfaces where the layout is authored, not explored |

The **DOM engine** (`src/engines/dom/`) is not a canvas at all. It lays panels into CSS grid
regions with tab strips, has no camera, and reports `infinitePan: false`. Its `getCamera` returns
an identity transform and `setCamera` is a no-op. Use it when the product wants an application
shell rather than a spatial surface, and when you want panels without the weight of a canvas
engine.

There is also **workspace mode**, which is not a fourth engine but a behavior: zooming a context
frame to fill the viewport so a region of an infinite canvas reads like an application page.

Choosing between them: if the user should be able to move the view, use tldraw. If the layout is
the product and the user should never think about a camera, use the DOM engine.

---

## 4. Embed paths

Three ways to consume the framework, in descending order of how much control the host takes.

**Path L, the custom element.** A script tag and a `<agentable-canvas>` element. Works in any page:
plain HTML, WordPress, a CMS that strips inline scripts (there is an iframe fallback element for
that case). This is the most mature and most standardized path, and it is what most embedders
should use.

```html
<script type="module" src="https://cdn.../agentable-canvas.js"></script>
<agentable-canvas tenant="acme" primary-color="#0E7490" canvas-mode="bounded"></agentable-canvas>
```

**Path B, the React wrapper.** `agentable-canvas/react` and `agentable-canvas/react/panel` provide
camelCase-prop React components that register the custom element and wire typed event listeners,
because React does not bind colon-named custom events on its own. Vue and Svelte wrappers exist
for the panel element. This path is an ergonomic adapter around the same encapsulated element, not
a React-native rendering path.

**Path D, deep integration.** A host that wants to build *with* agentable rather than embed it
imports the engine primitives directly: `WhiteboardShell`, `createWhiteboardEngine`, the imperative
`panelShapeApi`, the docking hooks. The host owns the layout and the chrome and calls into the
framework.

> **Planned.** Path D is currently half-published. The engine primitives are exported, but
> `createCanvasHost` and the panel registry are not, and hosts alias into `src/` with a Vite
> config, which only works inside this monorepo. A `./panels` export closes this.

---

## 5. Configuration

One cascade, resolved later-wins:

```
platform -> tenant -> agent -> embed -> runtime
```

- **platform**: framework defaults shipped with the build.
- **tenant**: fetched by `anonKey`, a public client-safe identifier used only for tenant lookup,
  rate limited, never granting privileged operations.
- **agent**: what the running agent configuration contributes.
- **embed**: `data-*` attributes and the config document referenced by the embed.
- **runtime**: imperative `updateConfig` calls after mount.

Merging happens in `src/config/merge.ts`. Unknown fields produce a console warning rather than
being silently accepted, so a typo in a tenant config surfaces instead of vanishing.

**Sensitive values never travel this path.** Provider API keys, JWT secrets, and BYOK tokens are
resolved server-side. Anything reachable from the browser is public by definition, and any
variable prefixed `VITE_` is compiled into the client bundle whether you intended it or not.

> **Planned: scope.** Today the cascade is canvas-global. Configuration is being extended so any
> policy can also be set on a **frame or context** (a region of the canvas, such as a site context)
> and overridden on an **individual panel**. The mechanism reuses two things that already work:
> per-shape state persisted in tldraw's native `meta` field, and nearest-ancestor resolution that
> walks the parent chain to find the enclosing context frame.

---

## 6. Theming

A tenant supplies a brand, and everything downstream adopts it. The delivery mechanism is CSS
custom properties, chosen because they are the one styling mechanism that inherits *through* a
shadow boundary. Ordinary selectors and stylesheets do not cross it; custom properties do.

Set a token on the host element and it reaches every panel, every widget, and any guest component
library rendering inside them.

Two forms of each color are maintained, and this is deliberate rather than redundant: a hex value
and an `H S% L%` triplet. Tailwind's `<alpha-value>` composition requires the triplet, so an
embedder who overrides only the hex would otherwise get a split brand where solid utilities honor
the override and alpha-modified utilities silently keep the build-time default.

**Guest component libraries.** Panel content does not have to be Lit. React, Vue, MUI, Ant, or
plain HTML all work inside a panel. Difficulty varies by how the library injects its styles:

| Library | Effort | What it needs |
|---|---|---|
| Plain CSS or CSS modules | None | Adopt the stylesheet into the shadow root |
| MUI | One provider | Emotion cache pointed at the shadow root, portal containers redirected, CSS-variables mode rooted at `:host` |
| Ant Design | One provider | `StyleProvider` with a shadow-root container, `cssVar` theme mode |
| shadcn with Tailwind v4 | Significant | Tailwind v4 registers custom-property defaults with `@property`, which no browser currently honors inside a shadow root. Requires hoisting those registrations to document scope or reapplying them programmatically, plus redirecting every Radix portal. |

The gotcha that catches everyone: **portals**. Dialogs, tooltips, dropdowns, and toasts default to
`document.body`, which escapes the shadow root and renders them both unstyled and unthemed. Every
portal-based component needs its container redirected explicitly.

> **Planned: one source.** Tokens today are hand-written and duplicated across a CSS file and
> several Lit fallback constants, in several parallel vocabularies. They are moving to a single
> [DTCG](https://www.designtokens.org/) source of truth with a build step generating every output,
> which also makes importing a tenant's Figma token set a build step rather than a bespoke
> conversion.

---

## 7. Panels

A panel is the unit of UI. Two kinds exist:

**Spec panels** are JSON trees. A spec names catalog component types (`header`, `list`, `table`,
`field-form`, `action-row`, `badge`, `tabs`, `confirm`, `empty-state`, `filter-chips`,
`document-view`, and others), each validated by a Zod props schema. The renderer walks the tree and
looks each type up in a catalog map. Spec panels are serializable, which means an agent can emit
one, a server can store one, and neither needs to ship code.

**React panels** are lazily loaded components, for anything a spec cannot express.

Panels are registered in a registry keyed by id, where a later registration replaces an earlier one
with the same id. That collision rule is the mechanism by which a pack overrides a core panel.

**Chrome** is the frame around a panel body: title, provenance badge, pin, minimize, close.
Instance-level options control layout (`hideChrome`, `fullBleed`, `noBorder`, `minimized`).

> **Planned: chrome overrides and footers.** Two chrome implementations currently exist and have
> drifted, neither has a footer, and tenants cannot substitute their own header or footer. This is
> being unified, given a footer region, and made overridable by threading a tenant-supplied catalog
> through the renderer, which already accepts one but is never given one.

---

## 8. Agents

An agent reaches the canvas through tools, which are ordinary functions with declared schemas. The
agent can open and close panels, read canvas state, draw shapes, connect them, group them, and
arrange them.

**Tool execution is sequential, deliberately.** Canvas tools mutate shared spatial state where
ordering is semantically meaningful: placing B relative to A requires A to exist first. Parallel
execution was considered and rejected. This is the opposite of the usual advice for tool calling,
and it is correct here for the same reason database transactions are serialized.

**Turns are budgeted.** A turn has a cap on tool executions to prevent runaway loops.

**Verification is part of the loop.** After drawing, the agent reads back the canvas, lints the
result, and repairs it. The agent sees what the user sees rather than trusting that its intent
was realized.

**Human approval is a first-class state.** Consequential actions surface an approval card and wait.
An agent must never infer approval or mark a gate passed on its own.

> **Known defect.** Verification calls currently share the user's tool budget, so a turn that draws
> and self-corrects can exhaust its allowance on bookkeeping before reaching the user's second
> request. The budgets are being separated. See the assessment document.

---

## 9. Layout

> This section describes a decided architecture that is not yet implemented. It is included here
> because the reasoning matters for anyone extending layout behavior.

Panels are placed by a **constraint solver** (Cassowary, the same algorithm behind Apple's Auto
Layout). Layout intent is expressed declaratively and the solver produces positions that provably
satisfy the hard constraints.

Priorities follow Apple's proven model rather than an invented one:

| Tier | Weight | Meaning |
|---|---|---|
| Required | 1000 | Never violated. Panels stay inside bounds. Unsatisfiable required constraints are dropped and logged, never silently producing a broken layout. |
| High | 750 | Explicit user intent: a manual resize, a pin. |
| Low | 250 | Aesthetic preference: fit-to-content, even stacking. |

Two defaults do most of the work: content hugging is low and compression resistance is high, so a
panel under space pressure **shrinks before it hides**, which is almost always what a person
wants.

Authoring uses flex and grid vocabulary compiled down to constraints, because that vocabulary is
already understood by both developers and language models:

```js
{ layout: 'grid', columns: 12, gap: 16, growPreference: 'bidirectional', insertAt: 'end' }
```

**Overflow strategies** for a bounded canvas with no room left: `resize-bounds` (shrink to fit),
`hide`, `close`, and `overlay` (stack evenly over an existing panel, restacking on retrigger).
These are priority degradation rather than a branching cascade.

Solved positions are written as ordinary shape properties, never as opaque transforms. Grid Style
Sheets, the closest prior art, compiled a CSS-like language to Cassowary and was abandoned in part
because absolute positioning made computed layout invisible to developer tools. Inspectability is
not optional.

---

## 10. Extending the framework

**Add a panel.** Define a spec or a React component, register it with an id. If it carries domain
meaning, it belongs in a pack.

**Add a pack.** A pack contributes panels, prompts, fixtures, and branding, and imports from core.
Core must remain unaware of it.

**Use a component library inside a panel.** Mount the library's root inside the panel's shadow
root, wire its style provider to that root, redirect its portals, and enable its CSS-variables
theming mode so it reads the host tokens. See the theming table above.

**Add a layout strategy.** Implement it against the strategy interface, register it, and make it
selectable at canvas, frame, or panel scope. Do not add a fourth uncoordinated arrangement
function.

**Add a token.** Add it to the token source, not to a component. If a component needs a value that
is not a token, that is a signal the token set is incomplete.

---

## 11. Decisions and rejected alternatives

The reasoning matters more than the conclusion, because the conclusion may need to change.

**Lit for the framework, anything for panel content.** Lit gives a small runtime, native custom
elements, and shadow encapsulation, which is what embedding demands. Mature React component
ecosystems were evaluated and are excellent, but every one of them is React-first, which would
make the framework unusable outside React. Rather than choose, the framework layer is Lit and
panel content is open. Their real contribution here is architectural: MUI's CSS-variables theming
and shadcn's MCP server are both patterns worth copying natively.

**Constraint solving over packing and physics.** Bin packing is deterministic and cheap but
repacks from scratch, which reshuffles the whole canvas when one thing changes. Force-directed
layout settles organically but jitters and is non-deterministic, which reads as unprofessional.
Constraint solving expresses all four overflow strategies as one priority system and re-solves
incrementally, moving one panel without disturbing the rest. It is also the only approach where
"never leave the bounds" is a mathematical guarantee rather than a clamp applied afterward.

**Catalog registry over slots and render props for chrome overrides.** Slots would require
reworking the shadow boundary in several places. Render props would let a tenant inject arbitrary
code and break the guarantee that catalog components stay presentational. A registry reuses three
patterns the codebase already trusts: partial config merge, allow-list plus custom entries, and
catalog lookup.

**DTCG over bespoke tokens.** The format stabilized in October 2025 and every major design tool
interoperates through it. Adopting a standard costs a build step and buys tenant Figma import.

**Sequential tool execution over parallel.** Explained in section 8. Worth restating because it
looks like a performance oversight and is not.

---

## 12. Invariants for AI agents modifying this framework

If you are an agent reading this before making changes, these are the rules with the highest cost
of violation. Each one has been broken before or is one careless commit away.

1. **No file in `src/` imports from `packages/`.** Enforced by a boundary test whose allowlist may
   only shrink. If you need domain content in core, you have found a design error, not an
   exception.
2. **No tenant-name branching in core behavior.** `tenant === 'sandals'` in a core conditional is
   forbidden. Express the difference as configuration.
3. **No hardcoded brand values.** No hex, no literal px spacing, no font names inside component
   bodies. Tokens only.
4. **Secrets are named, never valued.** Refer to environment variables by name. Never print,
   commit, or inline a value. Remember that `VITE_`-prefixed variables ship to the browser.
5. **Solved layout stays inspectable.** Write positions as shape properties. Do not hide layout in
   transforms.
6. **Events are the primary interop surface.** Add to the typed event map when you add an event.
   Callbacks are shims over events, never the other way around.
7. **Do not leave a stub.** Implement it or delete it, including its documentation and its tests.
   A documented capability that does not work costs the next reader more than a missing one.
8. **Do not claim verification you did not perform.** For UI changes, that means actually loading
   the page and looking at it. Passing unit tests are not evidence that a canvas renders.
9. **Reviewer is never implementer.** Independent review with an explicit attestation is required
   before a task is considered complete.
10. **No em dashes in any output.** House style, applied to code comments, documentation, and
    user-facing copy alike.

---

## Further reading

| Document | Purpose |
|---|---|
| [FRAMEWORK-ASSESSMENT.md](development/FRAMEWORK-ASSESSMENT.md) | Candid state of the framework: strengths, gaps, defects, debt |
| [ARCHITECTURE.md](development/ARCHITECTURE.md) | Module-level architecture |
| [EMBEDDING.md](../EMBEDDING.md) | Embed contract, attributes, theming reference |
| [DOCS_INDEX.md](DOCS_INDEX.md) | Full documentation index |
