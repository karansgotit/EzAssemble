# KALLAX Assembly Studio

A local, front-end-only prototype that pairs 19 original manual diagrams with an animated, interactive 3D KALLAX 2×4 assembly. All step data is handwritten. No AI service, backend, authentication, database, analytics, remote fonts, textures, or environment maps are used.

## Run

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm test           # 24 deterministic schema, geometry, and animation tests
npm run build      # strict TypeScript check and production build
npm run preview    # serve the production build locally
```

React 19.2, Fiber 9.4, and Drei 10.7 are pinned together. The lockfile captures the complete tested dependency tree. Use `npm ci` for a reproducible installation.

## Use

- Guide: select any of the 19 numbered steps, or use Previous / Next.
- Drag the model to orbit; scroll to zoom. Reset view frames the current action again.
- Play/pause, replay, scrub the timeline, and choose 0.5×, 1×, or 2× speed.
- Keyboard: left/right arrows change steps, Space toggles playback, R replays. Form inputs and dialogs keep their normal keyboard behavior.
- The orientation demonstration appears on the first visit to steps 1 and 13. “Show the common mistake” replays it.
- Click a manual image to enlarge it. Escape closes the lightbox.
- Step 12 demonstrates low confidence. Its AI wording is illustrative; no AI is connected.
- Steps 16–19 use a larger diagram and hide the 3D view and playback controls.
- Verb gallery demonstrates insert, screw, lock, attach, place, stand-up flip, and the orientation ghost using the same resolver and animation code.
- Scene settings controls hardware scale, global speed, axes, motion guides, and feature markers.

## Manual crops

All 19 supplied crops are already included. Replace them in `public/crops/` using these names:

```text
step-01.png … step-19.png
```

Missing images show an intentional placeholder with the required filename. Images are loaded locally from `/crops/step-NN.png`.

## Edit the fixture

Edit `src/fixtures/kallax.json`. Each part has an id, geometry, quantity, and optional face features. Steps contain an instruction, ordered actions, confidence, and optional orientation trap. Every action refers to part ids; hardware uses `target`, `face`, and usually `for` to identify its receiving joint. Hardware dimensions are millimetres; panel sizes and home positions are centimetres.

The floor frame uses +x along the 147 cm length, +y upward through the 39 cm depth, and +z across the 77 cm width. Panel poses stay in that frame. Standing up uses a parent quaternion transform, preserving the floor-frame instance data and keeping the assembly above the floor throughout the rotation.

Zod validates the fixture on load. `checkManual` reports invalid references, quantity overruns, incompatible verbs, empty assembly steps, missing geometry, and invalid orientation traps. Problems produce a red error screen with readable messages. Run `npm test` after edits. Changing the original 22-dowel / 8-screw totals intentionally fails the fixture tests.

## Code map

```text
src/
  main.tsx, App.tsx, styles.css
  schema/
    parts.ts, step.ts, manual.ts
  fixtures/
    kallax.json
  scene/
    AssemblyScene.tsx     public scene contract and frame clock
    resolveScene.ts       pure instance expansion and joint placement
    tracks.ts             pure track construction and time sampling
    geometry.ts           face rectangles, projections, bounds, quaternions
    PartMesh.tsx, FeatureMarker.tsx, Ghost.tsx, MotionGuide.tsx
    CameraRig.tsx, constants.ts
  player/
    StepPlayer.tsx, DiagramPanel.tsx, StepNav.tsx, PlaybackBar.tsx
    ConfidenceBanner.tsx, PartsTray.tsx, InfoStep.tsx, Icon.tsx
  dev/
    VerbGallery.tsx, galleryManual.ts, DevPanel.tsx
tests/
  schema.test.ts, resolveScene.test.ts, tracks.test.ts
public/
  favicon.svg
  crops/step-01.png … step-19.png
```

`scene/` owns Three.js. `player/` owns controls and layout and never imports Three.js. The scene accepts the documented playback props plus optional `options` and `resetKey`. `resolveScene` additionally returns the assembly parent pose. `buildTracks` consumes resolver states and uses the resolved action-to-instance mapping. Cylinder spins are represented separately from their Euler orientation so screws and locks rotate about their local insertion axis.

A receiving panel with no explicit place action (L1 in step 1) becomes the foundation as soon as referenced. Hardware actions claim instances in order; locks reuse the latest inserted instances. Re-entering a step reconstructs its state without accumulated motion.

## Scope and verification

The prototype follows the vertical branch of manual AA-1055145-11. Panel thicknesses, hardware dimensions, and step 1's timing for E2 are approximations from the supplied brief. Tools, felt pads, and wall hardware are instruction/diagram details rather than 3D models. Panels and hardware use simple boxes and cylinders with no textures. WebGL is required for the 3D canvas.

Verified: production build; 24 passing unit tests; all 19 images and guide states; all seven gallery demos; step 12 confidence banner; diagram-only steps 16–19; stand-up pose; keyboard step navigation; scrubbing; lightbox open/Escape close; desktop and small-screen layouts without horizontal overflow; no browser errors after the compatibility fix.
