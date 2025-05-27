# Team SOJU Website

Welcome to the official [Team SOJU website](https://team-soju.netlify.app)!
This site serves as the central hub for Team SOJU, featuring our shiny showcase, team staff, and more.

---

## 🚀 Project Structure

```text
/
├── public/
│   └── favicon.svg
│   └── images/
├── src/
│   ├── components/
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── LinkCard.tsx
│   │   ├── ShinyCard.tsx
│   │   ├── ShinyShowcase.tsx
│   │   ├── StaffCard.tsx
│   │   ├── TeamLinks.tsx
│   │   ├── TeamStaff.tsx
│   │   └── ThemeToggle.tsx
│   ├── data/
│   │   └── showcase.json
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   │   └── shiny-showcase.astro
│   ├── scripts/
│   │   └── fetch-showcase.ts
│   └── utils/
│       └── forumParser.ts
├── package.json
├── package-lock.json
└── README.md
```

---

## 🧞 NPM Commands

All commands are run from the root of the project:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

---

## 👥 Contributors & Credits

- **tu-annguyen** – Lead Developer & Designer  

Special thanks to the [Astro](https://astro.build) team and the [PokeMMO](https://pokemmo.com/) community.

---

## 📚 Learn More

- [Astro Documentation](https://docs.astro.build)
- [Team SOJU Forum Club](https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/)
