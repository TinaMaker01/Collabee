# Collabee

Full-stack HR management application for SMEs — employee records, attendance, leave, tasks, departments, and admin controls.

## Tech Stack

| Layer          | Technology                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| **Frontend**   | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query, React Router 7 |
| **Backend**    | Hono 4, Node.js, TypeScript, Drizzle ORM 0.45, PostgreSQL 16                   |
| **Auth**       | JWT (HS256, 24h) + bcryptjs                                                    |
| **Validation** | Zod 4                                                                          |
| **i18n**       | i18next + react-i18next (EN/FR)                                                |
| **Testing**    | Vitest (43 tests, mocked DB)                                                   |
| **CI/CD**      | GitHub Actions (typecheck → test → build → Docker)                             |

## Quick Start

### With Docker

```bash
git clone <url> && cd collabee
cp server/.env.example server/.env
cp .env.example .env
docker compose up -d db
npm install
npm run dev          # Client + server start
# Migrations and seed run automatically
```

### Without Docker (local PostgreSQL)

```bash
cp server/.env.example server/.env
# Edit DATABASE_URL in server/.env with your local PostgreSQL credentials
createdb collabee          # Create the database first
npm install && npm run dev
```

## URLs

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| API      | http://localhost:3000 |

## Demo Accounts

Created automatically on first startup:

| Email                | Password    | Role    |
| -------------------- | ----------- | ------- |
| admin@collabee.com   | password123 | admin   |
| manager@collabee.com | password123 | manager |
| user@collabee.com    | password123 | user    |

## Scripts

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Client + server (hot-reload, auto-migrate) |
| `npm run dev:server` | Backend only                               |
| `npm run migrate`    | Run database migrations                    |
| `npm run dev:client` | Frontend only                              |
| `npm run build`      | Production build                           |
| `npm run test`       | Run tests                                  |
| `npm run lint`       | ESLint + TypeScript checks                 |
| `npm run typecheck`  | TypeScript type checking                   |

## Project Structure

```
collabee/
├── client/                  # React 19 + Vite 8 frontend
│   ├── src/
│   │   ├── components/      # Reusable UI (Modal, DataTable, etc.)
│   │   ├── context/         # Auth, theme
│   │   ├── i18n/            # EN/FR translations
│   │   ├── pages/           # Dashboard, Employees, Leave, etc.
│   │   ├── api/             # API client
│   │   └── utils/           # CSV export
│   └── vite.config.ts
├── server/                  # Hono 4 + Drizzle ORM backend
│   ├── src/
│   │   ├── db/              # Schema, migrations, seed
│   │   ├── middleware/      # Auth, error handling
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── test/            # Vitest test suites
│   │   └── utils/           # Logger, cache, CSV
│   ├── drizzle/             # SQL migration files
│   └── .env.example
├── .github/workflows/       # CI/CD
├── docker-compose.yml       # PostgreSQL + server + client
└── package.json             # npm workspaces (client + server)
```

## License

MIT — see [LICENSE](LICENSE).
