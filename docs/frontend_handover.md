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
| Public Browse | Module 10 — Public Salon/Branch Browse | 🟢 Live |
| Availability and Booking | Module 5 — Availability, Module 6 — Booking | 🟢 Live — all endpoints in this section are live except `POST /salon-bookings/:id/block-slot` (explicitly Future Feature — Not MVP, see that endpoint's note) |
| Payment and Coupon | Module 7 — Payment + Coupon | 🟢 Live |
| Reviews | Module 8 — Review + Notification | 🟢 Live except `POST /reviews/:reviewId/images` (see that endpoint's note) |
| Admin | Module 9 — Admin | 🟡 Partial — salon approval, refunds, complaints, and reports are all 🟢 Live (docs/ADMIN_CONTRACT.md fully implemented); everything else ⚪ Not built |

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

## Public Browse — 🟢 Live (Module 10 — Public Salon/Branch Browse)

This section didn't exist in the original API Inventory — it was co-defined starting from `docs/PROPOSED_PUBLIC_BROWSE_CONTRACT.md` (frontend repo), the same "draft it, then build it together" process Admin used. It unblocks Home, Explore, Salon Details, and Select Services, which previously had nothing to call (every prior salon/branch/service read was Salon-Owner-scoped).

### GET /public/branches — 🟢 Live

Purpose: Search/list branches for Home ("Popular Near You") and Explore/Nearby Salons. Authentication: Public — browsing stays fully anonymous through Checkout, where `POST /bookings`'s existing Customer auth requirement first applies (unchanged). Query: `city?`, `q?` (free-text over salon/branch name), `serviceCategoryId?`, `lat?`+`lng?` (must be supplied together, and are required when `sort=distance`), `sort?` (`distance|rating|popular`, default `popular`). Success: `[{ "branchId":"", "salonId":"", "salonName":"", "branchName":"", "city":"", "addressLine1":"", "coverImage":null, "distanceKm":0.8, "averageRating":4.8, "reviewCount":512 }]` — bare array, no envelope. Errors: `400`, `500`. Frontend: list skeleton, "no salons found" empty state, debounce `q`. **Backend notes:** (1) the proposal's `area` field doesn't exist — `branches` has no such column, only `addressLine1`/`addressLine2`/`city`/`state`/`postalCode`; use `addressLine1` for the secondary location line. (2) `distanceKm` is only present when `lat`+`lng` were supplied, computed via plain Haversine (no Google Maps, matches the existing location decision), not persisted/cached. (3) Only a `VERIFIED` + `ACTIVE` salon's `ACTIVE` branches ever appear — same "bookable" gate `GET /availability/slots` already enforces. (4) No pagination (same precedent as the Reviews listing endpoints).

### GET /public/branches/:branchId — 🟢 Live

Purpose: Salon Details screen, service menu embedded for Select Services. Authentication: Public. Success: `{ "branchId":"", "salonId":"", "salonName":"", "branchName":"", "description":"", "coverImage":null, "gallery":[], "city":"", "addressLine1":"", "latitude":0, "longitude":0, "verificationStatus":"VERIFIED", "averageRating":4.8, "reviewCount":512, "openingTime":"09:00", "closingTime":"21:00", "services":[{ "id":"", "categoryId":"", "categoryName":"", "name":"", "durationMinutes":45, "basePrice":499, "imageUrl":null }] }` — bare object, no envelope. Errors: `404` (not found, or found but not `VERIFIED`/`ACTIVE` — same non-leaking 404 as an owner requesting a branch they don't own), `500`. Frontend: skeleton detail, only list `services` with `status=ACTIVE`. **Backend note:** `gallery` is always `[]` — `salon_gallery_images` doesn't exist yet (deferred since Module 3, still no contract); the field is present so this doesn't need a breaking shape change whenever that ships.

### GET /service-categories — 🟢 Live

Purpose: "Top Services" chips (Home) and the category filter row (Select Services). Authentication: Public. Success: `[{ "id":"", "name":"Haircut", "icon":null }]` — bare array. Errors: `500`. Frontend: static-ish list, safe to cache client-side for the session. **Backend note:** backing data is `npm run db:seed`'s 8 starter categories (Module 4) — there's still no category CRUD endpoint anywhere; this is only the first read route over that existing data.

### Not proposed / explicitly out of scope for this section
Per `docs/PROPOSED_PUBLIC_BROWSE_CONTRACT.md`'s own scope call: no discount/promo badge (no source of truth), no favourites/wishlist (`context.md` Pending Decision), no coupon/offers browsing (only `POST /payments/coupons/validate` exists — see the Payment section's coupon note).

## Availability and Booking — 🟢 Live (Module 5 — Availability, Module 6 — Booking)

### GET /availability/slots — 🟢 Live

Purpose: Return available booking start slots. Authentication: Public. Query: `branchId`, `date`, `serviceIds`. Success: `[{ "slotId":"", "startTime":"10:00", "endTime":"11:30", "available":true }]`. Validation: valid active services at branch/date. Errors: `400`, `404`, `500`. Frontend: debounce selection changes, show inline loading, and show “no slots available” empty state. **Backend notes:** `serviceIds` is **comma-separated** (e.g. `?serviceIds=id1,id2`) — not specified in the original inventory, this is the implementation's chosen convention. `slotId` is a plain `"HH:MM-HH:MM"` string, not a persisted ID — the future `POST /bookings` will need to accept this same format back. Slots are generated at a fixed 30-minute interval (no per-branch template configuration exists yet).

### GET /availability/staff — 🟢 Live

Purpose: Return eligible available staff. Authentication: Public. Query: `branchId`, `serviceIds`, `date`. Success: `[{ "staffId":"", "name":"", "type":"NORMAL" }]`. Errors: `400`, `404`, `500`. Frontend: allow “no preference”; show no eligible stylist state. **Backend note:** this is a day-level listing (no time param in the contract) — a staff member appears unless their approved leave covers the *entire* business day. Partial-day leave conflicts are only caught by `GET /availability/slots` and, later, at actual booking creation.

### POST /bookings — 🟢 Live

Purpose: Create pending customer booking and immediately reserve capacity. Authentication: Customer. Body: `{ "salonId":"salon_123", "branchId":"branch_123", "services":["service_1","service_2"], "staffId":"staff_123", "bookingDate":"2026-10-01", "slotId":"slot_123", "notes":"Optional notes", "couponCode":"WELCOME10" }`. Validation: staff optional; nonempty services; availability/capacity/stylist checks; `couponCode` optional. Success: `{ "bookingId":"", "status":"PENDING" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent double submit, refresh slots on conflict, show pending-approval state. **Backend notes:** (1) `slotId` must be the exact `"HH:MM-HH:MM"` string from `GET /availability/slots` — only the start half is actually used; the end time is recomputed from the requested services' durations. (2) **Module 12**: `couponCode` is now a real attach point, not just a preview — an invalid/expired/exhausted/below-minimum code throws `422` and creates no booking at all (same rules `POST /payments/coupons/validate` already enforces); on success the discount is snapshotted into the booking's `discountAmount`/`totalAmount` (visible on `GET /bookings/:id`/`GET /bookings/my-bookings`, which already return these fields) — the response here still doesn't echo back which coupon/how much, so read the discount off the booking detail rather than this create response.

### GET /bookings/:id; GET /bookings/my-bookings — 🟢 Live

Purpose: Booking detail/history. Authentication: detail: Customer owner, owning Salon Owner, or Admin; history: Customer. History query: `status=PENDING|APPROVED|CANCELLED|COMPLETED`. Detail success: `{ "booking": {} }`. Errors: `401`, `403`, `404`, `500`. Frontend: skeleton detail/history and status-specific empty state. **Backend note (Module 11):** the booking object on both endpoints now also carries resolved `salonName`, `branchName`, `city` (all always populated), and `staffName` (populated only when `selectedStaffId` is set, otherwise `null`) — resolved server-side, no extra lookups needed to render `components/booking-card.tsx`'s salon name/stylist. `salonId`/`branchId`/`selectedStaffId` are unchanged. This resolution is **not** applied to the mutation-confirmation responses (`cancel`/`approve`/`reject`/`approve-reschedule`/`walk-in`) — those 4 fields come back `null` there; only the two read endpoints above resolve names.

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

Purpose: Validate coupon before booking confirmation. Authentication: Customer. Body `{ "couponCode":"", "bookingAmount":1000 }`. Success `{ "valid":true, "discount":100 }`. Errors: `400`, `401`, `422`, `500`. Frontend: validate on explicit apply, show inline result, never trust client-calculated discount. **Backend note:** this remains a preview with no side effect (doesn't reserve/consume the coupon) — but as of **Module 12**, `POST /bookings` now has a real `couponCode` field using these exact same eligibility rules, so a coupon validated here as `valid:true` will actually be honored (same discount math) if passed through to booking creation. An invalid, expired, exhausted, or below-minimum coupon returns `422` with a message, not a soft `{valid:false}`, on both endpoints.

## Reviews — 🟢 Live (Module 8 — Review + Notification), except images

### POST /reviews — 🟢 Live; PATCH /reviews/:reviewId — 🟢 Live (edit period provisional); POST /reviews/:reviewId/images — ⚪ Not built

Purpose: Create, upload images for, and edit an owned review. Authentication: Customer. Create body `{ "bookingId":"", "overallRating":5, "review":"Excellent service", "serviceRating":5, "staffRating":5, "hygieneRating":5, "ambienceRating":5, "productRating":5 }`. Validation: completed booking, one review/booking, ratings 1–5; edit only by owner in allowed edit period; image upload contract not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: validate rating bounds, upload with per-file progress, show completed-booking-only empty/locked state. **Backend notes:** a booking becomes reviewable automatically once its scheduled time passes (no separate "mark complete" action exists — this happens on its own). The "allowed edit period" has no defined cutoff yet (same unresolved policy category as booking cancellation) — edits are accepted at any time for now. `POST /reviews/:reviewId/images` is **not implemented** — its request contract was never specified anywhere, so there was nothing to build against; don't wire an image-upload UI to it yet.

### GET /reviews/:reviewId; GET /reviews/salon/:salonId; GET /reviews/service/:serviceId; GET /reviews/staff/:staffId — 🟢 Live

Purpose: Read review detail/listings. Authentication: not specified; treat as public display routes. Request/response pagination contracts not supplied. Errors: `400`, `404`, `500`. Frontend: skeleton cards and “no reviews yet” state. **Backend note:** no pagination is implemented (none was specified) — these return the full list every time.

### POST /reviews/:reviewId/report; POST /reviews/:reviewId/reply — 🟢 Live

Purpose: Report review or salon-owner reply. Authentication: report Customer or Salon Owner; reply owning Salon Owner. Report body `{ "reason":"" }`; reply body `{ "message":"" }`. Validation: reviewer identity/ownership; response contracts not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirm report, lock reply submit while pending, update thread on success.

## Admin — 🟡 Partial (Module 9 — salon approval + refunds + complaints + reports)

The originally supplied Admin API Inventory contained no endpoints. Everything in this section was worked out directly between the developer and the client's representative — first informally for salon approval, then formalized in `docs/ADMIN_CONTRACT.md` (backend repo) for Refunds/Complaints/Reports. Treat this section as authoritative for what's actually built; expect more to be added the same way over time.

### POST /admin/salons/:salonId/verify; POST /admin/salons/:salonId/reject; POST /admin/salons/:salonId/suspend; POST /admin/salons/:salonId/reactivate; GET /admin/salons; GET /admin/salons/:salonId — 🟢 Live

Purpose: Review and govern salon registrations — the queue every salon sits in before it's publicly visible/bookable. Authentication: ADMIN role only. List query: `status=PENDING|VERIFIED|REJECTED` (optional — omit for all). Reject body `{ "reason":"" }` (required); suspend body `{ "reason":"" }` (required, independent of verification — pulls an already-verified salon offline); verify/reactivate take no body. List/detail success: salon object with an embedded `ownerProfile` (businessName/gstNumber/panNumber/kycStatus). Errors: `400`, `401`, `403`, `404`, `500`. Frontend: admin queue view with status filter, confirm dialog on reject/suspend (reason required), toast/refresh on decision. Notifies the salon owner by email on every decision (approved/rejected/suspended/reactivated).

### GET /admin/refunds; GET /admin/refunds/:id; POST /admin/refunds/:id/approve; POST /admin/refunds/:id/reject — 🟢 Live

Purpose: Manual refund decision queue — no automated eligibility check (the cancellation/refund policy is still undecided with the client; every refund is read and decided by hand). Authentication: ADMIN role only. List query: `status=PENDING|APPROVED|PROCESSING|COMPLETED|REJECTED` (optional). List/detail success: refund object with embedded `booking`, `payment`, and `customer` objects (enough context to decide without a second lookup). Approve body `{ "notes"?: string }`; reject body `{ "reason": string }` (required). Both only act on a `PENDING` refund (409 otherwise). Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: admin queue with status filter, confirm dialog on reject (reason required). **Backend note:** "approve" only marks the decision — no money actually moves; there's no payment gateway wired for issuing funds yet (MVP payment is pay-at-salon-style). Notifies the refund's customer by email on either decision.

### POST /complaints (NOT under /admin — Customer or Salon Owner); GET /admin/complaints; GET /admin/complaints/:id; POST /admin/complaints/:id/resolve; POST /admin/complaints/:id/reject — 🟢 Live

Purpose: File a complaint (about a booking, payment, salon, staff member, refund, or something else) and have an admin resolve it. Filing authentication: Customer or Salon Owner. File body `{ "type": "BOOKING"|"PAYMENT"|"SALON"|"STAFF"|"REFUND"|"OTHER", "referenceId"?: "", "description": "" }` — `referenceId` is a single generic ID (whatever `type` points at), optional (e.g. `OTHER` has nothing to reference). Resolution authentication: ADMIN only. List query: `status=OPEN|IN_PROGRESS|REJECTED|RESOLVED` (optional). List/detail success embeds `filedBy` (id/email/fullName) always, plus `linkedBooking` or `linkedPayment` when `type` is `BOOKING`/`PAYMENT` and a `referenceId` is present — other types just show the raw `referenceId`. Resolve body `{ "resolutionNotes": string }` (required); reject body `{ "reason": string }` (required). Both only act on `OPEN`/`IN_PROGRESS` (409 otherwise). Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: filing form behind a "report a problem" entry point; admin queue with status filter and confirm dialogs (both actions require text). Notifies the filer by email on either decision. **Backend note:** `IN_PROGRESS` is a valid status but nothing transitions a complaint into it yet — every complaint currently goes straight from `OPEN` to `RESOLVED`/`REJECTED`.

### GET /admin/reports/overview — 🟢 Live

Purpose: A minimal admin dashboard aggregate — not a BI tool, no charts/time-series/export. Authentication: ADMIN only. Query: `from`, `to` (both optional `YYYY-MM-DD`, default last 30 days). Success: `{ "totalBookings":0, "completedBookings":0, "cancelledBookings":0, "totalSalons":0, "verifiedSalons":0, "pendingSalons":0, "totalRevenue":0, "openComplaints":0, "pendingRefunds":0 }`. Errors: `400`, `401`, `403`, `500`. Frontend: simple stat-card grid, a date-range picker for the from/to fields. **Backend note:** `from`/`to` only affects `totalBookings`/`completedBookings`/`cancelledBookings`/`totalRevenue` (activity within that window). `totalSalons`/`verifiedSalons`/`pendingSalons`/`openComplaints`/`pendingRefunds` are always the current live count, regardless of the date range — these are queue depths ("how many right now"), not period activity.

### Not built yet
`docs/ADMIN_CONTRACT.md` (backend repo) is now fully implemented. Explicitly out of scope until a new contract exists: settlement creation, coupon/category management, customer strikes.
