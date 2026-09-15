# EasyCraft — builder response to the review package

**Repository:** `lzmediaspirit-hue/EasyCraft`
**Branch:** `claude/carpenter-app-brainstorm-ym2doc`
**Result commits:** `44ca060`, `dad8360`, `4eb783b`
**Reviewed baseline:** `71b205afea1602468a34a52fdd42567c32b2d9fb`
**Responds to:** `EasyCraft-review.md` (R1–R15), `EasyCraft-product-architecture-review.md`
(N1–N11), `EasyCraft-planner-review.md` (V1–V7),
`EasyCraft-library-materials-bug-review.md` (C1–C6), and
`EasyCraft-materials-planner-design-review.md` (the owner's design requirements,
tracked here as D1–D4).

This document is written for the reviewer. It states what changed, where, how it
was verified, and what is still open. Where a claim is not backed by a test in
this repository, it says so.

---

## 1. Files actually read

The reviewer asked the builder to declare what it inspected rather than assume
access. This is that declaration.

| File | Delivered as | SHA-256 | Notes |
|---|---|---|---|
| `EasyCraft-complete-builder-review.zip` | attachment in the builder's conversation | `3ffc7d94c81f1286f3d609a42fac8bb9cfcf09795daa74c8e7df811557d0ee97` | The review package. All eight documents and the evidence folders were read. |
| `easycraft_catalog_he.xlsx` | attachment in the builder's conversation | `1c8b75e1dfc34eda97fbe2298405b36158780f15707c3a9f768d1bb4f44761d8` (18,503 bytes) | The owner's cabinet library. |

**What the spreadsheet contained.** 94 rows in one sheet: 61 marked active and 33
marked removed. 70 rows corresponded to entries that shipped with the app (matched
by key) and 24 were the owner's own. Columns carried name, room, category, default
width/height/depth, width options, socle, countertop, and a prose column
("מבנה ומאפיינים") describing construction.

**What was converted.** `src/catalog/shipped.ts` now holds the 61 active entries:
61 unique ids, 61 unique part numbers, no duplicate name+group+width triples.
Part-number prefixes: B (base) 23, U (upper) 14, S (storage) 9, T (tall) 9,
P (panel) 6. For the 70 rows that matched shipped entries, the full construction
record was taken from the previous `builtins.ts` by key, so nothing was inferred.
For the 24 owner-authored rows, construction was reconstructed from the prose
column.

**What the spreadsheet did not contain, and was therefore not invented.** No
finish or material assignments, no handle/LED/exposed-panel flags, no edge-band
data, no images. Those fields are absent in the converted entries rather than
guessed. The lossless path remains the one the review describes: an app-generated
library export (now carrying a manifest, see D4) regenerated through
`scripts/library-to-seed.mjs`. The owner has been told this in their own language.

**Two items left to the owner, not decided by the builder.** Two different
cabinets are both named "ארגז תנור" (`B-136` the owner's, `B-110` the app's) and
are otherwise identical in room, group and width, so they are indistinguishable in
the grid. And none of the six panel entries uses the panel glyph, which is the only
marker for cladding — so no entry currently stands in front of a wall lining.

---

## 2. Status of the earlier findings

All 41 earlier findings (R1–R15, N1–N11, V1–V7, C1–C6) were addressed in commits
`87807d7`, `79dbbef`, `774ac72`, `ee9ddc7`, `7286dbe`, `62d1eba`, which precede
this batch. Before starting the new work they were each re-read against the
current source. The table below is that audit, not a restatement of the original
claim. **These are implementation statuses. None is "verified fixed" until the
reviewer repeats the reproduction.**

| ID | Where it now lives | What holds today |
|---|---|---|
| R1 | `workflow/useMember.ts:20-27` | The live query drops a session whose member is inactive or missing, and calls `session.signOut()`. |
| R2 | `workflow/auth.ts:125-134` | Seeding tests for an empty team, not for a member named `admin`. Renaming no longer recreates the account. The default-password warning is deliberately retained. |
| R3 | `db/backup.ts:readBackup` | Kind, format, required tables, array-ness and per-row ids are all validated before any write. |
| R4 | `features/design/history.ts:restore` | Undo/redo restores units and then runs `syncConsumption`, so stock follows the work marks. |
| R5 | `materials/consumption.ts:125,169,189` | Read-modify-write on shared stock rows runs inside a Dexie transaction. |
| R6 | `features/projects/projectsRepo.ts:applyPlan` | Every placement is resolved through `planMatch.matchCatalog` first; a missing reference returns `{ok:false, missing}` and the design is left intact. |
| R7 | `costing/boards.ts:781-785` | A deleted material reference counts its parts as unpriced instead of silently costing zero. |
| R8 | `features/settings/BackupSheet.tsx` | `finally { setBusy(false) }` on both import paths, with the failure reason shown. |
| R9 | `catalog/catalogRepo.ts:reseed` | Seeding runs once on an empty table. Restoring shipped entries is an explicit button. |
| R10 | `settings/SettingsScreen.tsx:307`, `projectsRepo.ts:361` | Both write and read `defaults.backKind`. |
| R11 | `workflow/unitWork.ts:182-185` | Completion compares against each track's own terminal stage. |
| R12 | `projectsRepo.ts:456-470` | Unit duplication drops `work`. |
| R13 | `ui/QuickCalc.tsx:114` | `\|\.\d+` accepts a leading decimal point; unmatched characters reject rather than being dropped. |
| R14 | `features/design/analysis.ts:57-74` | Overflow is measured from positioned bounds, not summed widths. |
| R15 | `tests/_all.sh` | Exit code is checked first, then failure text; a missing file fails the run. |
| N1 | `costing/boards.ts:partThicknessMm` | One resolver, keyed by the chosen board, used by both the parts engine and `isoScene`. |
| N2 | `features/design/DesignScreen.tsx:196-201` | `workMode` is false before the sale, so a planner with a grant can edit. |
| N3 | `workflow/unitWork.ts:122-133` | Production stages are refused while the project is unsold. |
| N4 | `features/projects/SaleSheet.tsx:85` | Paid rows survive a plan change. |
| N5 | `costing/pricing.ts:55-70` | One payable amount, VAT-inclusive, across materials, quote and payments. |
| N6 | `costing/pricing.ts:paymentStatus` | The balance is measured against the sale price, not against the schedule. |
| N7 | `SaveGroupSheet.tsx:29-47`, `projectsRepo.ts:327` | Group insertion anchors on `defaultYMm + dyMm`. |
| N8 | `workflow/workflowRepo.ts:ensure` | Read and write in one transaction, plus repair of already-duplicated rows. |
| N9 | `features/design/DepthSheet.tsx:43` | Hint, input and shortcuts all go through `unitLabel()`/`fromMm`. |
| N10 | `SaveToLibrarySheet.tsx:60-62` | A placed unit can become a new entry without its source; only catalog metadata is derived. |
| N11 | `scripts/build-single.mjs:41` | The standalone file carries the mobile viewport meta. |
| V1 | `WallIso.tsx:343-372` | Companions are captured at drag start and the whole group is bounds-checked before it moves. |
| V2 | `isoMath.ts:orderSolids` | Cabinet-local separation across different frames; covered by `_ray`/`_rayrot`. |
| V3 | `isoScene.ts:246-257` | Exposed panels shrink the carcass, matching `boards.ts`. |
| V4 | `isoScene.ts:232`, `DesignScreen` | Effective finishes are resolved from project defaults before drawing. |
| V5 | `isoScene.ts:325` | The back resolves its own role through `hexOf('back', …)`. |
| V6 | `WallElevation.tsx:200-213` | A free unit's elevation drag writes floor coordinates; wall x/y are untouched. |
| V7 | `isoScene.ts:147` | Unit geometry is included in the scene bounds. |
| C1 | `CustomItemSheet.tsx:90,118` | `drawerStyle` initialises from the stored item and is persisted. |
| C2 | `CustomItemSheet.tsx:96-97,132-133` | Socle and countertop default to `0` and are always sent, so zero persists. |
| C3 | `db/types.ts:reusableSpec` + `REUSABLE_FIELDS` | One shared field list carries `omit`, `glassSides`, drawer construction and the rest through placed unit → template → placed unit. |
| C4 | `db/backup.ts:exportLibrary/importLibrary` | The dependency closure travels with the library; import is transactional, matches by part number, and reports unresolved references. |
| C5 | `ui/Sheet.tsx:50-87` | Initial focus, a Tab boundary, Escape on the topmost sheet only, and focus returned to the opener. |
| C6 | `catalogRepo.forRoom`, `LibrarySheet.tsx:82` | Room eligibility is a filter of its own; favourites are independent of it. |

---

## 3. This batch — D1 to D4

### D1 — Corner snapping when a cabinet is placed on another

**Before.** `snapX` and `snapY` solved each axis on its own. `snapY` offered a
neighbour's top edge, so a cabinet dropped on another landed at the right height
and at an arbitrary horizontal position. `snapX` offered butt-join edges
(`other.x + width(other)` and `other.x − width(self)`) but never
`other.x` or `other.x + width(other) − width(self)` — the two corner alignments the
review asks for. The combined placement did not exist.

**Change.** New module `src/features/design/stacking.ts`, ~100 lines, with no UI
and no rendering:

- `supportTopMm(u)` = `yMm + heightMm + (counterMm ?? 0)`. The countertop is part
  of the support surface, so a cabinet placed on a base unit with a 40 mm counter
  lands at 920, not 880.
- `stackSnap(unit, x, y, mates, tol, holdId)` returns one corner or `null`. Both
  coordinates are solved together against a single target. The two candidates are
  start-aligned (`other.x`) and end-aligned (`other.x + w(other) − w(self)`),
  scored by `hypot(dx, dy)`.
- Hysteresis: the target already held in this drag has its distance scaled by
  0.6, so it does not flicker between two equidistant neighbours.
- Free-standing units return `null` (see limits).

Wired into both planners through the two existing drag solvers, so 2D and 3D use
the same arithmetic: `WallElevation.tsx` (elevation drag) and `dragSolve.ts`
(3D drag, whose return type became `{patch, onId}`). Stacking is tried before
ordinary snapping; anything it does not claim falls through to the previous
behaviour unchanged. Collision is checked after snapping, by the existing
`blocked()` path.

**Ghost, guides and target name.** New `src/features/design/dragGuide.tsx` draws,
during the drag: a dashed line along the support surface, a dashed line at the
aligned corner, a translucent ghost at the landing position, and a label naming
the target and the corner — e.g. `על ארגז כיריים · פינת ההתחלה`. In 3D the target
is named in a badge (`נוחת על <name>`); a full 3D ghost is not drawn (see limits).

**Snap bypass.** A magnet toggle in the planner toolbar. Turning it off passes
`tol = 0` into both solvers, which disables every snap target while keeping the
10 mm rounding. This is a toggle rather than a held modifier because touch has no
modifier key.

**Floor lock.** Dragging a floor-locked cabinet upward now says so on the canvas —
`נעול לרצפה — כבה את הנעילה בעריכת הארגז כדי להרים` — instead of moving sideways
without explanation.

**Test.** `tests/l112.mjs`, 14 checks, real browser and real IndexedDB. Ten are
arithmetic, including the review's own acceptance example verbatim (lower
x=500 w=800 h=880, upper w=600 → start 500/880, end 700/880), the countertop case,
equal widths, out-of-range rejection on both axes, island rejection, floor
rejection, and target stability. Four are a real pointer drag on the elevation:
the guide text appears, and the persisted row reads `x=500, y=880`.

### D2 — Planner controls

**Before.** One button labelled with the current state ("שטוח") whose action opened
3D; top view lived in a separate button; no snap control; no view-reset in the
toolbar; no numeric horizontal placement; icon stroke weights ranged 1.6–2.4 across
53 icons.

**Change.**

- An explicit three-way mode selector — **חזית / תלת־ממד / מבט על** — with
  `aria-pressed` on the active mode and 44 px minimum touch height. Top view
  remains a sheet; having it open *is* that mode.
- The snap toggle described in D1, labelled, with an explanatory title.
- **התאמת תצוגה** in the toolbar (3D only), which resets the camera to the angle
  facing the active wall. The camera state stays inside `WallIso`; a changing
  `fitAt` prop carries the request in. This is a view action and is deliberately
  separate from **מרכוז**, which moves cabinets.
- Numeric placement: `UnitEditSheet` gains **מתחילת הקיר** alongside the existing
  height field, bounded by wall length minus cabinet width.
- `src/ui/icons.tsx` rewritten around one `icon()` wrapper that fixes view box,
  stroke weight (1.8; 1.6 for the 32×32 room family), caps and joins. Only
  single-stroke glyphs (plus, minus, close, check, chevrons) override the weight.
  Five icons were added: elevation, magnet, fit-view, a dimension line, and a
  finish swatch that replaces the price tag on "גוון לכולם" — the review notes
  the tag reads as pricing.
- The two ruler tools no longer share a glyph. **סרגל** (distance between two
  things) keeps the ruler; **מדידה** (dimension overlay on every cabinet) gets the
  new dimension line. The two eyes were also separated: restoring hidden cabinets
  uses the struck-through eye.
- The review also asks for the customer preview to be a labelled action rather
  than an eye alone. **Not done, deliberately.** An earlier layer removed that
  labelled button from the toolbar at the owner's explicit request; it is an icon
  in the header corner and `l44` guards that. Its accessible name and tooltip both
  read "הדמיה ללקוח", so it is reachable by name and by voice — what distinguishes
  it from the other eye on the screen is its position, not its shape.
- The flat mode is labelled **דו־ממד**, not "חזית". A first pass used "חזית" and
  produced two different controls with the same accessible name in one toolbar —
  the fronts/interior toggle is already called that. A probe over every button's
  accessible name on the planner screen now reports no duplicates.

Not done in this batch: the desktop three-pane workspace and the resizable mobile
inspector. See limits.

### D3 — One board specification, and availability separated from price

**Before.** `finish.prices[materialId] !== undefined` was the availability test in
seven places, so a board the workshop stocks but has not priced disappeared from
the picker. A board line with no price contributed 0 to the quote and was not
counted in `unpricedParts`, so an incomplete quote presented itself as complete.
Sheet width was the constant `SHEET_WIDTH_MM` and was rewritten on every material
save, discarding an imported width.

**Change.**

- `src/materials/boardSpec.ts`: `boardSpec(finish, material, role)` resolves one
  description — finish name and swatch, texture, grain, core and core colour,
  thickness, sheet width × length, the role being edited, and price — plus a
  three-state `BoardStatus`: `priced`, `unpriced` (offered, no price yet), or
  `missing` (not offered on this board).
- `src/ui/BoardCard.tsx` renders it under the selected row in `PartChoiceRow`,
  where the carpenter actually chooses.
- `FinishSheet` gets an explicit **מגיע / לא מגיע** switch per board. A price typed
  in still implies availability, so nothing regresses for existing data; an
  available board with no price stores `{}` and is flagged
  "זמין בלי מחיר". Existing rows migrate implicitly: a stored price means offered.
- `boards.ts` counts the parts of a price-less board line into `unpricedParts` and
  marks the line `unpriced`, so the existing incomplete-quote warning fires.
- `MaterialSheet` keeps `material.sheetWidthMm`, offers four common widths plus a
  free numeric field, and shows the resolved sheet size. Any width already on the
  record is added to the choices so an imported size is never silently dropped.

Not done in this batch: sample-photograph textures with scale and orientation,
supplier codes, edge-band records. See limits.

### D4 — A manifest on the library package

**Before.** A library export was a bag of rows. The receiving carpenter pressed
import and found out afterwards what had arrived.

**Change.** `BACKUP_FORMAT` is 3. A library export carries
`manifest: {items, materials, finishes, codes[], revision}`, where `revision` is
the newest `updatedAt` among the entries — so two packages from the same workshop
can be ordered without comparing rows. `libraryManifest(backup)` reads it, and
reconstructs it by counting for a format-1 or format-2 file, so older packages are
still readable before import. The backup screen now states, before anything is
written: file name, entry count, finish and material counts, and revision date.

Import behaviour is unchanged from the C4 fix: transactional, matched by part
number, dependencies first, unresolved references reported.

---

## 4. Code pass

Alongside the four items above: `icons.tsx` rebuilt on a single wrapper (53 icons,
one definition of the drawing contract); the drag guide extracted from
`WallElevation.tsx` (1,100 → 1,000 lines) into `dragGuide.tsx`; five in-file-only
helpers un-exported (`shippedLibrary`, `prefixOf`, `aisleAdvice`, `isOffered`,
`boardStatus`). A scan for exported-but-unreferenced values now returns only
`BACKUP_FORMAT`, which is kept as the documented format contract.

`src/db/types.ts` (1,262 lines) still mixes placed-unit, material and room models.
Splitting it touches roughly forty import sites and was judged too large to
combine with a behavioural batch. It is a known debt, not an oversight.

---

## 5. Validation

- **Typecheck:** `npx tsc --noEmit` — clean.
- **Production build:** `npm run build` — clean.
- **Standalone build:** `npm run build:single` — 868 KB, ASCII only.
- **Browser suites:** `npm test` — **84 of 84 passing, exit 0**, on commit
  `4eb783b`. The runner checks exit status before output text, per R15.
- **New coverage:** `tests/l112.mjs` (14 checks) for D1, and two added checks in
  `l99` for the price-less board rule in D3.

### What the first full run caught

The first complete run after this batch failed 20 of 84 suites. All twenty were
this batch's doing, and they are reported here rather than quietly fixed:

- **19 suites keyed on the old button text.** The mode control used to be labelled
  with the current state ("שטוח"), so fifteen suites clicked "שטוח" to *enter* 3D
  and four clicked "תלת־ממד" to *leave* it. Under the new selector each button
  names its destination, so both sets were updated. `l60` no longer asserts that a
  button with a particular name exists; it asserts that the right mode is
  `aria-pressed`, which is the question it was actually asking.
- **`l99` encoded the old pricing rule.** Its positive control costed a cabinet
  with a board but no finish and required zero unpriced parts. Under D3 that is
  now counted as unpriced, which is correct — a board cannot be priced without
  knowing its finish. The control was given a priced finish, and two checks were
  added for the new state itself: an available-but-unpriced board is still cut,
  and is still counted as unpriced.
- **`l44` caught a real mistake.** This document's D2 section originally described
  giving the customer-preview action a visible label, as the design review asks.
  An earlier layer had deliberately removed that button from the toolbar at the
  owner's explicit request, and `l44` guards it. The owner's instruction takes
  precedence over the review's suggestion: the action is an icon in the header
  corner, and what distinguishes it is its position, not its shape. Reverted, with
  the reason recorded next to the code.
- **`l105` needs the standalone file on disk.** It reads `dist/easycraft.html` —
  that *is* the N11 check — and a plain `npm run build` removes it. Not a defect;
  the dependency is now written down in `tests/README.md`.

- **Neighbouring suites also re-run individually during the work:** `l37` (drag
  into a gap, the closest existing behaviour to stacking), `l98` (backup and
  library round-trip, 23 checks), `l99c` (import failure handling), `l17`, `l43`,
  `l46` (materials and finishes).

---

## 6. Known limits

These are stated rather than implied.

1. **Free-standing units do not stack.** `stackSnap` returns `null` for them. A
   free unit moves on the floor plane and there is no vertical drag interaction
   for it yet; adding one is its own piece of work.
2. **3D shows the target name, not a ghost.** The alignment guides and the ghost
   rectangle are drawn in the elevation only. Drawing them on a rotated face in
   the isometric view was judged more misleading than helpful without more work.
3. **Rotated and unequal-depth stacking is arithmetic-only.** `alongWallMm`
   accounts for rotation, so the corner maths is correct for a turned cabinet, but
   no test covers a rotated or unequal-depth stack. The review asks for that
   coverage and it is not here.
4. **No touch-input test.** `l112` drives a mouse. Touch and screen-scale
   variations are untested.
5. **The planner workspace redesign is not done.** No desktop three-pane layout, no
   resizable mobile inspector. Only the mode, snap, fit and numeric-placement
   controls from that section were implemented.
6. **Material realism is not done.** No sample photographs, texture scale,
   supplier codes or edge-band records. The board card falls back to flat colour,
   which is what the data supports today.
7. **Undo of a stacked placement** uses the existing per-drag history tag, so one
   drag is one undo step. This was not separately tested for the stacking path.
8. **Availability migration is implicit.** Existing finishes are treated as
   offered wherever a price exists. A board that was offered and unpriced before
   this change did not exist as a state, so there is nothing to migrate — but a
   reviewer checking old data should know the rule.
9. **The security posture is unchanged and deliberate.** The app seeds
   `admin` / `admin2026`, both the login and team screens warn until the password
   is changed, and the data sits unencrypted in IndexedDB. This is a starting
   point, not protection, and it is documented as such in `README.md` and
   `AGENTS.md`.

---

## 7. What would help most from the next review pass

- Replay the D1 acceptance example and try to break it: rotated cabinets, unequal
  depths, a countertop present, two candidates at equal distance, and cancel
  mid-drag.
- Check that turning snapping off really disables every target and not only
  stacking.
- Check the D3 quote path with a board that is available and unpriced, and confirm
  the quote reports itself incomplete rather than cheap.
- Re-run the C4 transfer reproduction against the format-3 export and confirm the
  manifest matches what actually lands.
