# Environments

- Client hosting: Vercel
  - Per-branch previews: every branch gets a unique preview URL
  - Permanent dev preview: the `dev` branch serves as the stable dev preview
  - All previews are considered "dev" because they talk to the dev API
- API backends:
  - Dev API: Fly.io (app uses prebuilt image from CI)
  - Prod API: Render (deployed from `main` via webhook)

Client → API mapping:
- Local: client on Vite (`npm run dev`), API at `http://localhost:3000/`
- Vercel previews (any branch, including `dev`): API base `https://sc2cr-dev.fly.dev`
- Production (main): API base `https://sc2cr-latest.onrender.com/`

Config files:
- `src/client/config/local.config.json`: `{ "API_URL": "http://localhost:3000/" }`
- `src/client/config/dev.config.json`: `{ "API_URL": "https://sc2cr-dev.fly.dev" }`
- `src/client/config/prod.config.json`: `{ "API_URL": "https://sc2cr-latest.onrender.com/" }`
