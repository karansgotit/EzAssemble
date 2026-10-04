# client/: browser-side pipeline

**Owner:** Smit

| File | What |
|---|---|
| `rasterize.ts` | PDF → one JPEG per page (pdf.js) |
| `crop.ts`, `canvas.ts` | step box → cropped JPEG; shared canvas helpers |
| `partsRequest.ts` | shrinks the parts request to fit the upload size limit (Karan) |
| `api.ts` | the real client for the server routes: validation, retry, timeout, cancel; `getApi()` |
| `mockMode.ts` | the one switch for mock mode: `NEXT_PUBLIC_MOCK_AI=1` |
| `api.mock.ts` | the same interface answered from gold KALLAX, with no AI calls |
| `loadManual.ts` | loads and validates the saved library and manuals |
| `processManual.ts` | the upload orchestrator: PDF → saved manual, with progress events |
| `uploadForm.ts` | pure rules for the upload page: title and id from the file name, the file check, stage labels, loading-bar progress, and the interim product size |
| `pendingUpload.ts` | hands the PDF chosen on the home page to the upload page |
| `processSteps.ts` | pure helpers for the orchestrator (step picking, sub-assembly merge, usage totals) |

Signatures: `docs/CONTRACTS.md` §6. Tasks SMI-02, SMI-04..SMI-06.
Mock vs real API is switched in one place: `getApi()`.
