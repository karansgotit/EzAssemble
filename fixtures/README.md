# fixtures/: gold data

**Owner:** Karan

`kallax.gold.json` / `kallax.scene.json` (KAR-02), `lack.gold.json`, `malm.gold.json` (KAR-10). Must pass schemas + checks (tested).

## Regenerate KALLAX

From the repository root, run `npx tsx fixtures/scripts/convertPrototype.ts`.
Include both fixture JSON files, `public/manuals/kallax/manual.json`,
`public/manuals/index.json`, and all 19 JPEGs in `public/manuals/kallax/crops/` in the commit.
The converter currently writes a KALLAX-only library index; preserve other entries if the library has grown before rerunning it.

`tests/fixtures.test.ts` reads the generated files and checks the schemas, semantic validity,
geometry, page/variant coverage, library paths and JPEG decoding. Scene and schema tests also
load these fixtures directly. Run `npm run typecheck && npm test && npm run build` before committing.

## Manual facts (fill in during SHR-02)

| Manual | Product size W×H×D (cm) | Pages | Steps | Step pages | Branches | Sub-assembly steps | Steps with drawn orientation detail |
|---|---|---|---|---|---|---|---|
| KALLAX 2×4 (AA-1055145-11) | 77 × 147 × 39 | 24 | 19 (+5 horizontal variant) | 8–24 | 15–19 vertical / horizontal | none | 1, 13 (hole-position insets) |
| LACK side table | | | | | | | |
| MALM | | | | | | | |
