# player/: step player UI

**Owner:** Smit

`StepPlayer`, `DiagramPanel`, `PartsTray`, `PlaybackBar`, `StepNav`, `ConfidenceBanner`, `InfoStep`, sub-assembly card, `ReanalyzeButton`.
Never imports three.js; renders `<AssemblyScene>` via `next/dynamic` with `ssr: false`. Task SMI-03, SMI-08.
