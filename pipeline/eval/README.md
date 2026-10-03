# pipeline/eval/: accuracy evaluation

**Owner:** Karan

`run-eval.ts` scores AI output against `fixtures/*.gold.json`; `report.ts` writes `eval/out/<id>.html`; `LOG.md` records each tuning iteration (KAR-09, KAR-11).
`npm run eval -- kallax` makes real AI calls and costs money.
