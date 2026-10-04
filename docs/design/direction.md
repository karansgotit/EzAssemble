# Design direction: "Read from the floor"

> Why the app looks the way it does. Written before the design was built (SMI-11). Two things changed after it, on Smit's call: the 3D animation is now the largest thing on the step player, with the step number and sentence under it, and there is no scrubber or play / pause. `reference/` and the numbered files it mentions were part of a design brief that is no longer in the repo.

This is the direction we want. It is opinionated on purpose. If you find a stronger answer to the same idea, take it and say why; if you drift toward something that would suit any web app, come back to this page.

## The idea in one paragraph

A printed assembly manual is small, silent and read at arm's length. The person using EzAssemble is two metres away with a panel in their hands. So the design is **the manual's own page, enlarged and given a voice**: the heavy step numeral the manual already uses, followed by the one thing the manual never had, a sentence. Everything on the step player is sized to be read in a two-second glance from across the room. That scale is the aesthetic risk, and it is the only one: palette and decoration stay quiet so the numeral and the sentence can be loud.

## Signature: the numeral and the sentence

Every step opens with the step number at the scale a manual prints it, and the instruction beside it as a single typographic unit:

```
 ███████
      ██    Tap 2 dowels into the long panel
  █████     and push the first shelf onto them.
      ██
 ███████
```

- The numeral is not decoration. It is the manual's own device, and steps are a true sequence, so the number carries information.
- The sentence is the largest running text most people will have seen in a web app. It should be comfortable from two metres on a 13-inch laptop.
- This pairing appears on every kind of step, so the player has one constant anchor whether the rest of the screen holds a 3D view, a large drawing, or a message.

If one thing is remembered about this product's look, it should be this.

## Colour

The 3D view is already built to this palette, so treat these as the starting values. The page and the 3D must read as one object.

| Name | Hex | Where it comes from | Used for |
|---|---|---|---|
| Sheet | `#FFFFFF` | the paper the manual is printed on | drawings, cards, the surface things sit on |
| Floor | `#F4F5F2` | the room behind the sheet | page ground |
| Ink | `#14161A` | the manual's line work | text, the numeral, strong outlines |
| Graphite | `#5A6068` | pencil | secondary text, quiet labels |
| Rule | `#D9DCD6` | a faint fold line | hairlines and resting borders |
| Chalk-line blue | `#2447E0` | a carpenter's chalk line | the one accent: "this step", the primary action, focus |

Three colours are reserved by meaning and never used for anything else:

| Name | Hex | Meaning | Always paired with |
|---|---|---|---|
| Wrong | `#C8321E` | the wrong way | ✗ |
| Right | `#1B7A48` | the right way | ✓ |
| Unsure | `#6B4500` on `#FFF1CC` | the AI was not certain | words that say so |

Why blue and nothing else: red, green and amber are spoken for by meaning, so blue is the only hue family left that can say "this step's piece" without colliding, and it stays distinct for colour-blind viewers. Never set it against yellow; that pairing belongs to IKEA.

No gradients, no tints of the accent as backgrounds for large areas. A dark theme was added later (Smit's call): the same tokens with dark values, drawings kept on white paper.

## Type

Three roles. The choices follow from the two-metre reading distance and from the part numbers people match against the bag in their hand.

| Role | Face (Google Fonts) | Why this one |
|---|---|---|
| Numerals and titles | **Schibsted Grotesk**, 800 to 900 | A sturdy Nordic grotesque with figures heavy enough to stand at 160 px and above. Choose the display face *by its numerals*: they should look stamped onto the page, like the manual's. If another face has better figures, use it |
| The instruction and all running text | **Atkinson Hyperlegible Next** | Drawn for readers with low vision: every letter is built to be told apart at a glance, which is exactly the two-second look from the floor |
| Part numbers, counts, percentages | **Atkinson Hyperlegible Mono** | `101339` must never be misread as `10l339`. Tabular, so numbers do not jump as they change |

A scale built for distance, at laptop size:

| Use | Size |
|---|---|
| Step numeral | 160 to 220 px |
| Instruction sentence | 32 to 40 px |
| Titles | 28 px |
| Part names, buttons | 18 to 20 px |
| Labels, counts, part numbers | 16 px |
| Smallest text anywhere | 14 px |

Write counts the way the manual does, count first: **2× Wooden dowel** `101339`.

## Layout

### Step player: three ways, and the one we want

**A. Side by side** (what exists today). Drawing left, 3D right, sentence underneath. This is how any media player would be laid out, and it puts the most important thing, the sentence, at the bottom in body-text size.

**B. Announce, then show.** The numeral and sentence across the top; drawing and 3D beneath; transport and step markers along the bottom edge.

**C. Stage.** The 3D fills the screen, with the drawing pinned small in a corner. Dramatic, but it hides the original drawing, and comparing the two is how people come to trust the 3D.

**We want B.** The sentence is the product and is read from furthest away, so it goes first and largest. The drawing stays beside the 3D at a size where the two can be compared.

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← KALLAX 2×4                                                  3 of 19 │
│                                                                        │
│  ████   Tap 2 dowels into the long panel and                           │
│    ██   push the first shelf onto them.        [ ! Show possible mistake ]
│  ████                                                                  │
│                                                                        │
│ ┌ From the manual ───────┐  ┌───────────────────────────────────────┐  │
│ │                        │  │                                       │  │
│ │   original drawing     │  │              3D view                  │  │
│ │                        │  │                                       │  │
│ ├────────────────────────┤  │                                       │  │
│ │ 2×  Wooden dowel 101339│  │                          Reset view   │  │
│ │ 1×  Shelf 1            │  └───────────────────────────────────────┘  │
│ └────────────────────────┘                                             │
│  ▶   ↻ Replay   ━━━━━━━━━━━━●──────────────────      0.5×  1×  2×      │
│ ← Previous    ● ● ◉ ○ ○ ○ ○ ○ ○ ○ ○ ○ ! ○ ○ ▫ ▫ ▫ ▫       Next step →  │
└────────────────────────────────────────────────────────────────────────┘
```

The step markers encode what is true about each step: done, current, still to come, carries a warning, information only, the AI was unsure, could not be read. They are a map of the manual, not a row of identical dots.

On a tablet in portrait and on a phone the same order stacks: numeral and sentence, 3D, drawing and parts, with transport and Previous / Next fixed to the bottom edge where a thumb reaches.

The other four kinds of step keep the numeral-and-sentence anchor and change only what sits beneath it:

```
 Information only            Assembled separately        Could not be read
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ 16  Fix the unit to  │   │ 5   The 2 drawers    │   │ 10  Follow the       │
│     the wall …       │   │     are assembled    │   │     original diagram │
│ ┌──────────────────┐ │   │     separately …     │   │     for this step.   │
│ │   drawing,       │ │   │                      │   │ ┌──────────────────┐ │
│ │   large          │ │   │     [ Continue ]     │   │ │  drawing, large  │ │
│ └──────────────────┘ │   │                      │   │ └──────────────────┘ │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

### Home: the hero is the drop zone

The most characteristic act in this product is handing over the manual, so the drop zone is the hero, not a banner above it. Beside or within it, show the thesis with real material from `reference/`: a wordless drawing, and the same step with its numeral and sentence. A judge should understand the product from that pair in ten seconds.

```
┌────────────────────────────────────────────────────────────────────────┐
│ EzAssemble                                                             │
│                                                                        │
│ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   ┌ the manual ──┐  ┌ with us ───┐ │
│ ╎                                  ╎   │  wordless    │  │ 3  Tap 2   │ │
│ ╎  Drop your assembly manual here  ╎   │  drawing     │→ │ dowels into│ │
│ ╎  PDF · or choose a file          ╎   │              │  │ the long … │ │
│ ╎                                  ╎   └──────────────┘  └────────────┘ │
│ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                                    │
│                                                                        │
│ Already read                                                           │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐                               │
│ │ drawing  │  │ drawing  │  │ drawing  │                               │
│ │ KALLAX   │  │ LACK     │  │ MALM     │                               │
│ │ 19 steps │  │ 8 steps  │  │ 14 steps │                               │
│ └──────────┘  └──────────┘  └──────────┘                               │
└────────────────────────────────────────────────────────────────────────┘
```

Each saved manual is shown as its own first drawing: a sheet of paper, not a product photo.

### Waiting: show the manual being read

Two to three minutes is a long time. The honest thing to show is the manual itself: its pages, with the one being read marked, and its steps arriving as sentences.

```
┌────────────────────────────────────────────────────────────────────────┐
│ MALM bed frame white                                          Cancel   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●────────────────────────────────  47%    │
│ Analysing step 6 of 14                                                 │
│                                                                        │
│ ┌ the manual ──────────────────┐   ┌ read so far ───────────────────┐  │
│ │ ▢ ▢ ▢ ▢ ▣ ▣ ▣ ▣ ▣ ▣           │   │ 1  Lay the long panel on its … │  │
│ │ ▣ ▣ ▣ ▣ ▣ ▣ ▢ ▢ ▢ ▢           │   │ 2  Tap 2 dowels into the end … │  │
│ │ the page being read is lit   │   │ 3  Tap 2 dowels into the long …│  │
│ └──────────────────────────────┘   │ 4  …                           │  │
│                                    │ 6  reading                     │  │
│                                    └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

The stretch called "Identifying the parts" has no countable progress for up to 50 seconds. It needs its own treatment so the screen does not look frozen.

## Motion

Three places, and nowhere else:

1. **Changing step**: the numeral and the sentence change. One short, confident move.
2. **Waiting**: each step arrives; the progress bar advances.
3. **Feedback** on press, drop and focus.

No ambient motion, no parallax, nothing on scroll. The 3D view supplies all the movement this product needs, and page motion must never compete with it. With reduced motion switched on, every change is a cut.

## What this must not look like

- **A dashboard or developer tool**: no sidebars, tabs, breadcrumbs, badges or stat tiles.
- **The three looks AI design tools fall into**: a cream page with a serif headline and a terracotta accent; a near-black page with one acid accent; a newspaper of hairlines and square corners. None of them comes from this subject.
- **A product landing page**: no feature grid, testimonials or pricing. Home is a tool, and it starts working when the file lands.
- **IKEA**: no blue-and-yellow, no wordmark-style type, no product photography.
- **Decoration standing in for content**: no icons where a word is clearer, no emoji, no illustrations we did not draw from the manual's own material.

## Where we already questioned ourselves

- *First instinct for the player was layout A*, because it is what exists and what any player looks like. Changed to B once it was clear the sentence is read from furthest away and must lead.
- *First instinct for colour was to find a new accent.* Kept the blue: meaning has claimed the other hues, and the 3D view is tuned to it. The boldness went into scale and type instead.
- *First instinct for the waiting screen was a nicer progress bar.* A bar says nothing specific to this product. The manual's own pages do.
- *IBM Plex, in the earlier tokens, is the usual choice for anything "technical".* Replaced with faces chosen for the reading distance.
