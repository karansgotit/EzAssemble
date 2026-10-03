# reference/: look, don't copy

`prototype/` is the visual prototype built before the hackathon (Vite + React + R3F). It shows the intended look, the animation behaviour and working algorithms for the KALLAX 2×4 manual.

**Rules (D-17):**
- **Never copy, move or import its files** into the app. Everything is written fresh against `docs/CONTRACTS.md`.
- Its *data* (`prototype/src/fixtures/kallax.json`) may be converted into gold fixtures (KAR-02).
- It's excluded from the app's TypeScript, tests and build (SMI-01).

To run it:

```bash
cd reference/prototype && npm install && npm run dev
```
