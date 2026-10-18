# Decklist Generator

- React, TypeScript, Vite and Konva. Deployment branch: `main`; Vite base: `/YuGiOhDecklistGenerator/`.
- Read the Retroformats handoff in `README.md`. Continue from this repository's current branch, not the portal's temporary `.local/worktrees/` copies.
- Probability Calculator is the interface style reference. Keep `public/retroformats/retroformats.css` and `retroformats-mark.svg` identical to the canonical `design-system/` files in the sibling Retroformats portal workspace. Put app-specific styles in `src/styles.css`.
- Preserve the existing Light/Dark modes. Dark editor overlays use coral; Light retains its original palette. Interface styling must not change PNG document colors, fonts or geometry.
- Preserve `.dhdecktemplate` compatibility, embedded assets/fonts and batch export behavior. The current editor has a 980px minimum width.
- Verify meaningful code changes with `npm run build` and relevant browser flows. For visual changes compare both themes, keyboard navigation and an exported PNG. Shared kit verification commands and evidence are in the portal's `scripts/README.md` and `docs/visual-alignment-verification.md`.
- Never commit credentials, dependency directories, generated build files or browser evidence.
- Localize every interface string in all five languages through `src/i18n/` and `useI18n`; include aria/title text, prompts, file picker descriptions, errors and notifications. Never translate user data, default document text, font names, IDs or PNG/template content.
- Preserve the suite language contract: valid `ui_lang` > valid `retroformats-ui-language` storage > first supported `navigator.languages` entry > English. Supported codes are en/it/de/es/fr. Storage must tolerate denied access. Language switches update `html[lang]`, replace the current URL parameter without losing other query/hash data, and propagate the parameter in suite links without remounting editor state.
- Use the shared `.rf-language-control` and `.rf-language-select` with `data-ui-language-select`; option names stay native. Verify `npm test`, `npm run build`, switching/persistence/state retention and identical PNG output. Keep the existing Light/Dark behavior and 980px minimum width.
