# Salonjaa Frontend Handover

Base URL: `/api/v1`. Send `Authorization: Bearer <accessToken>` on authenticated requests. Responses beyond the explicitly supplied examples are not finalized in the API Inventory; consume the shown fields only and handle standard `400`, `401`, `403`, `404`, `409`, `422`, `429`, and `500` failures where applicable.

## Backend build status

This whole document describes the target contract. Only the sections marked **🟢 Live** are actually built, running, and Postman-tested today — build frontend against those first. Everything marked **⚪ Not built** is contract-only: the endpoint doesn't exist on the server yet and calling it will 404. Check `docs/PROGRESS.md` in the backend repo for the current source of truth before starting frontend work on a section, in case this has moved on since you last pulled.

| Section below | Backend module | Status |
|---|---|---|
| Auth | Module 1 — Foundation + Auth | 🟢 Live |
| User and Address | Module 2 — User + Address | 🟢 Live (except `GET /users/me/bookings` — see note under that endpoint) |
| Salon and Branch | Module 3 — Salon + Branch | 🟢 Live |
| Staff and Services | Module 4 — Catalogue + Staff | 🟢 Live |
| Availability and Booking | Module 5 — Availability, Module 6 — Booking | 🟢 Live — all endpoints in this section are live except `POST /salon-bookings/:id/block-slot` (explicitly Future Feature — Not MVP, see that endpoint's note) |
| Payment and Coupon | Module 7 — Payment + Coupon | 🟢 Live |
| Reviews | Module 8 — Review + Notification | 🟢 Live except `POST /reviews/:reviewId/images` (see that endpoint's note) |
| Admin | Admin (not started) | ⚪ Not built |

A companion Postman collection ("Salonjaa API") and environment ("Salonjaa - Local") exist, generated from an OpenAPI spec at `postman/specs/openapi.yaml` in the backend repo — but it was only ever generated for Modules 1-4 and hasn't been kept in sync since (by explicit choice, not an oversight). Don't treat it as covering everything marked 🟢 Live above.

## Auth — 🟢 Live (Module 1 — Foundation + Auth)

### POST /auth/send-otp

Purpose: Send email login OTP. Authentication: Public. Body: `{ "email": "user@example.com" }`. Validation: valid email required; rate limited. Success: `{ "success": true, "message": "OTP sent successfully" }`. Errors: `400`, `429`, `500`. Frontend: disable during request and show resend countdown; loading is button-level; no empty state.

### POST /auth/verify-otp

Purpose: Verify OTP and create/login user. Authentication: Public. Body: `{ "email": "user@example.com", "otp": "123456" }`. Validation: valid email and active, unexpired, unused OTP. Success: `{ "success": true, "accessToken": "...", "refreshToken": "...", "user": {} }`. Errors: `400`, `401`, `429`, `500`. Frontend: prevent duplicate submit; store tokens only through the application’s approved session mechanism.

### POST /auth/refresh-token

Purpose: Issue a new access token. Authentication: Public. Body: `{ "refreshToken": "..." }`. Success: `{ "accessToken": "..." }`. Errors: `401`, `500`. Frontend: refresh once on expired access token, then require login if rejected.

### POST /auth/logout

Purpose: Invalidate the presented refresh-token session. Authentication: Authenticated. Body/query/path: none. Success: `{ "success": true }`. Errors: `401`, `500`. Frontend: clear local session regardless of successful server acknowledgement.

## User and Address — 🟢 Live (Module 2 — User + Address)

### GET /users/me

Purpose: Get current profile. Authentication: Authenticated. Request: none. Success: `{ "id": "", "name": "", "email": "" }`. Errors: `401`, `500`. Frontend: page/skeleton loading; show profile-empty placeholders for optional profile data.

### PATCH /users/me

Purpose: Update profile. Authentication: Authenticated. Body: `{ "fullName": "", "gender": "", "dob": "" }`. Validation: gender enum; valid date of birth. Success/error contract: not supplied. Errors: `400`, `401`, `500`. Frontend: disable Save while pending; retain entered values on validation error.

### POST /users/me/addresses; GET /users/me/addresses; PATCH /users/me/addresses/:id; DELETE /users/me/addresses/:id

Purpose: Create, list, update, and delete only the current user’s addresses. Authentication: Authenticated. Body/query/path: `id` is required for PATCH/DELETE; field contract is not supplied. Validation: owned address, address fields per backend schema. Success/error contract: not supplied. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: use list skeleton; show “no saved addresses” empty state; disable address action while mutation runs.

### GET /users/me/bookings — ⚪ Not built

Purpose: Customer booking history. Authentication: Authenticated. Query: `status=COMPLETED|CANCELLED|UPCOMING` (inventory values). Success/error contract: not supplied. Errors: `401`, `500`. Frontend: filter loading state; show empty history per selected status. **Backend note:** deferred — depends on the `bookings` table, which belongs to the not-yet-built Booking module. Don't build this screen until it's live.

## Salon and Branch — 🟢 Live (Module 3 — Salon + Branch)

### POST /salons

Purpose: Create salon registration. Authentication: Salon Owner. Body: `{ "name":"Salonjaa Premium", "description":"...", "businessName":"...", "gstNumber":"...", "panNumber":"..." }`. Validation: owner role; onboarding information required. Success/error contract: not supplied. Errors: `400`, `401`, `403`, `500`. Frontend: explain salon remains pending Admin review; disable submit while loading.

### GET /salons; GET /salons/:salonId; PATCH /salons/:salonId; DELETE /salons/:salonId

Purpose: List owner salons; fetch/update/soft-delete an owned salon. Authentication: Salon Owner. Path: `salonId` where applicable. GET list success: `[{ "id":"", "name":"" }]`; other body/response contracts not supplied. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: list skeleton and “no salons yet” empty state; confirm deletion; present verification status.

### POST /branches; GET /branches; GET /branches/:id; PATCH /branches/:id

Purpose: Create/list/get/update branches. Authentication: Salon Owner with owning salon access. Create body: `{ "salonId":"", "name":"", "phone":"", "email":"", "addressLine1":"", "city":"", "state":"", "postalCode":"", "latitude":0, "longitude":0, "totalChairs":5, "openingTime":"09:00", "closingTime":"21:00" }`. Validation: chair count > 0; opening before closing. Other contracts not supplied. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: show no-branch state; disable create/save mutation controls.

### POST /branches/:id/holidays; DELETE /branches/:id/holidays/:holidayId; POST /branches/:id/capacity-rule

Purpose: Manage branch holiday and capacity override. Authentication: owning Salon Owner. Holiday body: `{ "date":"2026-12-25", "reason":"Christmas" }`; capacity body: `{ "maxCapacityOverride":3 }`. Validation: valid future/operational date; override > 0. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: refresh availability/calendar after successful mutation; show empty holiday state.

## Staff and Services — 🟢 Live (Module 4 — Catalogue + Staff)

### POST /staff; GET /staff; GET /staff/:id; PATCH /staff/:id; DELETE /staff/:id

Purpose: Create/list/get/update/disable staff. Authentication: owning Salon Owner. Create body: `{ "branchId":"", "fullName":"", "phone":"", "staffType":"NORMAL", "experienceYears":5, "salary":25000 }`; list query: `branchId`. Validation: staff type enum and owned branch. Other contracts not supplied. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: branch-filtered list with empty state; disable row controls while a mutation runs.

### POST /staff/:id/leave; DELETE /staff/:id/leave/:leaveId

Purpose: Create/cancel staff leave. Authentication: owning Salon Owner. Body: `{ "startDateTime":"", "endDateTime":"", "reason":"" }`. Validation: end after start; owned staff. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: refresh staff availability and calendar on success.

### POST /services; GET /services; GET /services/:id; PATCH /services/:id; DELETE /services/:id

Purpose: Create/list/get/update/disable branch services. Authentication: owning Salon Owner. Create body: `{ "branchId":"", "categoryId":"", "name":"Haircut", "durationMinutes":60, "basePrice":250 }`; query: `branchId`. Validation: duration/price > 0; owned branch. Errors: `400`, `401`, `403`, `404`, `500`. Frontend: branch-filtered empty state and save-level loading.

### POST /services/:id/staff; DELETE /services/:id/staff/:staffId

Purpose: Assign/remove a staff member for a service. Authentication: owning Salon Owner. POST body: `{ "staffId":"" }`; DELETE path has both IDs. Validation: service and staff must belong to same owned branch. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: disable duplicates and refresh available-staff lists.

## Availability and Booking — 🟢 Live (Module 5 — Availability, Module 6 — Booking)

### GET /availability/slots — 🟢 Live

Purpose: Return available booking start slots. Authentication: Public. Query: `branchId`, `date`, `serviceIds`. Success: `[{ "slotId":"", "startTime":"10:00", "endTime":"11:30", "available":true }]`. Validation: valid active services at branch/date. Errors: `400`, `404`, `500`. Frontend: debounce selection changes, show inline loading, and show “no slots available” empty state. **Backend notes:** `serviceIds` is **comma-separated** (e.g. `?serviceIds=id1,id2`) — not specified in the original inventory, this is the implementation's chosen convention. `slotId` is a plain `"HH:MM-HH:MM"` string, not a persisted ID — the future `POST /bookings` will need to accept this same format back. Slots are generated at a fixed 30-minute interval (no per-branch template configuration exists yet).

### GET /availability/staff — 🟢 Live

Purpose: Return eligible available staff. Authentication: Public. Query: `branchId`, `serviceIds`, `date`. Success: `[{ "staffId":"", "name":"", "type":"NORMAL" }]`. Errors: `400`, `404`, `500`. Frontend: allow “no preference”; show no eligible stylist state. **Backend note:** this is a day-level listing (no time param in the contract) — a staff member appears unless their approved leave covers the *entire* business day. Partial-day leave conflicts are only caught by `GET /availability/slots` and, later, at actual booking creation.

### POST /bookings — 🟢 Live

Purpose: Create pending customer booking and immediately reserve capacity. Authentication: Customer. Body: `{ "salonId":"salon_123", "branchId":"branch_123", "services":["service_1","service_2"], "staffId":"staff_123", "bookingDate":"2026-10-01", "slotId":"slot_123", "notes":"Optional notes" }`. Validation: staff optional; nonempty services; availability/capacity/stylist checks. Success: `{ "bookingId":"", "status":"PENDING" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent double submit, refresh slots on conflict, show pending-approval state. **Backend note:** `slotId` must be the exact `"HH:MM-HH:MM"` string from `GET /availability/slots` — only the start half is actually used; the end time is recomputed from the requested services' durations.

### GET /bookings/:id; GET /bookings/my-bookings — 🟢 Live

Purpose: Booking detail/history. Authentication: detail: Customer owner, owning Salon Owner, or Admin; history: Customer. History query: `status=PENDING|APPROVED|CANCELLED|COMPLETED`. Detail success: `{ "booking": {} }`. Errors: `401`, `403`, `404`, `500`. Frontend: skeleton detail/history and status-specific empty state.

### POST /bookings/:id/cancel — 🟢 Live (provisional policy)

Purpose: Customer cancellation. Authentication: booking owner. Body: `{ "reason":"Change of plans" }`. Validation: upcoming, not completed; cancellation policy/strike rules apply. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirmation dialog, mutation lock, update local availability/history. **Backend note:** the real cancellation cutoff/strike policy is still being finalized with the client — today, any PENDING/APPROVED booking can be cancelled any time before its start, with no strike ever recorded. This will change once the policy is confirmed; don't build frontend copy that promises today's behavior is final.

### POST /bookings/:id/reschedule-request; POST /bookings/:id/approve-reschedule; POST /bookings/:id/reject-reschedule — 🟢 Live

Purpose: Customer proposed reschedule and Salon Owner decision. Authentication: customer owner for request; owning Salon Owner for decision. Request body: `{ "bookingDate":"2026-10-03", "slotId":"slot_456", "reason":"Not available" }`; rejection body `{ "reason":"" }`; approval body not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: retain original appointment until accepted; show request-pending UI. **Backend note:** approve/reject always act on the booking's most recent pending reschedule request — there's no request ID in these routes.

### GET /salon-bookings; POST /salon-bookings/:id/approve; POST /salon-bookings/:id/reject; POST /salon-bookings/:id/propose-reschedule; POST /salon-bookings/walk-in — 🟢 Live

Purpose: Salon booking management. Authentication: owning Salon Owner. List query: `status=PENDING|APPROVED|COMPLETED|CANCELLED`. Approve body: `{ "notes":"" }`; reject body `{ "reason":"" }` (reason required); proposed-reschedule body `{ "bookingDate":"", "slotId":"", "reason":"" }`; walk-in body `{ "customerName":"", "customerPhone":"", "services":[], "staffId":"", "bookingDate":"", "slotId":"" }`. Validation: owned booking/branch; full availability validation; walk-ins consume capacity and use standard duration/pricing. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: owner dashboard status filters, action-level loading, no-bookings state, confirm reject/walk-in creation. **Backend notes:** (1) `walk-in`'s `staffId` is required, not optional as elsewhere — it's the only field in this body that tells the backend which branch the walk-in belongs to, and a walk-in is created straight to `APPROVED` (no separate approval step). (2) `propose-reschedule` creates the request, but there's currently no endpoint for the customer to accept/reject a salon-proposed reschedule — don't build that screen yet, it has nothing to call.

### POST /salon-bookings/:id/block-slot

Purpose: Explicitly marked **Future Feature — Not MVP** in the supplied API Inventory. Do not call or build a UI for this endpoint.

## Payment and Coupon — 🟢 Live (Module 7 — Payment + Coupon)

### POST /payments/create-order; POST /payments/verify — 🟢 Live

Purpose: Create/verify online payment. Authentication: Customer. Create body `{ "bookingId":"booking_123" }`; success `{ "orderId":"", "amount":500, "currency":"INR" }`. Verify body `{ "orderId":"", "paymentId":"", "signature":"" }`; success `{ "success":true, "paymentStatus":"SUCCESS" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent duplicate payment initiation; complete only after verification response; show retry UI for failure. **Backend notes:** provider is Razorpay — `create-order` requires the booking to already be `APPROVED` by the salon (409 otherwise) and blocks a second order while one is pending/paid (a failed one can be retried). No webhook exists; a payment only ever updates when the frontend actually calls `/verify` after Razorpay checkout completes, so don't skip that call on any code path.

### GET /payments/:paymentId; GET /payments/my-payments; POST /payments/refund-request; GET /payments/refunds; GET /payments/salon-settlements — 🟢 Live (refund policy provisional)

Purpose: Payment/refund/settlement reads and customer refund request. Authentication: payment detail Customer owner, owning Salon Owner, or Admin; my/refunds Customer; settlements owning Salon Owner. Refund body `{ "bookingId":"", "reason":"" }`; booking must be refund-eligible, initial status PENDING. Settlement example `[{ "settlementId":"", "amount":5000, "status":"COMPLETED" }]`. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: use finance-table skeletons and empty states; show refund PENDING as non-final. **Backend note:** like booking cancellation, the real refund eligibility policy is still being finalized with the client — today, a refund can be requested only for a `CANCELLED` or `COMPLETED` booking with a successful payment, full amount only, once per payment. This will change once the policy is confirmed. `salon-settlements` will return an empty list until settlement records are created manually — there's no endpoint that generates them yet.

### POST /payments/coupons/validate — 🟢 Live

Purpose: Validate coupon before booking confirmation. Authentication: Customer. Body `{ "couponCode":"", "bookingAmount":1000 }`. Success `{ "valid":true, "discount":100 }`. Errors: `400`, `401`, `422`, `500`. Frontend: validate on explicit apply, show inline result, never trust client-calculated discount. **Backend note:** this is a preview only — there's no field on `POST /bookings` to actually attach a coupon to a booking, so validating a coupon here has no side effect and doesn't reserve/consume it. An invalid, expired, exhausted, or below-minimum coupon returns `422` with a message, not a soft `{valid:false}`.

## Reviews — 🟢 Live (Module 8 — Review + Notification), except images

### POST /reviews — 🟢 Live; PATCH /reviews/:reviewId — 🟢 Live (edit period provisional); POST /reviews/:reviewId/images — ⚪ Not built

Purpose: Create, upload images for, and edit an owned review. Authentication: Customer. Create body `{ "bookingId":"", "overallRating":5, "review":"Excellent service", "serviceRating":5, "staffRating":5, "hygieneRating":5, "ambienceRating":5, "productRating":5 }`. Validation: completed booking, one review/booking, ratings 1–5; edit only by owner in allowed edit period; image upload contract not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: validate rating bounds, upload with per-file progress, show completed-booking-only empty/locked state. **Backend notes:** a booking becomes reviewable automatically once its scheduled time passes (no separate "mark complete" action exists — this happens on its own). The "allowed edit period" has no defined cutoff yet (same unresolved policy category as booking cancellation) — edits are accepted at any time for now. `POST /reviews/:reviewId/images` is **not implemented** — its request contract was never specified anywhere, so there was nothing to build against; don't wire an image-upload UI to it yet.

### GET /reviews/:reviewId; GET /reviews/salon/:salonId; GET /reviews/service/:serviceId; GET /reviews/staff/:staffId — 🟢 Live

Purpose: Read review detail/listings. Authentication: not specified; treat as public display routes. Request/response pagination contracts not supplied. Errors: `400`, `404`, `500`. Frontend: skeleton cards and “no reviews yet” state. **Backend note:** no pagination is implemented (none was specified) — these return the full list every time.

### POST /reviews/:reviewId/report; POST /reviews/:reviewId/reply — 🟢 Live

Purpose: Report review or salon-owner reply. Authentication: report Customer or Salon Owner; reply owning Salon Owner. Report body `{ "reason":"" }`; reply body `{ "message":"" }`. Validation: reviewer identity/ownership; response contracts not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirm report, lock reply submit while pending, update thread on success.

## Admin — ⚪ Not built (Admin module not started)

The supplied Admin API Inventory contains no endpoints. Do not implement frontend calls for Admin until its endpoint inventory defines method, path, request, response, and authorization contract.
