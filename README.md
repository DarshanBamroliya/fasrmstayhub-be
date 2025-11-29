## Farnstayhub API

Farmstayhub is a NestJS backend that exposes:

- Admin JWT auth with MySQL persistence (register, login, profile)
- User-friendly onboarding via OTP SMS (simulated) and Google Sign-In
- Role-based protection so only admins need Bearer tokens while guests/users can access public flows
- Centralized configuration through environment variables and a lightweight mysql2 connection pool

## Getting Started

```bash
npm install
```

Create a `.env` file (or set matching host variables) using `config/env.example` as reference. The project is configured to read from either `.env` or `config/env.example` fallback if `.env` is unavailable.

```bash
npm run start:dev
```

The service boots with the prefix defined by `API_PREFIX` (defaults to `api/v1`). Health is available at `/health`.

## API Docs

Swagger UI is pre-wired at `/docs`. It reflects all Admin/User routes, shows example payloads, and offers a reusable `admin-token` bearer scheme for protected calls. Start the Nest app and visit `http://localhost:3000/docs` (or your configured port) to explore.

## MySQL Access

The app uses a shared mysql2 connection pool (`DatabaseModule`) for all queries. Make sure the `admins` and `users` tables exist in your `farmstayhub` schema (or override the connection via `DB_*` env vars) before starting the API.

## Auth Flows

- `POST /api/v1/admin/register` – create an admin with name/email/password
- `POST /api/v1/admin/login` – returns a JWT; attach it as `Authorization: Bearer <token>` for protected admin routes
- `GET /api/v1/admin/me` – guarded by role middleware to ensure only admins enter
- `POST /api/v1/users/request-otp` – generates and "sends" an OTP to the supplied phone
- `POST /api/v1/users/verify-otp` – validates OTP and marks the phone as verified
- `POST /api/v1/users/google` – verifies a Firebase-issued ID token server-side and responds with email, name, and profile photo

Admin-only routes require a token, whereas user/guest flows are accessible without authentication per the Farnstayhub requirement.

## Testing

```bash
npm run test
```

## Next Steps

- Plug in a real SMS provider inside `NotificationService`
- Configure Google Firebase credentials, then update `GOOGLE_SERVICE_ACCOUNT_PATH`
- Swap the stub SMS sender with a production provider before going live
