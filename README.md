# StockPilot POS and Inventory Management

StockPilot is a web-based point-of-sale and inventory system with separate staff and admin workspaces. Staff can process sales and manage their billing workflow. Administrators can manage products, categories, suppliers, customers, purchases, expenses, payments, ledger records, reports, and business settings.

This README is the setup and handoff guide for the whole repository.

## Project structure

```text
backend/    Express API, MongoDB models, authentication, and database seeding
frontend/   React, Vite, and Tailwind CSS application
```

The backend serves the API under `/api`. The Vite development server serves the frontend separately.

## Requirements

- Node.js 22.12 or newer (Node.js 20.19 or newer is also supported)
- npm
- A MongoDB database on a replica set or MongoDB Atlas cluster

StockPilot uses MongoDB transactions for seeding and financial workflows. A standalone local MongoDB server without replica set support will fail on those operations. MongoDB Atlas is suitable.

## Installation

Clone the repository, then install dependencies in each application directory:

```sh
git clone <repository-url>
cd <repository-directory>

cd backend
npm ci
cd ../frontend
npm ci
```

If a package lock file is not present in the copy you receive, use `npm install` in that directory instead of `npm ci`.

## Environment configuration

### Backend

Create `backend/.env` from the example:

```sh
cp backend/.env.example backend/.env
```

Set at least `DATABASE_URL` and `JWT_SECRET`. Example for MongoDB Atlas using a full connection URI:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb+srv://<db-user>:<db-password>@<cluster-host>/cloudhouse?retryWrites=true&w=majority
JWT_SECRET=<a-long-random-secret>
```

Generate a secret with `openssl rand -base64 32`. Replace the placeholders and URL-encode special characters in the database username or password when needed.

`DATABASE_URL` accepts either a complete URI beginning with `mongodb` or a cluster host. If you provide only the host, configure `MONGODB_USERNAME` and `MONGODB_PASSWORD`; the backend builds a MongoDB Atlas URI for the `cloudhouse` database.

### Frontend

Create `frontend/.env` with the API base URL:

```dotenv
VITE_SERVER_URL=http://localhost:3000/api
```

The frontend reads this value at startup. Restart Vite after changing it. Do not put secrets in frontend environment variables; Vite values are exposed to the browser.

Keep both `.env` files private and out of version control. Share `.env.example` files and setup instructions instead.

## Run locally

Start the backend in one terminal:

```sh
cd backend
npm run dev
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The backend defaults to `http://localhost:3000`, and its API is at `http://localhost:3000/api`.

To run the backend without the development watcher, use `npm start` from `backend/`.

## Development database seed

Seeding is restricted to `NODE_ENV=development` and requires `DATABASE_URL`. Confirm that `backend/.env` points to a development database before proceeding.

From `backend/`, run:

```sh
npm run seed
```

Alternatively, explicitly set the environment for the command:

```sh
NODE_ENV=development npm run seed
```

The seed is idempotent: rerunning it against a complete seed dataset leaves the existing records unchanged. It creates demo admin and staff accounts plus sample categories, suppliers, products, customers, purchases, bills, payments, expenses, ledger entries, and stock movements. The script prints record counts and demo login credentials after it succeeds.

Default development credentials:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@stockpilot-seed.invalid` | `DemoAdmin!2026` |
| Staff | `staff0001@stockpilot-seed.invalid` through `staff0005@stockpilot-seed.invalid` | `DemoStaff!2026` |

Change the defaults before the first seed by setting these optional variables in `backend/.env`:

```dotenv
SEED_ADMIN_USERNAME=StockPilot Demo Admin
SEED_ADMIN_EMAIL=admin@stockpilot-seed.invalid
SEED_ADMIN_PASSWORD=<your-development-password>
SEED_STAFF_PASSWORD=<your-development-password>
```

The admin email must use the reserved `@stockpilot-seed.invalid` domain for safe reset identification. Use the credentials printed by the seed command if they differ from the defaults.

To rebuild the seed data, run from `backend/`:

```sh
npm run seed:reset
```

Reset only removes records recognized as seed data. It refuses to proceed if non-seed business records depend on seed accounts or entities. It does not clear the whole database. Never point seed or reset commands at production data.

## Sign in and application routes

- `/login` — sign in
- `/signup` — create an account; regular signups use the staff role
- `/dashboard` — sends an authenticated user to the dashboard allowed for their role
- `/admin` — administrator workspace
- `/staff` — staff workspace

Admin and staff permissions are enforced by the frontend route guard and backend authorization middleware. Seeded demo accounts are intended for development only.

## Build and lint

From `frontend/`:

```sh
npm run build
npm run lint
npm run preview
```

`npm run preview` serves the most recent production build locally. The backend currently has no configured test suite; `npm test` reports that no tests are specified.

## Troubleshooting

### MongoDB connection or authentication fails

Check that `DATABASE_URL` is correct, the database user and password are valid, the host allows your IP address, and special characters in credentials are URL-encoded. For a host-only `DATABASE_URL`, also set `MONGODB_USERNAME` and `MONGODB_PASSWORD`.

### Transaction or replica set error

Use MongoDB Atlas or a MongoDB replica set. A standalone MongoDB instance does not support the transactions used by seed and billing workflows.

### Seed refuses to run

Set `NODE_ENV=development` and make sure `DATABASE_URL` is set in `backend/.env`. If the script reports a partial seed, inspect the target development database and use `npm run seed:reset` only if it contains no non-seed records that depend on the seeded data.

### Frontend cannot reach the API

Confirm the backend is running, then check that `frontend/.env` contains `VITE_SERVER_URL=http://localhost:3000/api`. Restart the frontend development server after changing the file. If you changed backend `PORT`, update the URL to match.

### Port is already in use

Stop the other process or choose another backend `PORT` and update `VITE_SERVER_URL`. Vite will print the actual frontend URL if its default port is unavailable.

## Sharing and deployment notes

- Include the source code and lock files; install dependencies with `npm ci` in both `backend/` and `frontend/`.
- Do not send committed credentials, database connection strings, or production secrets. Provide environment values to the recipient through a secure channel.
- Seeded accounts and sample records are development data. Create production users and configure production environment variables separately.
