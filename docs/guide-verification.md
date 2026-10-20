# Decklist guide verification

Verified on 2026-10-20 against the production build served on localhost in the Codex in-app browser.

## Functional checks

- Five inline steps in EN/IT/DE/ES/FR: example, event, player, additional rows, export.
- Confirmation starts on Cancel, cycles keyboard focus, and Escape cancels without replacing data.
- Guide and confirmation keyboard actions cannot delete the selected document layer.
- Example loads both decoded assets before replacing the template and rows together. The event heading receives focus.
- Show controls expands the relevant panel. The rows request switches from Layers to Rows and focuses its heading even if previously collapsed.
- Static title and row text editing appear in the actual generated PNG at 1080 × 1080.
- Duplicating a row preserves its image; editing the second row keeps the first independent and produces a different PNG.
- Image selection through the row upload control succeeds with the local demonstration asset.
- Escape closes the PNG preview while leaving the guide open.
- Missing demonstration image was simulated only by temporarily renaming its ignored build copy. The localized error preserved the edited row. Restoring the file allowed a successful retry. Sources were untouched.
- Layout checked at 980 × 720, 1280 × 720 and 1440 × 900 with the existing desktop minimum. Guide navigation and actions remain available; the existing row table scrolls horizontally. Both existing themes were visually inspected.

## Export comparisons

The five final PNG files have identical decoded RGBA pixels and retain the same synthetic document content across all interface languages. The existing Light/Dark theme comparison differs only in two channel values by 1/255 across 1080 × 1080 pixels. No visible document color or geometry changes were observed. Raw PNG byte hashes can vary with canvas rasterization, so comparison uses decoded pixels.

The demonstration is a PNG compiled from an original SVG diagram. Loading a raster input avoids inconsistent SVG drawing observed during the first theme comparison without changing the renderer. The SVG remains its editable source.

Browser screenshots, actual PNGs, pixel comparison and original-file integrity reports are kept outside this repository in the portal workspace under `.local/verification/decklist-guide/`.

## Source and compatibility checks

Run from this repository:

```sh
npm test
node scripts/check-guide.mjs
npm run build
git diff --check
```

The guide check uses the real store and template archive import/export. It verifies image dimensions, complete initial row, independent duplication, fresh example cloning and unchanged default document. A saved `.dhdecktemplate` remains a reusable layout: session rows, texts and images are deliberately excluded. The guide describes that existing limitation.

The portal suite check (`node scripts/verify-suite-style.mjs --originals`) passed all ten CSS/brand consistency checks. SHA-256 checks confirmed that all ten original community templates in Pictures/template/breakdown and Pictures/template/decklist are unchanged.

Native operating-system file-picker chrome and completion of downloaded files are not certified by the in-app browser. PNG content was checked through the actual preview result; archive serialization was tested independently with the real archive code.
