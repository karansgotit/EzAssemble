# docs/design/: Claude Design output

**Owner:** Ajit (SHR-03)

## Screens

Design canvas: https://claude.ai/artifact/8nHYAF6pL1UKwd1gvi9xNj

The link is private until Ajit shares it from the page's Share menu. It holds seven artboards:

| Artboard | Covers |
|---|---|
| Step player | diagram, parts tray, 3D view, instruction, playback bar, step dots |
| Info step | large diagram, no 3D |
| Sub-assembly card | the "assembled separately" message and Continue |
| Library | manual cards and the "Upload a manual" card |
| Upload | drop zone, title, size fields, streaming progress |
| States | loading, low confidence, step failed, re-analyze (in progress / success / failed), invalid PDF, AI unavailable, wrong-vs-right labels and ghost |
| Design tokens | every colour, the type scale, spacing, radii, shadows |

## Tokens

[`tokens.css`](tokens.css) holds every value as a CSS variable. Smit copies it into `app/globals.css` (SMI-11); Ajit's `scene/constants.ts` reads the `--scene-*` ones (AJI-11).

## The rules behind it

- The 3D view looks like a line drawing in a manual: white parts, dark outlines, one accent colour (`--color-accent`).
- The part being added in this step is the accent tint with a heavy outline; everything already built is white with a light outline.
- Red and green mean wrong and right, nothing else, and always come with a ✗ or ✓ so they don't depend on colour alone.
- Warnings say where they come from: "From the manual" or "Possible mistake". Never "common mistake".
- Fonts are IBM Plex Sans and IBM Plex Mono (Google Fonts). The stacks fall back to system fonts, so the app still works offline.
- Every control is at least 44 px tall. Text colours meet 4.5:1 contrast on their backgrounds.
- No IKEA name, logo or colours in our own branding.
