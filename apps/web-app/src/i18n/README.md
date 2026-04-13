# i18n Guide

This folder stores the website translation source files.

## Supported locales

- `en` for English
- `es` for Spanish
- `zh` for Chinese

English is the fallback locale. If a translation key is missing in `es.ts` or `zh.ts`, the site automatically falls back to the English value.

## Contributor workflow

1. Open one of the files in `locales/`.
2. Keep the same object shape and key names as `en.ts`.
3. Translate only the text on the right-hand side.
4. Leave any value you are unsure about in English for now.

Partial translations are safe because the runtime merges each locale with English.

## Style notes

- Keep internal names like `Team Soju`, `PokeMMO`, and `Discord` unchanged unless there is a strong reason to localize them.
- Preserve links, identifiers, and route names in code.
- Aim for natural wording, not word-for-word translation.
- If a sentence mentions game concepts, prefer the terms the local PokeMMO community already uses.

## Current preview mode

Locale routing is not enabled yet. During the scaffold phase, you can preview translated shared UI with:

- `?lang=en`
- `?lang=es`
- `?lang=zh`

Example: `/tools?lang=es`

If the URL has no `?lang=` value, the site now checks the browser language and any saved locale preference in local storage:

- English stays on the normal URL with no redirect.
- Spanish redirects to `?lang=es`.
- Chinese redirects to `?lang=zh`.
- An explicit `?lang=` in the URL always takes priority.
