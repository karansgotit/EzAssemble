# fake-data/: stand-in data for development

**Owner:** Smit · anyone may read and import from it

Hand-written data for building and testing the UI without calling the real API. **None of it is AI output**, and it is not the gold data: the hand-checked KALLAX / LACK / MALM manuals live in `fixtures/` (Karan). Use this folder when the real thing isn't ready yet, or when you don't want to spend API calls.

| File | What |
|---|---|
| `manual.ts` | `fakeManual`: a small `SceneManual` with one step of every kind (assembly with a manual trap, assembly with a geometry trap, low confidence, sub-assembly, failed, missing diagram, info) |
| `toggle.ts` | `isFakeDataOn()`: the one switch code checks before calling the real API |
| `public/fake-data/crops/` | the diagram images `manual.ts` points at (copies of three KALLAX crops from `assets/`) |

## Turning fake data on and off

- **Default for everyone:** `NEXT_PUBLIC_MOCK_AI` in `.env.local` (`1` = fake data, `0` = real API). Changing it needs a dev-server restart.
- **At will, in development:** click the **Fake data** badge in the bottom-left corner of any page. It flips the switch for your browser only and reloads the page; no restart, and it works whether or not the API credentials are set. Click **reset** next to it to go back to the `.env.local` default.
- **Production builds** ignore the badge and only read the env var.

## Rules

- Code that can reach the real API asks `isFakeDataOn()` first. Don't add a second switch.
- Anything shown from here must look fake (titles say "fake data").
- When the real piece lands (schema, gold fixtures, routes), switch the consumer over and delete what is no longer used here.
