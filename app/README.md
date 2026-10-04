# app/: Next.js App Router

**Owner:** Smit (pages, layout, globals.css) · Karan (AI routes in `app/api/`)

Pages: `page.tsx` (library), `upload/`, `m/[id]/` (step player), and the team's tools under `dev/` (`pdf`, `player`, `scene`), which answer "not found" in a production build (`dev/layout.tsx`).
Created in **SMI-01**. See `docs/ARCHITECTURE.md` §3, §8.

Look and layout follow `docs/design/brief/03-direction.md` ("Read from the floor"). Tokens live in `globals.css`; fonts are loaded in `layout.tsx`. Shared pieces are in `components/` (`DropZone`, `ErrorScreen`, `ThemeToggle`).

Light and dark themes: every colour is a token in `globals.css`, with the dark values under `:root[data-theme="dark"]`. `components/themeBoot.ts` sets the theme before the first paint (light, unless this browser chose dark with the switch); `ThemeToggle` is the switch in the top right corner. The manual's drawings always sit on white (`--color-paper`), and the 3D view reads the `--scene-*` tokens of whichever theme is on.
