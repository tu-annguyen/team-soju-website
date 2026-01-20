# Team SOJU Website

Welcome to the official [Team SOJU website](https://team-soju.netlify.app)!
This site serves as the central hub for Team SOJU, featuring our shiny showcase, team staff, and more.

---

## 🚀 Project Structure

```text
/
├── apps/
│   ├── web-app/       # Astro & React frontend
│   ├── api-server/    # Node.js backend API
│   └── discord-bot/   # Discord bot for team management
├── package.json       # Root workspace config
└── README.md
```

### Apps Overview

- **web-app**: Astro-based frontend with React components for the website
- **api-server**: Express.js backend API for data management (deprecated in favor of Discord bot)
- **discord-bot**: Discord bot using direct database access for team member and shiny management

---

## 🧞 NPM Commands

All commands are run from the root of the project:

| Command                   | Action                                                                |
| :------------------------ | :-------------------------------------------------------------------- |
| `npm install`             | Installs dependencies for all apps                                    |
| `npm run dev:web`         | Starts dev server at `localhost:4321` for the frontend                |
| `npm run dev:api`         | Starts dev server at `localhost:3001` for the API                     |
| `npm run dev:bot`         | Starts the Discord bot (watch mode)                                   |
| `npm run dev`             | Concurrently starts dev servers for web and API                       |
| `npm run dev:all`         | Concurrently starts dev servers for web, API, and Discord bot         |
| `npm run start:bot`       | Starts the Discord bot in production mode                             |
| `npm run test:web`        | Tests frontend web application                                        |
| `npm run test:api`        | Tests backend API                                                     |
| `npm run test`            | Concurrently tests frontend and backend                               |
| `npm run build`           | Build the web production site to `./dist/`                            |

---

## 🤖 Discord Bot

The Discord bot provides slash commands for managing team members and tracking shiny Pokemon:

- **Member Management**: `/addmember`, `/editmember`, `/deletemember`, `/member`
- **Shiny Management**: `/addshiny`, `/editshiny`, `/deleteshiny`, `/shiny`, `/shinies`
- **Statistics**: `/leaderboard`, `/stats`

### Setting up the Discord Bot

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Configure environment variables in `.env`:
   ```
   DISCORD_TOKEN=your-bot-token
   DISCORD_CLIENT_ID=your-client-id
   DISCORD_GUILD_ID=your-guild-id
   ```
3. Start the bot:
   ```bash
   npm run dev:bot     # Development with auto-reload
   npm run start:bot   # Production mode
   ```

For detailed documentation, see [apps/discord-bot/README.md](apps/discord-bot/README.md)

---

## 👥 Contributors & Credits

- **tu-annguyen** – Lead Developer & Designer  
- **dillonkkoval** – Developer

Special thanks to the [Astro](https://astro.build) team and the [PokeMMO](https://pokemmo.com/) community.

---

## 📚 Learn More

- [Astro Documentation](https://docs.astro.build)
- [Team SOJU Forum Club](https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/)
