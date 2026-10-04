# 1. The product, the person, the job

## What EzAssemble is

You upload the assembly manual that came with a piece of flat-pack furniture, as a PDF. EzAssemble reads it and gives you every step three ways at once:

- **the original drawing**, exactly as printed;
- **one plain sentence** saying what to do ("Tap 2 dowels into the long panel and push the first shelf onto them.");
- **a short 3D animation** of which piece moves where, which you can replay, slow down, scrub and orbit.

Where there is evidence, it also shows **the mistake before you make it**: the piece in the wrong orientation, in red, turning into the right one, in green.

An AI reads the drawings and fills in a strict form for each step. Our own code checks the form and builds the geometry and animation. When the AI is unsure, the app says so. When it cannot read a step, the app shows the original drawing and says "follow this".

## The person using it

Someone on the floor, mid-build, surrounded by panels and a bag of hardware. Picture the scene exactly:

- A laptop or tablet is propped **one to two metres away**, on a box or the half-built furniture.
- **Their hands are full**: a panel in one, an Allen key in the other. Reaching the screen is a deliberate act.
- They look up for **two seconds at a time**, between actions.
- They are **mildly stressed**. They are here because one drawing did not make sense, or because they once put a panel in backwards and found out five steps later.
- They do this a few times a year. They will not learn an interface.

The second audience is a panel of **hackathon judges** watching a three-minute demo on a projector. They need to see the value in the first ten seconds and believe the AI is real.

## The one job of each screen

| Screen | Its single job |
|---|---|
| Home | Get a manual in: drop your own PDF, or open one that has already been read |
| Waiting | Keep the person's trust for the 2 to 3 minutes the manual takes to read, and show it is really being read |
| Step player | Make **this one step** understood at a glance from across the room, then get out of the way |
| Problem screens | Say what happened and what to do next, in one breath |

## The subject's own world

Everything distinctive about this design should come from here, not from other software.

- **The wordless manual.** Black line drawings on white paper. No sentences anywhere. That silence is the problem we solve, so *our words are the product*.
- **The step numeral.** Every step in a printed manual is announced by a large, heavy number sitting beside the drawing. It is the manual's only typography.
- **Counts and part numbers.** "2x" next to a screw. A six-digit number like `101339` printed sideways along a dowel. People match these against the bag in their hand.
- **The callout bubble.** A circle that magnifies a small detail, joined to the drawing by a tapering leader line.
- **Wrong way, right way.** The manual's own warning device: the wrong arrangement crossed out with a heavy X, beside the correct one.
- **Motion arrows.** Thick black arrows showing a piece sliding into place.
- **The materials around the person.** White laminated board, raw particle-board edges, zinc hardware, a paper sheet, a cardboard box, a carpenter's chalk line.

See `reference/` for four real drawings: a step with a callout bubble and a warning, a dowel step with a count, an orientation detail, and a wall-fixing page full of crossed-out wrong ways.

## What the product is not

- Not an IKEA product. **No IKEA name in our branding, no IKEA logo, no IKEA blue and yellow.** The word "IKEA" may appear in plain copy that says which manuals we can read.
- Not a 3D modelling tool, not a dashboard, not a developer tool. There are no settings, accounts, or history.
- Not a video. The person controls every step.
