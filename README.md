# Collabee 🐝

A modern, full-stack collaborative HR management platform designed for SMEs — featuring employee directory, attendance tracking with self check-in, leave management, interactive Kanban tasks, department structure, documents, and role-based administration.

---

## 🌟 Key Features

- **📊 Centralized Dashboard:** Real-time KPI stats (active employees, today's attendance, pending leave approvals, active tasks) powered by aggregated SQL queries.
- **⏱️ Attendance & Self Check-In:** One-click Clock-In / Clock-Out for employees, automatic status calculation (Present, Late), daily logs, and unique date constraints.
- **🏖️ Leave Management & Balances:** Multi-type leave requests (Annual, Sick, Personal, Unpaid), approval workflows, automatic remaining balance calculation, and overlapping date validation.
- **📋 Dual-View Task Management:**
  - **Kanban Board:** Interactive 4-column board (_To Do_, _In Progress_, _Blocked_, _Done_) with fast status updates.
  - **Data Table:** Filterable, sortable table with priority badges and assignee details.
- **👥 Employee Directory:** Profiles with positions, departments, status tracking, and optimized batched CSV bulk-import.
- **🏢 Department Management:** Department directory with manager dropdown selection and automatic member count.
- **📁 Document Tracking:** Direct document records with HTTPS URL validation.
- **🔍 Quick Search Command Palette (⌘K / Ctrl+K):** Keyboard-accessible modal for instant navigation across all modules.
- **🔒 Enterprise Security:**
  - BOLA / IDOR protection across task and leave endpoints.
  - Non-blocking async bcrypt hashing.
  - Strict rate limiting on authentication routes (`/api/auth/login`, `/api/auth/register`).
  - Self-deletion and last-admin deletion safeguards.
  - CSV formula injection sanitization (`=`, `+`, `-`, `@`) and UTF-8 BOM encoding for Excel.
  - Pino logger with sensitive data redaction (passwords, tokens, authorization headers).
- **♿ Accessibility (a11y) & UI/UX:**
  - WCAG-compliant modals with focus trapping (Tab / Shift+Tab), Escape key dismiss, and background scroll locking.
  - Screen reader friendly loaders (`role="status"` + `sr-only`).
  - Dynamic `<html lang>` synchronization with i18n language switching.
  - Full Dark Mode support across the entire interface and notification toasts.
  - Dedicated 404 Not Found page and role-based route guards (`/admin` restricted).

---

## 🛠️ Tech Stack

| Layer                    | Technology                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Frontend**             | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query v5, React Router 7                                 |
| **Backend**              | Hono 4, Node.js 20+, TypeScript, Drizzle ORM 0.45, PostgreSQL 16                                                |
| **Authentication**       | JWT (HS256) + async bcryptjs                                                                                    |
| **Validation**           | Zod 4 schemas shared across client and server                                                                   |
| **Internationalization** | i18next + react-i18next (English & French with auto-detection)                                                  |
| **Testing**              | Vitest (64 backend tests across 11 test suites + client test suites, `@vitest/coverage-v8`)                     |
| **DevOps & Containers**  | Docker multi-stage builds, non-root users (`USER node`, `nginx-unprivileged`), Nginx security headers & caching |
| **CI/CD**                | GitHub Actions (lint → format check → typecheck → tests → Docker build with SHA/latest tags)                    |

---

## 🚀 Quick Start

### Option 1: Full-Stack with Docker Compose (Recommended)

```bash
# 1. Copy environment files
cp .env.example .env
cp server/.env.example server/.env

# 2. Start all services (PostgreSQL + API + Client)
docker compose up --build -d

# 3. Seed demo data (optional)
docker compose exec server npm run seed
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API Server:** [http://localhost:3000](http://localhost:3000)

---

### Option 2: Docker for Database only + Local Node.js

```bash
# 1. Start PostgreSQL
docker compose up -d db

# 2. Setup server environment
cp server/.env.example server/.env

# 3. Install dependencies and start both client & server
npm install
npm run dev
```

---

### Option 3: Local PostgreSQL (without Docker)

```bash
# 1. Setup server environment
cp server/.env.example server/.env
# Edit DATABASE_URL in server/.env with your local PostgreSQL credentials

# 2. Create the database
createdb collabee

# 3. Install and launch
npm install
npm run migrate -w server
npm run seed -w server
npm run dev
```

---

## 👤 Demo Accounts

Pre-configured accounts created by the seed script:

| Email                  | Password      | Role        | Permissions                                                  |
| ---------------------- | ------------- | ----------- | ------------------------------------------------------------ |
| `admin@collabee.com`   | `password123` | **Admin**   | Full system access, administration, user management          |
| `manager@collabee.com` | `password123` | **Manager** | Department tasks, leave approvals, employee directory        |
| `user@collabee.com`    | `password123` | **User**    | Self check-in/out, personal tasks, leave requests, directory |

---

## 📜 Available Scripts

Run from the root repository:

| Command                     | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Launch both frontend and backend concurrently with hot reload |
| `npm run dev:server`        | Start backend development server only                         |
| `npm run dev:client`        | Start frontend development server only                        |
| `npm run build`             | Build production bundles for both client and server           |
| `npm run test`              | Run all test suites across workspaces                         |
| `npm run lint`              | Run ESLint and TypeScript checks across workspaces            |
| `npm run typecheck`         | Run TypeScript compiler checks without emitting files         |
| `npm run format`            | Format entire codebase with Prettier                          |
| `npm run format:check`      | Verify formatting consistency with Prettier                   |
| `npm run seed -w server`    | Populate the database with initial demo data                  |
| `npm run migrate -w server` | Apply Drizzle ORM database migrations                         |

---

## 📡 API Overview

| Route Prefix           | Access                 | Description                                                  |
| ---------------------- | ---------------------- | ------------------------------------------------------------ |
| `/api/auth`            | Public / Authenticated | Login, registration, profile update, password change         |
| `/api/dashboard/stats` | Authenticated          | Aggregated real-time metrics and today's attendance stats    |
| `/api/employees`       | Authenticated          | Employee directory, profile details, batched CSV bulk-import |
| `/api/attendance`      | Authenticated          | Attendance records, 1-click `/check-in` & `/check-out`       |
| `/api/leave`           | Authenticated          | Leave requests, manager approvals, overlap validation        |
| `/api/leave-balance`   | Authenticated          | Remaining leave quotas by type                               |
| `/api/tasks`           | Authenticated          | Tasks CRUD, Kanban status updates, assignee notifications    |
| `/api/departments`     | Authenticated          | Department listings and manager assignments                  |
| `/api/documents`       | Authenticated          | Document metadata with validated links                       |
| `/api/notifications`   | Authenticated          | User notification feed with mark-as-read                     |
| `/api/admin/users`     | Admin only             | User account management and role assignments                 |
| `/api/activity-logs`   | Admin / Manager        | Complete audit trail of system mutations                     |

---

## 📁 Project Architecture

```
collabee/
├── client/                     # React 19 + Vite 8 frontend
│   ├── src/
│   │   ├── api/                # Typed API client with JWT handling
│   │   ├── components/         # Reusable UI (Modal, DataTable, LoadingSpinner, Toaster, Icons)
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── i18n/               # English & French translation bundles
│   │   ├── pages/              # Dashboard, Attendance, Tasks (Kanban/Table), Leave, Employees, Admin, 404...
│   │   └── utils/              # Secure CSV export with formula sanitization & UTF-8 BOM
│   ├── nginx.conf              # Production Nginx config (security headers, caching)
│   └── Dockerfile              # Non-root unprivileged Nginx container
├── server/                     # Hono 4 + Drizzle ORM backend
│   ├── src/
│   │   ├── db/                 # PostgreSQL schema, Drizzle client, seed script
│   │   ├── middleware/         # JWT auth, RBAC guards, rate limiting, error handling
│   │   ├── routes/             # API handlers (auth, dashboard, employees, attendance, tasks...)
│   │   ├── services/           # Async auth & leave balance business logic
│   │   ├── test/               # Vitest test suites (64 tests across 11 files)
│   │   └── utils/              # Activity logger, in-memory cache, Pino logger
│   ├── drizzle/                # SQL migrations & metadata journal
│   └── Dockerfile              # Multi-stage production container (USER node, pruned dependencies)
├── .github/workflows/          # CI/CD pipelines (ci.yml, docker.yml)
├── docker-compose.yml          # Local orchestration (PostgreSQL, server, client)
└── package.json                # npm workspaces root configuration
```

---

## 📄 License

MIT — see [LICENSE](LICENSE).
