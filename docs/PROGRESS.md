# Progress

Status as of last session. Update this file whenever a module ships or a decision is made — this is the single source of truth for "what actually exists right now," not the TRD (which describes the full target system, not current state).

## Done and tested (real Postgres + Redis, via Postman)

### Module 1 — Foundation + Auth
- `POST /api/v1/auth/send-otp` — `{ email }` → `{ success, message }`
- `POST /api/v1/auth/verify-otp` — `{ email, otp }` → `{ success, accessToken, refreshToken, user }`. First verify for an email auto-creates the user as role `CUSTOMER`.
- `POST /api/v1/auth/refresh-token` — `{ refreshToken }` → `{ accessToken }` (no `success` key — non-standard shape, intentional, matches frontend_handover.md exactly)
- `POST /api/v1/auth/logout` — auth required, `{ refreshToken }` → `{ success }`
- Migration `0000_shocking_maginty.sql` also created `notifications` and `notification_templates` (TRD §11 Notification Design) and `audit_logs` (TRD §12 Security Design). `notifications` is actively used today — the OTP provider inserts a row per send and updates it to `SENT`/`FAILED` for delivery tracking. `notification_templates` and `audit_logs` are schema only, no consumers yet: `notification_templates` is reserved for the Notification module (Development Order step 8), `audit_logs` for audit logging (Development Order steps 1 and 9).

### Module 2 — User + Address
- `GET /api/v1/users/me` → `{ id, name, email, phone, gender, dob, profileImage }` — **field is `name`, not `fullName`**, per frontend_handover.md's documented contract (differs from the PATCH request body field below — intentional, not a bug)
- `PATCH /api/v1/users/me` — `{ fullName?, gender?, dob? }` → `{ success, data }`
- `GET/POST /api/v1/users/me/addresses`, `PATCH/DELETE /api/v1/users/me/addresses/:id` — full CRUD, ownership-scoped, `isDefault` auto-clears other addresses
- **Deferred:** `GET /users/me/bookings` — depends on the `bookings` table, which belongs to the Booking module (not built). Don't stub this early; wire it up when Booking ships.

### Module 3 — Salon + Branch
- Migration `0002_lush_frightful_four.sql` (salon_owner_profiles, salons, branches, branch_holidays, branch_capacity_rules)
- `POST/GET /api/v1/salons`, `GET/PATCH/DELETE /api/v1/salons/:salonId` — all require `SALON_OWNER` role
- `POST /api/v1/branches` (needs `salonId`), `GET/PATCH /api/v1/branches/:id`, `GET /api/v1/branches?salonId=`
- `POST /api/v1/branches/:id/holidays`, `DELETE /api/v1/branches/:id/holidays/:holidayId`
- `POST /api/v1/branches/:id/capacity-rule`
- **Deferred (real TRD tables, but no documented endpoint yet — don't build these until a contract exists):** `salon_ownership_history`, `salon_gallery_images`, `branch_slot_templates`, `calendar_events`
- First salon creation by a user auto-creates their `salon_owner_profiles` row (find-or-create pattern) — there is no separate "become an owner" endpoint anywhere in the docs

### Module 4 — Catalogue + Staff
- Migration `0003_clever_living_tribunal.sql` (staff, staff_leaves, branch_services, service_categories, staff_services)
- `POST/GET /api/v1/staff`, `GET/PATCH/DELETE /api/v1/staff/:id` — all require `SALON_OWNER` role + branch ownership (`BranchService.assertOwned`, now public for cross-module use — see Branch's Staff/Service note below). `GET /staff` takes optional `branchId` query; omitted lists staff across every branch the caller owns (same pattern as `GET /branches`'s optional `salonId`). `DELETE` soft-deletes (`deletedAt`).
- `POST /api/v1/staff/:id/leave`, `DELETE /api/v1/staff/:id/leave/:leaveId` — leave cancellation sets `status = CANCELLED` per TRD ("cancellation changes status, never removes record") — `staff_leaves` has no `deletedAt` column, this is intentional, not a missed soft-delete.
- `POST/GET /api/v1/services`, `GET/PATCH/DELETE /api/v1/services/:id` — same branch-ownership + optional-`branchId` pattern as Staff. Table is `branch_services` in the DB (TRD naming), exposed as `/services` per frontend_handover.md.
- `POST /api/v1/services/:id/staff`, `DELETE /api/v1/services/:id/staff/:staffId` — staff↔service assignment; 409 on duplicate assignment, 404 if the staff member isn't in the same branch as the service (existence not leaked across branches, same philosophy as `assertOwned`).
- **`service_categories` has no CRUD endpoint anywhere in the docs** (TRD calls it "platform category lifecycle"; the Admin API inventory is empty in frontend_handover.md). Rows come only from `npm run db:seed` (8 starter categories) — same precedent as `db:grant-role` for roles. Build a real Admin endpoint only when that module defines the contract; don't add owner-facing category CRUD speculatively.
- **Deferred (real TRD table, no documented endpoint):** `service_images` (multi-image gallery per service). `branch_services` does have a single `imageUrl` column (TRD's "image URL"), settable via `PATCH /services/:id` — same precedent as `salons.logo`/`coverImage` being PATCH-only, undocumented-in-create fields.
- Money/experience fields (`basePrice`, `salary`, `consultationFee`) use `doublePrecision`, not `numeric` — the installed `drizzle-orm@0.33` doesn't support `numeric(..., { mode: "number" })`, and this codebase has no other numeric-string handling yet. Matches the existing `latitude`/`longitude` precedent. Revisit if exact decimal precision becomes a requirement (e.g. for Payment).
- `BranchService.assertOwned` was made `public` (was `private`) so Staff and Service can call it directly, per CONVENTIONS.md's "call the parent module's service to verify ownership" rule — same relationship Branch already has with `SalonService.assertOwned`.

### Module 5 — Availability
- Migration `0004_kind_mattie_franklin.sql` adds a **minimal** `bookings` table — only `branchId`, `selectedStaffId`, `scheduledStart`, `scheduledEnd`, `bookingStatus`, timestamps. This is deliberately not the full TRD `bookings` schema; Booking (Module 6, not started) will `ALTER TABLE` to add `customerId`, `salonId`, `bookingNumber`, `bookingType`, amounts, reasons, and approval/completion/cancellation timestamps when it builds real create/approve/cancel/reschedule flows. Never soft-deleted or hard-deleted, per TRD.
- `GET /api/v1/availability/slots`, `GET /api/v1/availability/staff` — both public, no auth. Query: `branchId`, `date` (YYYY-MM-DD, not in the past), `serviceIds` (**comma-separated** — not specified in frontend_handover.md, this is the chosen convention; e.g. `?serviceIds=id1,id2`).
- Three architectural gaps existed before this module could be built at all — resolved with the user, not guessed:
  1. **No slot-template CRUD exists** (`branch_slot_templates` was explicitly deferred in Module 3, no endpoint anywhere). Resolved: slots are generated at a **fixed 30-minute interval** (`DEFAULT_SLOT_INTERVAL_MINUTES` in `shared/constants.ts`) across the branch's `openingTime`→`closingTime`, ignoring `branch_slot_templates` entirely. Revisit if/when a template contract is ever added.
  2. **Capacity validation needs live bookings, but Booking (Module 6) doesn't exist.** Resolved: the minimal `bookings` table above. Right now it's always empty (nothing can insert into it until Module 6 ships), so capacity is effectively governed by chairs/staff only — but the overlap-counting logic is real and already correct for when rows start appearing.
  3. **Redis caching skipped.** TRD lists a `cache:availability:{...}` key but explicitly leaves its TTL "not numerically finalized" — decided to compute live on every request for MVP rather than wire invalidation across 5 mutation points (staff/leave/holiday/capacity-rule/service) for an unfinalized optimization. Add later as a hardening pass if needed.
- Capacity formula implemented exactly per TRD: `MIN(branch.totalChairs, activeServiceStaffCount, capacityOverride)`, where `activeServiceStaffCount` excludes staff with an `APPROVED` leave overlapping the specific candidate slot window (not just the whole day). Overlap check for both staff leave and existing bookings uses the TRD's exact `existing.start < new.end AND existing.end > new.start` rule (`end == start` is correctly treated as non-overlapping).
- `GET /availability/staff` is a **day-level** listing (frontend_handover.md's contract has no time param, only `date`): it excludes a staff member only if their `APPROVED` leave fully covers the entire business-hours window for that date. A staff member on leave for only part of the day still appears — the precise per-slot conflict is re-checked by `GET /availability/slots` and again inside the future booking-creation transaction (Module 6).
- `slotId` in the response is a plain `"HH:MM-HH:MM"` string (e.g. `"10:00-11:30"`) — not a persisted row, per TRD ("slot IDs are UI helpers"). Module 6's `POST /bookings` will need to decode this same format when it accepts a `slotId`.
- Response shape is a **bare array** for both endpoints (no `{success,data}` envelope), matching frontend_handover.md's literal documented shape — same exception category as `GET /users/me`.
- Verified end-to-end manually against a temporary local instance (real salon/branch/service/staff via the actual API, salon verification flipped directly in Postgres since no Admin endpoint exists yet) before this entry was written: confirmed capacity math, staff-leave capacity reduction, holiday short-circuit (`[]`), invalid-service 400, and the overlap boundary edge case, then cleaned up all test rows. Postman collection/spec ("Salonjaa API") has **not** been updated yet for this module — still only covers Modules 1-4.

## Dev tooling added along the way
- `npm run db:grant-role -- <email> <ROLE_NAME>` — CLI-only role grant (SALON_OWNER / ADMIN). No API endpoint for this exists in any source doc, so don't invent one — this stays a local dev script.
- `npm run db:studio` — Drizzle Studio (Prisma-Studio equivalent), browser-based DB browser at the URL it prints. Uses the same `DATABASE_URL` as the app.
- `npm run db:seed` now also seeds 8 starter `service_categories` rows (see Module 4 above), in addition to the three roles.

## Location/maps decision (settled, don't relitigate)
Backend stores plain `latitude`/`longitude` numeric columns only. No Google Maps dependency anywhere in the backend. `navigator.geolocation` (free, built into browsers) is what the frontend uses for "find near me." Nearby-branch search will be plain Haversine math or Postgres `earthdistance`, built when the Availability/Search module is built — not yet implemented.

## Not started yet
Booking, Payment, Coupon, Review, Notification, Admin. Follow `## 14. Development Order` in `docs/TRD.md` for the intended sequence — do not jump ahead to Payment before Booking exists, since Payment depends on it.

## Delivery workflow in use
Each module is a separate git commit. Work is handed to the user as `git format-patch` output (`000N-description.patch`), applied on their machine with `git am`. Keep committing one module = one commit so this keeps working.
