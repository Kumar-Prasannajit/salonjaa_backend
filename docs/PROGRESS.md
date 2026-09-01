# Progress

Status as of last session. Update this file whenever a module ships or a decision is made — this is the single source of truth for "what actually exists right now," not the TRD (which describes the full target system, not current state).

## Done and tested (real Postgres + Redis, via Postman)

### Module 1 — Foundation + Auth
- `POST /api/v1/auth/send-otp` — `{ email }` → `{ success, message }`
- `POST /api/v1/auth/verify-otp` — `{ email, otp }` → `{ success, accessToken, refreshToken, user }`. First verify for an email auto-creates the user as role `CUSTOMER`.
- `POST /api/v1/auth/refresh-token` — `{ refreshToken }` → `{ accessToken }` (no `success` key — non-standard shape, intentional, matches frontend_handover.md exactly)
- `POST /api/v1/auth/logout` — auth required, `{ refreshToken }` → `{ success }`

### Module 2 — User + Address
- `GET /api/v1/users/me` → `{ id, name, email, phone, gender, dob, profileImage }` — **field is `name`, not `fullName`**, per frontend_handover.md's documented contract (differs from the PATCH request body field below — intentional, not a bug)
- `PATCH /api/v1/users/me` — `{ fullName?, gender?, dob? }` → `{ success, data }`
- `GET/POST /api/v1/users/me/addresses`, `PATCH/DELETE /api/v1/users/me/addresses/:id` — full CRUD, ownership-scoped, `isDefault` auto-clears other addresses
- **Deferred:** `GET /users/me/bookings` — depends on the `bookings` table, which belongs to the Booking module (not built). Don't stub this early; wire it up when Booking ships.

### Module 3 — Salon + Branch
- `POST/GET /api/v1/salons`, `GET/PATCH/DELETE /api/v1/salons/:salonId` — all require `SALON_OWNER` role
- `POST /api/v1/branches` (needs `salonId`), `GET/PATCH /api/v1/branches/:id`, `GET /api/v1/branches?salonId=`
- `POST /api/v1/branches/:id/holidays`, `DELETE /api/v1/branches/:id/holidays/:holidayId`
- `POST /api/v1/branches/:id/capacity-rule`
- **Deferred (real TRD tables, but no documented endpoint yet — don't build these until a contract exists):** `salon_ownership_history`, `salon_gallery_images`, `branch_slot_templates`, `calendar_events`
- First salon creation by a user auto-creates their `salon_owner_profiles` row (find-or-create pattern) — there is no separate "become an owner" endpoint anywhere in the docs

## Dev tooling added along the way
- `npm run db:grant-role -- <email> <ROLE_NAME>` — CLI-only role grant (SALON_OWNER / ADMIN). No API endpoint for this exists in any source doc, so don't invent one — this stays a local dev script.
- `npm run db:studio` — Drizzle Studio (Prisma-Studio equivalent), browser-based DB browser at the URL it prints. Uses the same `DATABASE_URL` as the app.

## Location/maps decision (settled, don't relitigate)
Backend stores plain `latitude`/`longitude` numeric columns only. No Google Maps dependency anywhere in the backend. `navigator.geolocation` (free, built into browsers) is what the frontend uses for "find near me." Nearby-branch search will be plain Haversine math or Postgres `earthdistance`, built when the Availability/Search module is built — not yet implemented.

## Not started yet
Staff, Service Category, Service, Availability, Booking, Payment, Coupon, Review, Admin. Follow `## 14. Development Order` in `docs/TRD.md` for the intended sequence — do not jump ahead to Booking/Payment before Staff/Service/Availability exist, since Booking depends on all of them.

## Delivery workflow in use
Each module is a separate git commit. Work is handed to the user as `git format-patch` output (`000N-description.patch`), applied on their machine with `git am`. Keep committing one module = one commit so this keeps working.
