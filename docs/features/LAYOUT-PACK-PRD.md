# Layout Pack

**Product requirements** · Draft for review

| | |
|---|---|
| **Working name** | `lattice` *(proposed, not confirmed)* |
| **Type** | Standalone package, consumed by agentable core as a dependency |
| **Dependencies** | None. No framework, no renderer, no canvas engine. |
| **Reusable on** | Any canvas substrate or the DOM |
| **Audience** | Framework developers · app developers · website owners · AI agents |

Panels must land inside their bounds, arrange coherently, and degrade deliberately when room runs
out. This pack makes that one configurable engine rather than a problem each surface solves for
itself, and it earns the most when several panels arrive at once with nobody deciding where they go.

Every external claim in this document is cited. See [References](#references).

---

## 1. Three reasons this exists

Any one of these would justify the work. Together they argue for a single engine rather than three
partial answers.

**Bounded surfaces have to stay coherent.** A bounded canvas can constrain its camera while the
panels inside it go unconstrained, so a panel ends up partly or wholly outside the visible area and
recovering means moving everything. This happens regardless of who placed it: a person dragging, the
host application opening a panel, or an agent. Resize is the same story, since dragging an edge has
nothing stopping it at the boundary. And when a surface genuinely runs out of room, something
considered has to happen: shrink, collapse, stack, or decline.

**One framework, very different surfaces.** The same framework has to serve a single filtered panel
dropped into a blog post and a full canvas application built by the same implementer. Those want
different layout behavior, so behavior has to be selectable by approach, direction, and bounds mode,
and resolvable per embed, per tenant, per frame, and per panel. The corollary is a developer
experience target: correct defaults at zero lines of configuration, one line to change direction or
column count.

**Several panels arriving at once.** When a frame fills in one pass there is no human deciding
arrangement in the moment. That is true of an agent drawing, and equally true of an application
generating its own interface through A2UI, AG-UI, or a tool surface, where the layout is described
rather than dragged. This is where the pack earns the most, because the alternative is arrangement
by accident.

Running underneath all three: whatever the engine sacrificed has to be readable afterward, by a
developer debugging a surprise and by an agent correcting itself. An engine that quietly compromises
is only marginally better than one that places badly.

---

## 2. Goals and non-goals

### Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | A panel never lands out of bounds on a bounded or locked surface | Property test over generated inputs |
| G2 | Layout is configurable by approach, direction, and bounds mode at every scope | Policy resolves at each scope |
| G3 | Every compromise is reported | Non-empty relaxation list whenever a constraint is not honored |
| G4 | Multiple approaches coexist behind one interface | Approach swappable by config, no call-site change |
| G5 | Minimal implementer effort | Lines of config for correct defaults: zero |
| G6 | Agents emit intent in a vocabulary they know | Flex and grid terms, per-axis fill hug fixed |
| G7 | Reusable beyond agentable | Runs against other canvas substrates and the DOM |

### Non-goals

| Not this | Why |
|---|---|
| **Diagram internals** | When an agent connects shapes into a diagram, the edges and routing belong to the diagram. This pack places the diagram's bounding box as a single unit, exactly like a panel. |
| **Rendering** | The pack computes rectangles. It never touches the DOM, a canvas context, or a shape store. |
| **Animation** | Callers interpolate between results if they want motion. |
| **Theming** | Tokens are a separate system. Spacing arrives as numbers. |

---

## 3. Who it serves

| User | What they need | What they touch |
|---|---|---|
| **Website owner**, low technical skill | Correct behavior with no configuration | Nothing. Defaults. |
| **App developer** embedding one panel | Match their page | One or two policy fields |
| **App developer** building on the framework | Full control | The policy surface, plus custom approach registration |
| **AI agent** | Declarative intent, machine-readable outcome | Intent vocabulary and the relaxation report |
| **Framework maintainer** | One interface to test | `solve` |

---

## 4. Interface

Three inputs, one output. Everything else is detail on these.

```ts
solve(intents: LayoutIntent[], region: Region, policy: LayoutPolicy): LayoutResult
```

### 4.1 Intent

What a thing wants. Declarative by design: it states desires and limits, never positions.

```ts
interface LayoutIntent {
  id: string
  preferred: Size what it would like to be
  min?: Size compression floor
  max?: Size growth ceiling
  priority?: Priority how hard it fights when constraints conflict
  hug?: PerAxis<boolean> shrink to content on this axis
  fill?: PerAxis<boolean> grow to fill available space on this axis
  order?: number sequence hint for flow and grid
  span?: PerAxis<number> module span, grid only
  anchor?: AnchorHint relational placement, opt-in only
  collapsible?: boolean may be minimized under pressure
  meta?: Record<string, unknown> opaque passthrough
}
```

### 4.2 Region

| Mode | Containment | Region may grow |
|---|---|---|
| `bounded` | Enforced | Yes |
| `locked` | Enforced | No |
| `infinite` | Not enforced | Unbounded |

```ts
interface Region {
  rect: Rect
  mode: 'bounded' | 'locked' | 'infinite'
  padding?: PerSide<number>
  obstacles?: Rect[] pre-occupied areas to avoid
}
```

### 4.3 Policy

The configurable surface.

```ts
interface LayoutPolicy {
  approach: ApproachId 'flow' | 'grid' | 'pack' | 'constraint' | custom
  grow: 'horizontal' | 'vertical' | 'bidirectional'
  insertAt: 'start' | 'end'
  gap: number | PerAxis<number>
  columns?: number grid
  overflow: OverflowStrategy[] ordered escalation
  autoMinimize?: boolean
  allowRelational?: boolean gates AnchorHint, default false
  align?: Alignment
}
```

> **Decision.** `bidirectional` is a first-class case from day one, not a later addition. Figma has
> publicly described years of subtle bugs and performance issues that followed from assuming a single
> top-down layout pass and later adding bidirectional dependency [10].

### 4.4 Result

What happened, including what did not.

```ts
interface LayoutResult {
  rects: Map<string, Rect>
  relaxations: Relaxation[] constraints not fully honored
  actions: OverflowAction[] minimized, hidden, closed, overlaid
  regionGrewTo?: Rect
}

interface Relaxation {
  intentId: string
  constraint: string "min.width"
  requested: number | string
  applied: number | string
  reason: string "region width exhausted, 3 peers at equal priority"
}
```

The relaxation report is required rather than optional. No JavaScript constraint-solving library
ships conflict debugging tooling [3][6], so without it an agent cannot self-correct and a developer
facing a surprising layout has nothing to read.

### 4.5 Relational hints, gated

An `AnchorHint` expresses a relationship rather than a position: align this edge to that edge with
an offset. Anchors are ignored unless `allowRelational` is true, and only the `constraint` approach
honors them. The gate exists because relational placement is expressive but harder to reason about,
so products that do not need it should not pay for it, and the default should be predictable.

---

## 5. Four approaches, one interface

Approaches differ in what they can express, not merely in speed. Three are deterministic and
directly debuggable. One is a solver.

| Approach | Behavior | Best for |
|---|---|---|
| `flow` | Sequential placement with wrapping, honoring grow direction and insertion end | Free canvases, panel columns beside a chat |
| `grid` | Column and row modules with spans and edge docking | Artboard and application layouts, bounded embeds |
| `pack` | Rectangle packing for density | Gallery arrangements, artboard repacks |
| `constraint` | Linear constraint solver with priority degradation | Layouts where constraints genuinely conflict and graceful degradation matters |

### Capability matrix

| Capability | `flow` | `grid` | `pack` | `constraint` |
|---|:---:|:---:|:---:|:---:|
| Sequential placement with wrap | yes | yes | no | yes |
| Column and row modules with spans | no | yes | no | yes |
| Grow direction, including bidirectional | yes | yes | partial | yes |
| Insert at start or end | yes | yes | no | yes |
| Edge docking, flush left or right | no | yes | no | yes |
| Density packing of mixed sizes | no | no | yes | no |
| Hug one axis, fill the other | partial | yes | no | yes |
| Proportional shrink under pressure | no | no | no | yes |
| Priority-ordered degradation | no | no | no | yes |
| Relational alignment between panels | no | no | no | opt-in |
| Minimal perturbation on change | no | no | no | yes |
| **Deterministic, trivially debuggable** | **yes** | **yes** | **yes** | **no** |

Read the last two rows together, because they are the trade. Only the solver gives minimal
perturbation and priority degradation. Only the other three give you something you can reason about
at 2am. That is the argument for keeping all four behind one interface rather than choosing.

The interface is deliberately declarative so a solver can sit behind it without the interface
changing. A procedural surface built on `moveTo` and `clampTo` would foreclose that permanently.

**Approaches compose across scopes.** A frame using `grid` may contain a group using `flow`. The
most common real layout, a docked chat column beside a packed region of result panels, is two
approaches nested rather than one approach doing everything.

---

## 6. Overflow

An ordered escalation. The engine applies the first strategy that resolves the conflict and records
what it did.

| Strategy | Behavior | Destructive |
|---|---|---|
| `resize` | Shrink toward the compression floor, respecting priority | no |
| `minimize` | Collapse to title only. Header stays in place, re-expands on interaction. Requires `collapsible: true`. | no |
| `overlay` | Place evenly stacked over a target. Re-triggering stacks the next one evenly on top of the same anchor. | no |
| `hide` | Remove from view, retaining state and identity | reversible |
| `close` | Remove entirely | **yes** |

**Default escalation:** `['resize', 'minimize', 'overlay']`. Nothing is destroyed. `hide` and `close`
are available but opt-in, because losing a user's panel unasked is a worse outcome than a crowded
canvas.

**Hiding and closing must be genuinely distinct operations.** Hiding retains identity and state so
the panel can return; closing does not. A framework where the two collapse into one behavior cannot
offer a non-destructive escalation path at all.

---

## 7. Priority

Borrowed from Apple's Auto Layout rather than invented, because it is proven at scale and already
understood by anyone who has built native UI. Apple's model uses an integer priority scale where
1000 means required, and an unsatisfiable required constraint is surfaced as a runtime error rather
than silently ignored [8][9].

| Tier | Weight | Meaning |
|---|---|---|
| **Required** | 1000 | Never violated. Containment lives here. |
| **High** | 750 | Explicit intent: a manual resize, a pin. |
| **Low** | 250 | Aesthetic preference: fit to content, even stacking. |

The useful way to hold it: required constraints are laws and the engine will not break one.
Everything else is a preference submitted with a budget. The engine guarantees legality first, then
spends remaining freedom on the best-funded preferences. Two equally funded preferences in conflict
are both partially met, which is right when three panels compete for one row.

Two defaults do most of the work, and both come from Apple's content hugging and compression
resistance model [8]:

```
content hugging -> low (does not fight to stay small)
compression resistance -> high (fights to avoid being squeezed)
```

That asymmetry means a panel under pressure **shrinks before it collapses, and collapses before it
disappears**, which is nearly always what a person expects.

> **Discipline required.** Keep the required tier to containment, floors, and gaps. An
> over-constrained required set is how constraint systems become undebuggable.

---

## 8. How the solver works

Cassowary is an incremental solver for linear equality and inequality constraints with a strength
hierarchy, published by Badros, Borning, and Stuckey and documented by the University of Washington
constraints group [1][2]. It is the algorithm behind Apple's Auto Layout.

Two properties matter. It **accepts contradictions and resolves them by priority**: constraints are
either required or preferential, and an over-constrained preferential set is resolved by minimizing
weighted error [1]. And it is **incremental**: when a constraint changes, the dual simplex method
moves from an optimal-but-infeasible solution back to optimal-and-feasible rather than re-deriving
from scratch [1][2]. That is what makes dragging feel live and keeps unrelated panels from jumping.

### 8.1 Variables and constraints

Every panel contributes four real-valued variables, and every constraint is linear:

$$x,\; y,\; w,\; h \in \mathbb{R}$$

$$\sum_i a_i v_i + c \;\bowtie\; 0 \qquad \bowtie \;\in\; \{\,=,\; \le,\; \ge\,\}$$

Linear is the entire restriction: no products of variables, no trigonometry. Layout happens to be
almost entirely expressible this way, which is why the technique works at all.

| Intent | Constraint | Strength |
|---|---|---|
| Inside region, left and top | $x \ge R_{left}$, $y \ge R_{top}$ | required |
| Inside region, right and bottom | $x + w \le R_{right}$ | required |
| Compression floor | $w \ge w_{min}$ | required |
| Gap between neighbours | $x_2 - (x_1 + w_1) \ge g$ | required |
| Preferred size | $w = w_{pref}$ | strong medium |
| Alignment *(opt-in)* | $y_1 = y_2$ | medium |
| **Do not move unless necessary** | $x = x_{current}$ | **weak** |

**The last row is the quiet hero.** Stay constraints weakly assert that each variable keeps its
current value. Because the solver minimizes total weighted error, and moving a variable incurs error
against its stay, the solution that moves the fewest panels the least distance is the one it
prefers. That is the mechanism behind "adding one panel does not reshuffle the board," and a packing
algorithm cannot offer it, because packing has no memory of where things were.

### 8.2 What it minimizes

Constraints are ordered `required > strong > medium > weak`. Required constraints are inviolable.
Everything else is negotiable, and the solver minimizes total weighted violation across the soft set:

$$\min \sum_k s_k \cdot \varepsilon_k$$

where $s_k$ is the strength of constraint $k$ and $\varepsilon_k$ is how badly it is violated.

The reference JavaScript implementation packs a strength into a single scalar from three bands [3]:

$$\text{strength} = \text{clamp}(a)\cdot 10^6 + \text{clamp}(b)\cdot 10^3 + \text{clamp}(c)$$

| Name | Value |
|---|---|
| `required` | 1,001,001,000 |
| `strong` | 1,000,000 |
| `medium` | 1,000 |
| `weak` | 1 |

Three orders of magnitude of separation is what makes the hierarchy behave like a hierarchy rather
than a weighted average: one strong constraint outweighs any realistic number of medium ones.

**Mapping our tiers.** Priority 1000 maps to required. Priorities below map into a soft band, giving
a monotonic ordering where 750 genuinely outranks 250. Exact band placement is an implementation
choice to validate, since packing too many distinct priorities into one band erodes the separation
above.

### 8.3 Mechanically

Inequalities become equalities by absorbing the difference into a non-negative slack variable, where
the slack is the unused space. Soft constraints become equations with two non-negative error terms,
and the strength times those terms is added to the objective:

$$x + w \le 500 \;\longrightarrow\; x + w + s = 500,\quad s \ge 0$$

$$w = 200 \;\longrightarrow\; w + \delta^+ - \delta^- = 200,\quad \delta^+, \delta^- \ge 0$$

with $s \cdot (\delta^+ + \delta^-)$ added to the objective. Satisfying the preference exactly means
both error terms are zero; missing a 200 target by 44 costs the objective strength times 44.

Everything is held in a **tableau**, where each row expresses one basic variable in terms of the
remaining parametric ones:

$$v_{basic} = c + \sum_j a_j v_{param}$$

Reading a solution is then trivial: set the parametric variables to zero and read the constants. The
tableau is a ledger in which each row is balanced by one designated account, and **pivoting**
re-expresses the books so a different account does the balancing. The underlying finances never
change; only the bookkeeping perspective moves. That disciplined search over which accounts to
balance with is the simplex method [1].

The incremental part follows. When a constraint changes, the previous solution usually remains
optimal but becomes infeasible, because some variable now violates a bound. The **dual simplex**
restores feasibility while preserving optimality, typically in a handful of pivots rather than a full
re-solve [1][2]. Interactive dragging uses this directly: nominate a variable as an edit variable,
suggest a new value, and the dual simplex repairs everything around it.

### 8.4 The mechanical model

Required constraints are rigid struts: they do not bend, and a structure requiring two struts to
occupy the same space cannot be built. Soft constraints are springs, and strength is stiffness.
Release the assembly and it settles where total spring tension is lowest, subject to every strut
holding. The very weak springs tethering each panel to where it currently sits are why nothing
rearranges for no reason.

### 8.5 Honest limits

| Limit | Detail |
|---|---|
| **Linear only** | Aspect-ratio locks ($w = k \cdot h$) are fine. Genuinely non-linear goals such as area preservation are not expressible. |
| **Over-constrained systems fail rather than degrade** | Contradictory required constraints have no solution. Mitigation is discipline: keep required to containment, floors, and gaps. |
| **No debugging tooling exists** | No JavaScript port ships a conflict explainer or visualizer [3][6]. This is why the relaxation report is built first. |
| **Performance at our scale is unmeasured** | Published figures for this solver family are solver-against-solver microbenchmarks [3][5] and none isolate incremental edit cost. |

---

## 9. Where the solver stops and policy begins

Three panels in a 500 wide frame, gap 16, each preferring 200 wide with a 120 floor.

**Required:** $x_1 = 0$, $x_2 = x_1 + w_1 + 16$, $x_3 = x_2 + w_2 + 16$, $x_3 + w_3 \le 500$, and
$w_i \ge 120$ for all $i$.

**Strong:** $w_i = 200$ for all $i$.

Preferred total is $3(200) + 2(16) = 632 > 500$, so the strong constraints cannot all hold. Width
available after gaps is $500 - 32 = 468$, and three equal-strength preferences share the shortfall
evenly:

$$w_i = \frac{468}{3} = 156$$

Since $156 \ge 120$, every required constraint holds. The result carries three relaxations, each
reporting that a preferred width of 200 was applied as 156 because region width was exhausted among
three peers of equal priority.

**Now add a fourth panel.** Gaps become 48, available width 452, even share 113. But $113 < 120$, and
both the floor and containment are required. Two required constraints contradict, and **no solution
exists.**

> **This is the most important boundary in the design.** The solver's job ends where required
> constraints conflict, and the overflow strategy layer takes over: minimize the fourth panel,
> overlay it, or decline to place it, per policy. A solver that tried to resolve this internally
> would have to silently violate something, which is the exact behavior this pack exists to
> eliminate.

---

## 10. Configuration and scope

Policy resolves through the framework's cascade, later winning:

```
platform -> tenant -> embed -> frame context group -> panel
```

| Scope | Sets | Example |
|---|---|---|
| platform | Everything, as defaults | Ship sensible behavior |
| tenant | Everything | A tenant standardizes on `grid` |
| embed | Everything | A blog-post embed uses one column |
| frame, context, group | Everything | A site context uses `grid` inside a `flow` canvas |
| panel | Subset: `min`, `collapsible`, `priority` | This panel refuses to shrink below 240 |

A panel may not override the approach its frame has chosen. Approach is a property of the container.

> **Ship requirement: `explain(panelId)`.** Returns the resolution chain showing which scope
> contributed each field. Five scopes across many policy fields is a large space, and without this
> the support burden lands on whoever answers "why is this panel like that."

---

## 11. Renderer adapters

```
@<pack>/core pure geometry, no renderer, no framework
@<pack>/canvas reads and writes spatial shape props
@<pack>/dom CSS grid or transform placement
```

**Solved positions are written as ordinary properties, never opaque transforms.** Grid Style Sheets,
the closest prior art to this pack, positioned everything absolutely through transforms, which made
computed layout invisible to browser developer tools [15]. Inspectability is a requirement.

---

## 12. Landscape

Constraint-based layout is mature technology in every UI domain except this one.

| Domain | Status |
|---|---|
| **Native UI** | Solved. Apple's Auto Layout is Cassowary in production, and its priority, hugging, and compression-resistance vocabulary is what section 7 borrows [8][9]. |
| **Terminal UI** | Recently adopted. A maintained Rust Cassowary fork is the layout engine in the ratatui project [7]. Bounded space, arbitrary content, graceful degradation: the same problem shape as a bounded canvas. |
| **Web and DOM** | Tried and retreated. Grid Style Sheets compiled a CSS-like constraint language to Cassowary and was archived in 2019 [14][15]. |
| **Canvas** | Partially solved. Graph and tree layout ships. Flexbox on canvas ships too, via Yoga [23][24][39]. Priority-based degradation with an account of what was compromised does not exist. |

### Canvas and diagramming tooling surveyed

| Library or product | Automatic layout | Constraint + priority | Bounded overflow |
|---|---|:---:|:---:|
| tldraw | Manual placement with frames and snapping [16] | no | no |
| Figma, FigJam | Auto Layout on frames, described by Figma as a subset of flexbox [11]; per-axis constraints [12]; sections lack auto layout [13] | no | partial |
| Miro | Frames as organizational containers [18] | no | no |
| Adobe XD | Artboards and Repeat Grid [19] | no | no |
| Excalidraw | Frames with clipping [17] | no | no |
| Fabric.js *(MIT)* | Partial. The v6 group rewrite added a layout manager that recalculates the group bounding box and repositions children [20][21]. Not a flex or grid engine. | no | clip mask |
| Konva.js *(MIT)* | None. Scene graph only; clipping via container clip properties [22] | no | clip mask |
| PixiJS *(MIT)* | Yoga-powered flexbox via the official companion layout package, not core [23][24] | no | **yes** |
| Paper.js *(MIT)* | None [25] | no | clip mask |
| GoJS *(commercial)* | Large first-party layout family including grid, tree, force-directed, layered digraph and circular [26][27] | no | row wrap |
| mxGraph *(Apache 2.0)* | Stack, hierarchical, compact tree, circle and organic layouts. Development ended in 2020 [28][29] | no | no |
| JointJS *(MPL 2.0 core)* | None bundled in the open-source core; official layout packages ship in the commercial edition [30][31] | no | no |
| Cytoscape.js *(MIT)* | Core graph layouts including grid, circle, concentric, breadthfirst and cose [32] | no | no |
| react-grid-layout, gridstack, Muuri | Packing and compaction over an explicit coordinate model [33][34][35] | no | partial |
| elkjs, dagre | Graph and DAG layout algorithms [36][37][38] | no | no |

### Reading the survey honestly

Three of these are the strongest existing art. **GoJS** and **mxGraph** both ship genuine layout
engine families [26][28], so automatic layout on canvas is not unprecedented. And **PixiJS Layout**
is the closest prior art of all: an official companion package running Yoga, the same engine behind
React Native, to do real flexbox on canvas including a CSS-like overflow property with `hidden` and
`scroll` [23][24][39]. Someone has already put a CSS layout engine on a canvas and shipped it.

So the differentiation is narrower than it first appears. **We are not claiming flexbox on canvas is
new, because it is not.** What none of these ship is a constraint solver with a priority hierarchy:
something that accepts contradictory requirements, resolves them by strength, degrades gracefully
when a bounded region runs out of space, and reports what it compromised. Their algorithms compute
positions for nodes in a graph or boxes in a flex tree. They have no notion of a requirement that
loses to a stronger one.

The dashboard grid libraries come closest to the panel case, with an explicit coordinate model and
collision handling, but they have no priority model, no minimal-perturbation re-solve, and no world
coordinate space. A dedicated search for any canvas or diagramming library, commercial or open
source, shipping Cassowary-style priority constraints returned nothing. The technique is documented
and has live JavaScript ports [3][5][6]; it has simply never been integrated into a canvas layout
product.

### Why the gap exists

This matters more than the gap itself. Canvas tools were built for a human holding a mouse, so
layout automation was never the product, because the user *is* the layout engine. That assumption
breaks the moment several panels arrive at once with nobody deciding where they go, which is the case
an agent, an A2UI payload, or an application generating its own interface all produce.

> **Stated precisely:** graph layout on canvas is solved, flexbox on canvas is solved, and what does
> not exist as a product feature or a reusable engine is priority-degrading,
> per-scope-configurable layout that reports its own compromises. Every component is proven in
> another domain, which makes this an integration and packaging effort rather than a research
> project, provided the performance gate is honored.

---

## 13. Sourcing

The intended solver dependency is `lume/kiwi`, a maintained fork under a BSD-3 license [3], pinned
to a known-good commit. The original `kiwi.js` was archived in December 2021 [4], and
`cassowary.js`, despite being the most-starred JavaScript port, remains at an early version with a
self-declared unstable API [6]. Both trace to the same C++ reference implementation [5]. If a
WebAssembly path becomes attractive later, `kasuari` under the ratatui organization is the actively
maintained Rust option [7].

---

## 14. Success criteria

### Functional, as property tests

- No resolved rect escapes the region when mode is `bounded` or `locked`, for any input
- Identical inputs produce identical outputs. Deterministic, no simulation settling
- Any intent not fully honored appears in the relaxation list
- Every overflow action appears in the action list
- `explain(panelId)` returns a complete scope resolution chain

### Tracked metrics

| Metric | Target |
|---|---|
| Lines of config for a correct default layout | 0 |
| Lines to change grow direction or column count | 1 |
| Package size, gzipped | *placeholder* |
| Solve time at realistic panel counts | *placeholder* |
| Incremental re-solve on drag | *placeholder* |

> **Three numbers are deliberately unset.** Package size, solve time, and incremental re-solve cost
> are open rather than estimated. All three depend on realistic panel counts per canvas from product
> usage, which is the first thing to measure because it gates the other two and decides whether the
> solver approach is accepted at all.

---

## 15. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Solver performance unvalidated at our scale** | high | Widely cited speed figures for this solver family are solver-against-solver microbenchmarks [3][5] and none isolate incremental edit cost. The solver ships behind a benchmark gate; the three deterministic approaches carry the product without it. |
| **No conflict debugging tooling in any JavaScript port** | high | The relaxation report is built first rather than last, and the required tier is limited to containment, floors, and gaps. |
| **Two substrates, one pack** | medium | Spatial canvas and DOM regions are genuinely different; one adapter interface may serve neither well. Build the spatial adapter first, then the DOM adapter, and let the second reshape the interface while the pack is young. |
| **Scope resolution complexity** | medium | Five scopes across many policy fields is a large space. `explain` is a ship requirement, not a follow-up. |
| **Repeating the Grid Style Sheets failure** | medium | GSS positioned everything through opaque transforms, making computed layout invisible to developer tools [15]. Solved positions here are written as ordinary properties. |
| **Retrofitting bidirectional layout later** | medium | Figma has publicly described years of subtle bugs from assuming a single top-down pass and later adding bidirectional dependency [10]. Bidirectional is first-class from day one. |

---

## 16. Open questions

| # | Question | Notes |
|---|---|---|
| 1 | **Name** | `lattice` reads as an ordered structure things occupy, is spatial rather than document-flavored, and does not collide with a major project in this space. Not confirmed. |
| 2 | **Should the spatial engine also become a pack**, leaving core substrate-agnostic? | Layout and DOM are already separating. Making the spatial engine a peer pack leaves core as pure composition, the cleanest end state and cheapest now, while there is one production consumer. |
| 3 | **One adapter interface for both substrates, or one each?** | Depends how far the DOM case diverges. |
| 4 | **Which approach is the default** for a bounded embed with no config? | `grid` is more predictable; `flow` is more forgiving of unknown content sizes. |
| 5 | **Does `pack` earn a distinct approach**, or is it a mode of `grid`? | |
| 6 | **Real panel counts per canvas** | Blocks the performance gate and the virtualization threshold. First thing to measure. |

---

## References

Sources were retrieved and verified rather than recalled.

1. Badros, Borning, Stuckey. *The Cassowary Linear Arithmetic Constraint Solving Algorithm.* ACM TOCHI. <http://badros.com/greg/papers/cassowary-tochi.pdf>
2. Cassowary Constraint Solving Toolkit, University of Washington. <https://constraints.cs.washington.edu/cassowary/>
3. lume/kiwi, maintained TypeScript Cassowary solver. <https://github.com/lume/kiwi>
4. kiwi.js, archived December 2021. <https://github.com/IjzerenHein/kiwi.js/>
5. nucleic/kiwi, the C++ reference implementation. <https://github.com/nucleic/kiwi>
6. cassowary.js. <https://github.com/slightlyoff/cassowary.js/>
7. kasuari, Cassowary fork used by ratatui. <https://github.com/ratatui/kasuari>
8. Apple Developer, *UILayoutPriority.* <https://developer.apple.com/documentation/uikit/uilayoutpriority>
9. Apple Developer, *NSLayoutConstraint.priority.* <https://developer.apple.com/documentation/uikit/nslayoutconstraint/priority>
10. Figma, *Behind the feature: the making of the new auto layout.* <https://www.figma.com/blog/behind-the-feature-the-making-of-the-new-auto-layout/>
11. Figma Help Center, *Auto layout fundamentals.* <https://help.figma.com/hc/en-us/articles/31351261703063-FD4B-Auto-layout-fundamentals>
12. Figma Help Center, *Apply constraints to define how layers resize.* <https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize>
13. Figma community forum, feature request: auto layout for sections. <https://forum.figma.com/suggest-a-feature-11/add-auto-layout-to-sections-25807/index3.html>
14. Grid Style Sheets, archived 2019. <https://github.com/gss/gss>
15. Raygun, *Next-gen constraint layouts in the browser: Grid Style Sheets.* <https://raygun.com/blog/next-gen-constraint-layouts-browser-grid-style-sheets/>
16. tldraw SDK reference, *TLFrameShape.* <https://tldraw.dev/reference/tlschema/TLFrameShape>
17. Excalidraw developer docs, *Frames.* <https://docs.excalidraw.com/docs/codebase/frames>
18. Miro Help Center, *Frames.* <https://help.miro.com/hc/en-us/articles/360018261813-Frames>
19. Adobe, *Create repeating elements with Repeat Grid in XD.* <https://helpx.adobe.com/xd/help/create-repeating-elements.html>
20. Fabric.js issue 7670, *v6 Group rewrite.* <https://github.com/fabricjs/fabric.js/issues/7670>
21. Fabric.js discussion 10148, *Group layout.* <https://github.com/fabricjs/fabric.js/discussions/10148>
22. Konva API reference, *Konva.Container.* <https://konvajs.org/api/Konva.Container.html>
23. PixiJS Layout. <https://github.com/pixijs/layout>
24. PixiJS, *Layout v3.* <https://pixijs.com/blog/layout-v3>
25. Paper.js download and license. <https://paperjs.org/download/>
26. GoJS API reference, *Layout.* <https://gojs.net/latest/api/symbols/Layout.html>
27. Northwoods Software, GoJS licensing. <https://nwoods.com/sales?p=GoJS>
28. jgraph/mxgraph. <https://github.com/jgraph/mxgraph>
29. maxGraph discussion 64, mxGraph end of life and successor status. <https://github.com/maxGraph/maxGraph/discussions/64>
30. JointJS licensing. <https://www.jointjs.com/license>
31. JointJS docs, *Automatic layouts.* <https://docs.jointjs.com/learn/features/automatic-layouts/>
32. Cytoscape.js. <https://js.cytoscape.org/>
33. react-grid-layout. <https://github.com/react-grid-layout/react-grid-layout>
34. gridstack.js. <https://github.com/gridstack/gridstack.js>
35. Muuri. <https://github.com/haltu/muuri>
36. dagre. <https://github.com/dagrejs/dagre>
37. elkjs. <https://github.com/kieler/elkjs>
38. Eclipse Layout Kernel. <https://eclipse.dev/elk/>
39. Yoga layout engine. <https://github.com/facebook/yoga>
