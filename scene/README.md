# scene/: 3D engine

**Owner:** Ajit

Pure (`.ts`, tested): `layout.ts` (snapLayout), `buildSceneManual.ts`, `geometry.ts`, `resolveScene.ts`, `tracks.ts`, `traps.ts`, `consistency.ts`.
Render (`.tsx`): `AssemblyScene`, `PartMesh`, `MotionGuide`, `CameraRig`, `Ghost`, `FeatureMarker`.
Rules: never fetch, never throw on bad data. Written fresh; see `reference/prototype/src/scene/` for behaviour only.
