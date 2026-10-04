# fake-data/: stand-in data for development

**Owner:** Smit · anyone may read and import from it

Hand-written data for building and testing the UI without calling the real API. **None of it is AI output**, and it is not the gold data: the hand-checked KALLAX / LACK / MALM manuals live in `fixtures/` (Karan). Since KAR-02, the mock API answers from the gold KALLAX manual, not from this folder. What stays here is the on/off switch and one manual for the edge cases gold doesn't cover.

| File | What |
|---|---|
| `manual.ts` | `fakeManual`: a small `SceneManual` with the step kinds gold KALLAX doesn't have (sub-assembly, failed, missing diagram, geometry trap, low confidence). It has no geometry, so it plays in the stand-in scene only: `/dev/player?manual=fake` |
| `toggle.ts` | `isFakeDataOn()`: the one switch code checks before calling the real API |
| `public/fake-data/crops/` | the diagram images `manual.ts` points at (copies of three KALLAX crops from `assets/`) |

## Turning fake data on and off

- **Default for everyone:** `NEXT_PUBLIC_MOCK_AI` in `.env.local` (`1` = fake data, `0` = real API). Changing it needs a dev-server restart.
- **At will, in development:** click the **Fake data** badge in the top-right corner of any page. It flips the switch for your browser only and reloads the page; no restart, and it works whether or not the API credentials are set. Click **reset** next to it to go back to the `.env.local` default.
- **Production builds** ignore the badge and only read the env var.

## While the AI routes are still being built

With fake data **off** in development, each AI route is called for real if it exists. A route that isn't built yet is answered by the mock instead, so the finished routes can be tried on a real PDF before all three exist. The upload page shows a yellow note naming the routes that were mocked. Those answers are saved KALLAX data, so they won't match another manual.

## Rules

- Code that can reach the real API gets it from `getApi()` in `client/api.ts`, which returns the mock when `isFakeDataOn()`. Don't add a second switch.
- Add `?mockFail=2` to a page's URL to make the mock fail that step number.
- Anything shown from here must look fake (titles say "fake data").
- When the real piece lands (schema, gold fixtures, routes), switch the consumer over and delete what is no longer used here.
