# Salonjaa Backend

Multi-city salon discovery, booking, and management platform. Node.js + Express + TypeScript, PostgreSQL/Drizzle ORM, Redis, BullMQ, email-OTP auth (JWT access 15min / refresh 30 days).

**Goal: ship MVP in 2 days. Work module-by-module, in the order given in `docs/TRD.md` §14. Don't skip ahead.**

## Read these before writing any code

1. **`docs/PROGRESS.md`** — what's actually built and tested right now. This is ground truth for current state, more current than the TRD.
2. **`docs/CONVENTIONS.md`** — the exact patterns (file layout, response shapes, ownership checks, validation, soft delete) every module must follow. Read this before writing a new module so it matches Modules 1-3.
3. **`docs/frontend_handover.md`** — the exact API contract (routes, request bodies, response shapes, auth requirements) frontend is building against. This is the source of truth for what to build — build only what's documented here.
4. **`docs/context.md`** — business decisions, booking-engine rules, and a "Pending Decisions" section listing things that are deliberately NOT yet specified. If something isn't in the API inventory or is listed under Pending Decisions, don't invent a contract for it — flag it instead.
5. **`docs/TRD.md`** — full target architecture: complete DB schema (§4), Redis key patterns (§9), BullMQ jobs (§10), security rules (§12), folder structure (§13), and the module build order (§14). This describes the whole system, including modules not built yet — treat it as the destination, and `docs/PROGRESS.md` as "how far along the road we are."

## Rules that override general instincts

- **Never build ahead of the documented contract.** If `frontend_handover.md` doesn't list an endpoint, don't add it, even if the TRD's DB schema implies it eventually needs one.
- **Match response shapes exactly**, including the couple of documented inconsistencies (e.g. `GET /users/me` returns field `name`, not `fullName`; `POST /auth/refresh-token` returns a bare `{ accessToken }` with no envelope). These are intentional, not bugs to "fix."
- **One module = one git commit.** Run `npm run typecheck && npm run build` before committing. Update `docs/PROGRESS.md` in the same commit.
- **Generate a Drizzle migration for every schema change**: `npm run db:generate && npm run db:migrate`. Never hand-write SQL migrations.
- **No endpoint exists for granting SALON_OWNER/ADMIN roles.** Use `npm run db:grant-role -- <email> <ROLE>` for local testing. Don't build a role-grant endpoint unless a future module spec asks for one.
- **No Google Maps dependency.** Location is plain `latitude`/`longitude` columns; frontend uses the browser's native Geolocation API. See `docs/PROGRESS.md` for the full rationale — don't re-decide this.

## Common commands
```bash
npm run dev              # tsx watch, auto-reloads
npm run typecheck        # tsc --noEmit
npm run build             # full build (includes tsc-alias for path resolution)
npm run db:generate       # generate Drizzle migration from schema changes
npm run db:migrate        # apply migrations
npm run db:seed           # seed CUSTOMER/SALON_OWNER/ADMIN roles + starter service_categories (run once, first setup)
npm run db:grant-role -- <email> <ROLE>   # dev-only role grant
npm run db:studio         # Drizzle Studio — browser DB viewer, like Prisma Studio
```

## Environment
Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ char random strings) before running anything. SMTP is optional — without it, OTPs print to the server console via the dev log-email provider instead of sending real email.
