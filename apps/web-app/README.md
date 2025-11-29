# Team SOJU Frontend

A dynamic, content-driven frontend built with React.js and Astro components.

---

## 🚀 Project Structure

```text
/
├── public/
│   └── favicon.svg
│   └── images/
├── src/
│   ├── components/   # React.js components
│   ├── data/         # Static data files (for events)
│   ├── layouts/      # Top-level Astro components
│   ├── pages/        # Astro components
│   ├── scripts/      # Script to fetch shiny showcase
│   ├── styles/       # Global CSS styles
│   └── utils/        # PokeMMO forum parser
├── package.json
├── package-lock.json
└── README.md
```

---

## Testing

- All frontend Jest tests live under `test/`.
- Run the full backend test suite (with coverage) from the monorepo root `team-soju-website/`:

  ```bash
  npm run test:web
  ```