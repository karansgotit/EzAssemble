# docs/design/brief/: the design brief

> **Status:** this direction has been built directly in the app (SMI-11), so the package no longer needs to go to Claude Design. It stays here as the record of why the app looks the way it does, and as a brief if a second design pass is wanted.

**Owner:** Smit · for SMI-11 (applying the design)

Everything Claude Design needs to design the application's interface: the home screen, the waiting screen, the step player and the problem screens. The inside of the 3D view is out of scope; Ajit owns it.

## How to use it

1. Start a new design in Claude Design.
2. Attach every file listed below.
3. Paste the contents of `PROMPT.md` as the message.

## Files

| File | What it is |
|---|---|
| `PROMPT.md` | The message to paste. Says what to design, the three hard rules, and what to show first |
| `01-product.md` | What the product is, who uses it and in what situation, and the subject's own visual world |
| `02-flows-and-screens.md` | The flow, every screen, everything on it, and every state |
| `03-direction.md` | The design direction: signature, colour, type, layouts as wireframes, motion, what to avoid |
| `04-copy.md` | Voice and the real words for every screen |
| `05-constraints-and-handoff.md` | What is out of scope, how it will be built, token names to keep, and what to hand back |
| `../tokens.css` | The current design tokens (Ajit, SHR-03). Attach this too |
| `screenshots/01` to `10` | The app as it works today, at 1440 wide. For content and structure only |
| `reference/` | Four real drawings from the KALLAX manual: the subject's visual world |

## What changed from the first design pass (SHR-03)

- **The upload has no form.** The first pass drew title and size fields; the person now only chooses a PDF.
- **Home and upload are one screen.**
- **A finished state** after the last step, which the app does not have yet.
- **The fonts.** IBM Plex is replaced by faces chosen for reading from two metres. The token names stay the same.
- **Layout of the step player.** The instruction leads; the drawing and 3D view sit beneath it.

Colours and the `--scene-*` tokens are unchanged, so the 3D view needs no rework unless Claude Design changes a value. Its hand-back note lists any that it does.

## After Claude Design answers

Put its `tokens.css` and exported screens in `docs/design/`, then SMI-11 applies them to `app/globals.css` and the page stylesheets. Three items in the design need code that does not exist yet: the page thumbnails on the waiting screen, the finished state, and re-analyse.
