# Guide assets

- `public/guide/decklist-background-1080.png`: exact 1080 × 1080 opaque PNG, reused byte for byte from the Breakdown guide to keep the suite examples consistent. Generated with the built-in imagegen tool on 2026-10-20; the original prompt is in the sibling Breakdown repository, `docs/guide-background.md`.
- `public/guide/demo-decklist.svg`: original, code-authored geometric diagram with Main (40), Extra (15) and Side (15) card placeholders. It is a demonstration input image, not a playable deck or a source of card artwork.
- `public/guide/demo-decklist.png`: 900 × 760 PNG compiled from the SVG above. The tutorial loads and offers this raster image to keep the input independent of browser SVG rendering during theme changes.
- The populated example is assembled in `src/data/guideExample.ts` and remains separate from the template archive contract. No original community template or font is copied into these assets.
