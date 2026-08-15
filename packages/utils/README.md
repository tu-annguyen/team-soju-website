# `@team-soju/utils`

Shared utilities for the Team Soju web app, API server, and Discord bot.

## Structure

- `src/` contains the canonical ESM source. Make utility changes here only.
- `dist/` is generated and ignored by Git.
- `build.mjs` compiles the source into ESM (`.mjs`) and CommonJS (`.cjs`) artifacts.
- `package.json` uses conditional exports so `import` receives ESM and `require` receives CommonJS.

Run `npm run build --workspace=@team-soju/utils` after changing source files. The package is also built automatically during install and before web development, web production builds, and the root test suite.

The root ESM entrypoint contains browser-safe utilities. The root CommonJS entrypoint additionally exposes the Node-only GIF and PokeAPI helpers used by the backend services. PokeAPI helpers are also available explicitly through `@team-soju/utils/pokeapi`.
