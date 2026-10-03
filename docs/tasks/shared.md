# Shared tasks: setup, checkpoints, demo

---

### SHR-01 · Google Cloud + Vertex AI setup and a test call
**Labels:** setup, P0 · **Owner:** Smit (whoever controls the Google Cloud account) · **When:** before the event · **Estimate:** 1 h

**Context:** our Gemini credits are Google Cloud credits, so all calls go through Vertex AI (D-07).

**Do**
- [ ] Redeem the StormHacks credits onto a Google Cloud project; confirm the balance shows ~$300 CAD.
- [ ] Enable the **Vertex AI API** on that project.
- [ ] Create a service account with the role **Vertex AI User**; create a JSON key.
- [ ] Check which Gemini model IDs are available on Vertex AI, and in which location (`global` vs a region). Write the chosen IDs in team chat (Karan pins them in `pipeline/config.ts`).
- [ ] Make one test call with `@google/genai` (`vertexai: true`) sending one KALLAX crop image and asking for JSON. Note the latency and token counts.
- [ ] Share the key **privately** with teammates (not in git, not in a public channel).

**Acceptance criteria**
- [ ] The test call returns valid JSON from the chosen model, from each teammate's laptop.
- [ ] Model IDs + location written down.

---

### SHR-02 · Get and read the three manuals
**Labels:** setup, P0 · **Owner:** Karan · **When:** before the event · **Estimate:** 45 min

**Do**
- [ ] Download the PDFs for KALLAX 2×4 (we have it), LACK side table, and MALM (a chest with drawers) from IKEA's site. Put them in `manuals-src/` (git-ignored) and share them in team chat.
- [ ] For each, write down:
  - page count and step count;
  - which pages are steps;
  - branch points;
  - sub-assembly steps (MALM drawers);
  - steps where the manual draws a wrong-way / hole-orientation detail.
- [ ] Look up each product's assembled size (W×H×D cm) on its IKEA product page.

**Acceptance criteria**
- [ ] A table in `fixtures/README.md` with the facts above for each manual.
- [ ] If MALM turns out unsuitable (e.g. too complex or curved), propose a replacement IKEA product to the team.

---

### SHR-03 · Claude Design: screens + design tokens
**Labels:** design, P1 · **Owner:** Ajit · **When:** before the event, or hours 0–2 · **Estimate:** 1.5 h

**Do**
- [ ] Give Claude Design: prototype screenshots, `docs/SPEC.md` §13, and the rule "3D looks like an IKEA drawing: white parts, black outlines, one accent colour".
- [ ] **Screens:**
  - Library
  - Upload (drop zone + title + size fields + streaming progress)
  - Step player
  - Info step
  - Sub-assembly card
- [ ] **States:**
  - Loading
  - Low confidence
  - Failed step
  - Re-analyze in progress / success / failed
  - Invalid PDF
  - AI unavailable
- [ ] Export **design tokens** as CSS variables (colours, type scale, spacing, radii, shadows).

**Acceptance criteria**
- [ ] Screens exported (images or a shareable link) and `tokens.css` committed to `docs/design/` for Smit to apply in SMI-11.

---

### SHR-04 · Publish the repo
**Labels:** setup, P0 · **Owner:** Smit · **When:** before the event · **Estimate:** 15 min

**Context:** the repo is already scaffolded locally in `EzAssemble/`: docs, `CLAUDE.md`, `.gitignore`, `.env.example`, folder READMEs, PR/issue templates, `assets/`, `reference/prototype/`. `git init` is done; nothing has been committed or pushed yet.

**Do**
- [ ] Review the scaffold, make the first commit, create the GitHub repo **EzAssemble**, and push `main`.
- [ ] Add all three teammates.
- [ ] Optional: protect `main` (require passing checks) once CI exists.
- [ ] Each teammate clones and opens Claude Code in the repo; confirm it loads `CLAUDE.md`.
---

### SHR-05 · Integration checkpoints H3 / H8 / H12 / H16 / H19
**Labels:** integration, P0 · **Owner:** everyone · See `CONVENTIONS.md` §8 for what must be shown at each.

At each checkpoint:
- [ ] everyone pulls `main`;
- [ ] `npm test && npm run build` is green;
- [ ] each person demos their piece in under 2 min;
- [ ] blockers are reassigned.

---

### SHR-06 · Generate the demo library (final)
**Labels:** demo, P0 · **Owner:** Karan (run + review) with Smit (save) · **When:** hours 17–19 · **Estimate:** 1 h
- [ ] With the final code and prompts, process KALLAX, LACK and MALM through the upload flow locally.
- [ ] Review the crops, parts list and steps; fix obvious data errors by hand in `manual.json` (note what was fixed for honesty).
- [ ] Save to the library and commit `public/manuals/**`.
- [ ] Record the usage/cost per manual for the pitch.

---

### SHR-07 · Demo rehearsal, backup video, Devpost
**Labels:** demo, P0 · **Owner:** everyone · **When:** hours 19–24
- [ ] **Rehearse 3×** with a timer (PRD §6); note and fix rough spots.
- [ ] **Smit:** record a backup screen video of the full demo (hour ~21).
- [ ] **Karan:** put the accuracy numbers from eval on one slide/card.
- [ ] **Ajit:** Devpost write-up: problem, how it works, the AI-fills-forms / code-does-geometry split, eval numbers, screenshots, team.
- [ ] Test the deployed URL **and** a local run with Wi-Fi off.
