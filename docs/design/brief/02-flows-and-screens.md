# 2. Flows, screens and every state

The app has three screens and one flow. `screenshots/` shows each of them as it works today. The current look is an unstyled placeholder: use the screenshots for **what is on each screen**, never for how it should look.

## The flow

```
                 ┌───────────────────────────────┐
                 │  HOME                         │
                 │  drop a PDF  │  saved manuals │
                 └──────┬───────────────┬────────┘
            drop a PDF  │               │ open a saved manual
                        ▼               │
                 ┌──────────────┐       │
                 │  WAITING     │       │
                 │  2–3 minutes │       │
                 └──────┬───────┘       │
     switches by itself │               │
     when the manual    ▼               ▼
     is ready    ┌───────────────────────────────┐
                 │  STEP PLAYER                  │
                 │  step 1 … step N, then done   │
                 └───────────────────────────────┘
```

The person never types anything. There is no title, size or settings form. Choosing a PDF starts the upload.

---

## Screen A. Home

Today this is two routes: a library page (`01-library.jpg`) and a separate upload page (`02-upload-drop-zone.jpg`). **Design them as one screen**: the drop zone and the saved manuals belong together, because both answer "which manual?".

**What is on it**

- The product name and one sentence saying what it does.
- **The drop zone**: drag a PDF onto it or click to choose one. This is the primary action.
- **Saved manuals**: a card per manual with a thumbnail of its first drawing, its title and its step count. Today there is one (KALLAX 2×4, 19 steps); there will be three for the demo, and the grid must also work with twelve.

**States to design**

| State | What the person sees |
|---|---|
| Default | Drop zone plus saved manuals |
| Dragging a file over the page | The drop zone responds; the whole page may become the target |
| Wrong file | "This file isn't a PDF. Upload the assembly manual as a PDF." shown at the drop zone, which stays usable |
| Saved manuals loading | Placeholder cards |
| No saved manuals | The drop zone alone, with nothing that looks broken |
| Saved manuals could not be loaded | A problem message (see Screen D) with the drop zone still usable |

---

## Screen B. Waiting

Today: `03-upload-reading.jpg`. A real manual takes **2 to 3 minutes**, so this screen is seen for a long time. It must show real work happening, never a bare spinner.

**What is on it**

- The manual's title, taken from the file name ("MALM bed frame white").
- **One progress bar** across the whole run. It only moves forward.
- **One line saying what is happening now.** The stages, in order, with their share of the wait:

| Stage line | Roughly |
|---|---|
| Reading the PDF | 1 second |
| Finding the steps · page 8 of 24 | 20 to 40 seconds |
| Cutting out the steps | 1 second |
| Identifying the parts | 20 to 50 seconds, with no sub-progress |
| Analysing step 7 of 19 | 5 to 10 seconds per step: most of the wait |

- **The steps, appearing one at a time** as each is read: step number plus its sentence. A step can arrive in three flavours: read normally; read but unsure; could not be read.
- **A Cancel button.**
- A notice when something was skipped: "Page 10 couldn't be read. Steps 6 and 7 not found."

**Material you can use that the current screen ignores:** by this point the app holds an image of **every page of the manual** and, a little later, **a cropped image of every step**. A waiting screen that shows the manual's own pages being worked through would be honest and specific to this product.

**What happens at the end:** the screen switches to the step player by itself. There is no "open" button to press.

**States to design**

| State | What the person sees |
|---|---|
| Each of the five stages | As above. "Identifying the parts" is the longest stretch with no countable progress |
| A step that was read but is unsure | Marked, not alarming |
| A step that could not be read | "Couldn't be read. The player will show the original diagram." |
| Cancelling | "Cancelling…" straight away, since the current request must finish first |
| Cancelled, with some steps read | What was read stays; actions: open those steps, or upload another manual |
| Failed before any step was read | Back to the drop zone with the reason (see Screen D) |

---

## Screen C. Step player

Today: `04-player-assembly-step.jpg`. This is where people spend their time. One step is on screen at a time.

**What is on it, for an ordinary assembly step**

| Element | Notes |
|---|---|
| Manual title and "Step 3 of 19" | |
| **The original drawing** | The crop from the manual, any aspect ratio from wide and short to tall. It must stay visible beside the 3D so people can compare and trust it |
| **What you'll use** | The parts this step needs: name, count ("×2"), and the printed part number when there is one ("#101339"). One to four rows |
| **The 3D view** | A rectangle owned by a teammate (see file 5). Design its frame and the controls around it, not its contents. It needs to be large. It has one control of ours inside its corner: **Reset view** |
| **The instruction** | One sentence, 10 to 25 words. The most important thing on the screen |
| **Mistake button**, when the step has one | "Show the mistake" when the manual itself draws the warning; "Show possible mistake" when our geometry inferred it. Pressing it replays the step with the wrong-way preview first |
| **Playback** | Play / pause, Replay, a scrubber with percentage, speed 0.5× / 1× / 2× |
| **Step navigation** | Previous, Next step, and one marker per step that jumps to it. A manual has 5 to 40 steps |
| Way back | To home |

Keyboard: ← → change step, Space plays or pauses, R replays. On touch, swiping between steps is expected.

**The mistake preview** (`05-player-mistake-preview.jpg`) plays inside the 3D view before the step's animation: the piece appears in the wrong orientation in red with "✗ From the manual" or "✗ Possible mistake", turns to the right orientation in green with "✓" and a short hint ("Drilled holes face inward"), then the step plays. It plays by itself the first time a flagged step is opened.

**The five kinds of step.** Each needs its own layout:

| Kind | Screenshot | What it shows | What it leaves out |
|---|---|---|---|
| Assembly | `04` | Everything above | |
| Assembly, AI unsure | `07` | The same, plus a notice: "Double-check this step. The AI wasn't sure about it, so compare with the original diagram." | |
| Information only (warnings, wall fixing) | `06` | The drawing, large, and the sentence | 3D, parts, playback |
| Assembled separately (a drawer built from its own steps) | `08` | A message card: "The 2 drawers are assembled separately (manual steps 5–9). Follow the manual for those, then continue here." and a Continue button | Drawing, 3D, parts, playback |
| Could not be read | `09` | The drawing, large, and "Follow the original diagram for this step." | 3D, parts, playback |

The step markers should tell these kinds apart, because that is true information about the manual: which steps are ordinary, which are information only, which carry a warning, which the AI was unsure of.

**States to design**

| State | Notes |
|---|---|
| Playing, paused, finished | Pressing play on a finished step replays it |
| Scrubbing | The person drags to any point and the animation holds there |
| First step / last step | Previous and Next are unavailable at the ends |
| **Finished the manual** | Does not exist yet. After the last step there should be a moment that says the furniture is built, with a way to go back through the steps or start another manual |
| Drawing missing | "The diagram for this step isn't available." in place of the image |
| Opening a manual | "Opening the manual…" before the first step shows |
| Re-analyse this step (planned) | A button that sends this step's drawing to the AI again, live. In progress (up to 20 seconds), then "Live result · 1 attempt · 6.2 s", or "Live analysis unavailable" with the saved result kept |

**Sizes to design:** laptop (1440 wide), tablet in portrait (834 wide), phone (390 wide). On a tablet propped on a box, the transport controls should be reachable with one hand at the bottom edge.

---

## Screen D. Problems

Today: `10-error-screen.jpg`. One pattern covers all of these: a short heading that says what happened, the reason in a sentence, and the way out.

| When | Reason shown | Way out |
|---|---|---|
| The file is not a PDF | This file isn't a PDF. Upload the assembly manual as a PDF. | Choose another file |
| The file is empty | This file is empty. | Choose another file |
| The PDF is damaged | We couldn't read this PDF. The file may be damaged. | Choose another file |
| The PDF needs a password | This PDF is password-protected. Upload a copy without a password. | Choose another file |
| No steps were found in it | No assembly steps were found in this PDF. Is it an IKEA assembly manual? | Choose another file |
| The AI did not answer | The AI service that reads manuals didn't answer, so this manual couldn't be analysed. Try again in a moment. | Try again |
| The parts could not be identified | Couldn't identify the parts in this manual. | Try again, or choose another file |
| A saved manual does not exist | The manual "billy" was not found. | Back to home |
| A saved manual's file is broken | A list of what is wrong with it (several lines; for the team more than the public) | Back to home |
| The saved manuals could not be loaded | Couldn't load the manual library. Check your connection and try again. | Try again |

---

## Not for design

Three things exist only while the team develops and never reach the public site: a "Fake data: ON/OFF" badge in the corner, a "Save to library" button, and a yellow development note. Leave them out.
