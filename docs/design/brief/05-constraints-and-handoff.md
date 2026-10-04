# 5. Constraints, and what to hand back

## The 3D view is not yours to design

A teammate (Ajit) owns everything **inside** the 3D rectangle: the furniture, its colours, the motion arrows, the red and green wrong-way preview and its labels. He is working on it now. Treat it as a live video feed you are framing.

**Design:** the frame around it, its size and position, the Reset view button in its corner, and the playback controls outside it.

**Do not design:** the furniture, the floor, the camera, the arrows, the preview labels.

**Use `screenshots/05-player-mistake-preview.jpg` as the picture of what goes in the frame.** In every player artboard, place that screenshot's 3D area (or a flat `#FAFAF8` rectangle labelled "3D view") where the view goes.

The 3D reads its colours from the same token file as the page, so one rule follows: **if you change the accent or the neutrals, say so explicitly**, and give the new value for each `--scene-*` token affected, so the two stay matched.

## How it will be built

| Fact | What it means for the design |
|---|---|
| Plain CSS with CSS variables. No Tailwind, no component library, no CSS-in-JS | Deliver values as CSS variables. Keep the system small enough to write by hand |
| No animation library | Every page motion must be possible with CSS transitions and keyframes |
| No icon library | Use words where a word is clearer. Any icon must be a simple inline SVG you draw: play, pause, replay, arrows, ✗, ✓ |
| Fonts from Google Fonts, served from our own site | Choose only faces available on Google Fonts |
| Works with no internet once loaded | No remote images, no embedded media |
| One codebase for laptop, tablet and phone | Design at 1440, 834 (portrait) and 390 wide |
| The drawing is an image of unknown shape | From 2:1 wide to 3:4 tall. Never crop it; never stretch it |
| A manual has 5 to 40 steps | The step markers must work at both ends of that range |
| An instruction is 10 to 25 words | Design for the longest; see the samples in file 4 |

## Quality floor

- Text contrast at least 4.5:1; large text and essential shapes at least 3:1.
- Every control reachable by keyboard, with a focus ring that is impossible to miss from two metres.
- Touch targets at least 44 px; Previous, Next step and play / pause at least 56 px.
- Colour is never the only signal: wrong and right always carry ✗ and ✓; the unsure state always carries words.
- With reduced motion on, every transition is a cut.

## Existing token names to keep

The page and the 3D already read these names. **Keep every name; change values freely; add new tokens as needed.**

```css
/* page */
--color-bg  --color-surface  --color-ink  --color-muted
--color-line  --color-line-strong
--color-accent  --color-accent-ink  --color-accent-soft
--color-warn  --color-warn-soft  --color-warn-line
--color-wrong  --color-wrong-soft  --color-right  --color-right-soft

/* 3D view (Ajit's; change only together with the page) */
--scene-bg  --scene-floor  --scene-part  --scene-part-edge
--scene-current  --scene-current-edge  --scene-guide
--scene-wood  --scene-steel  --scene-hole  --scene-wrong  --scene-right

/* type, space, shape */
--font-sans  --font-mono
--text-xs  --text-sm  --text-md  --text-lg  --text-xl  --text-2xl
--weight-regular  --weight-medium  --weight-bold
--space-1 … --space-8
--radius-sm  --radius-md  --radius-lg  --radius-pill
--border  --border-strong  --shadow-sm  --shadow-md
--control-height
```

The current values are in the attached `tokens.css`. You will need new tokens for at least: a display font (`--font-display`), the numeral and instruction sizes, and a larger control height for the primary actions.

## What to hand back

1. **Artboards**, at 1440 wide unless noted:

| # | Artboard |
|---|---|
| 1 | Home: default |
| 2 | Home: a file dragged over; wrong file; no saved manuals |
| 3 | Waiting: "Finding the steps" |
| 4 | Waiting: "Identifying the parts" (the long stretch with no countable progress) |
| 5 | Waiting: "Analysing step 7 of 19", including one unsure step and one that could not be read |
| 6 | Waiting: cancelled with 4 steps read |
| 7 | Player: assembly step, playing |
| 8 | Player: assembly step with a mistake button and the unsure notice |
| 9 | Player: information-only step |
| 10 | Player: assembled-separately step |
| 11 | Player: step that could not be read |
| 12 | Player: finished the manual |
| 13 | Player: re-analyse in progress, done, failed |
| 14 | Problem screen: one from a bad file, one for a manual not found |
| 15 | Player, assembly step, at 834 portrait |
| 16 | Player, assembly step, at 390 |
| 17 | Home and Waiting at 390 |

2. **A component sheet** showing every state of: primary and secondary button; the drop zone; a saved-manual card; the progress bar; a step row on the waiting screen (read, unsure, could not be read, reading); the step markers (done, current, to come, warning, information only, unsure, could not be read) at 8 steps and at 40; play / pause, Replay, scrubber and speed control; a part row; the unsure notice; the mistake button in both wordings; the problem pattern.

3. **`tokens.css`**: every value as a CSS variable under `:root`, using the names above plus your additions, each new token with a one-line comment saying what it is for.

4. **A short note** listing: the fonts chosen and why, anything in this brief you changed and why, and any `--scene-*` value Ajit needs to update.
