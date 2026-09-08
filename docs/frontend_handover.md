# Salonjaa Frontend Handover

Base URL: `/api/v1`. Send `Authorization: Bearer <accessToken>` on authenticated requests. Responses beyond the explicitly supplied examples are not finalized in the API Inventory; consume the shown fields only and handle standard `400`, `401`, `403`, `404`, `409`, `422`, `429`, and `500` failures where applicable.

## Backend build status

This whole document describes the target contract. Only the sections marked **🟢 Live** are actually built, running, and Postman-tested today — build frontend against those first. Everything marked **⚪ Not built** is contract-only: the endpoint doesn't exist on the server yet and calling it will 404. Check `docs/PROGRESS.md` in the backend repo for the current source of truth before starting frontend work on a section, in case this has moved on since you last pulled.

| Section below | Backend module | Status |
|---|---|---|
| Auth | Module 1 — Foundation + Auth | 🟢 Live |
| User and Address | Module 2 — User + Address | 🟢 Live — `GET /users/me/bookings` now live too |
| Salon and Branch | Module 3 — Salon + Branch | 🟢 Live — plus salon media gallery and slot-templates (new, see their own section below) |
| Staff and Services | Module 4 — Catalogue + Staff | 🟢 Live |
| Public Browse | Module 10 — Public Salon/Branch Browse | 🟢 Live — plus public promotions (new, see below) |
| Availability and Booking | Module 5 — Availability, Module 6 — Booking | 🟢 Live — all endpoints in this section are live except `POST /salon-bookings/:id/block-slot` (explicitly Future Feature — Not MVP, see that endpoint's note). Customer can now respond to a salon-proposed reschedule (see below); `POST /salon-bookings/:id/no-show` is new. |
| Payment and Coupon | Module 7 — Payment + Coupon | 🟢 Live — advance-payment flow for restricted customers reuses these same endpoints (see Customer strikes section below) |
| Reviews | Module 8 — Review + Notification | 🟢 Live except `POST /reviews/:reviewId/images` (see that endpoint's note) — edit window is now a real 48h cutoff, not unlimited |
| Admin | Module 9 — Admin | 🟢 Live — `docs/ADMIN_CONTRACT.md` fully implemented, and its previously-excluded items (settlements, coupon/category CRUD, customer strikes) are now built too (see their own sections below) |
| Salon owner analytics, promotions, slot-templates, customer strikes | New this session, no prior contract | 🟢 Live — see their own sections below |

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

Purpose: Search/list branches for Home ("Popular Near You") and Explore/Nearby Salons. Authentication: Public — browsing stays fully anonymous through Checkout, where `POST /bookings`'s existing Customer auth requirement first applies (unchanged). Query: `city?`, `q?` (free-text over salon/branch name), `serviceCategoryId?`, `salonId?` (new — lists one brand's other branches, for a "View Branches" link on the salon detail page), `lat?`+`lng?` (must be supplied together, and are required when `sort=distance`), `sort?` (`distance|rating|popular`, default `popular`). Success: `[{ "branchId":"", "salonId":"", "salonName":"", "branchName":"", "city":"", "addressLine1":"", "coverImage":null, "distanceKm":0.8, "averageRating":4.8, "reviewCount":512 }]` — bare array, no envelope. Errors: `400`, `500`. Frontend: list skeleton, "no salons found" empty state, debounce `q`. **Backend notes:** (1) the proposal's `area` field doesn't exist — `branches` has no such column, only `addressLine1`/`addressLine2`/`city`/`state`/`postalCode`; use `addressLine1` for the secondary location line. (2) `distanceKm` is only present when `lat`+`lng` were supplied, computed via plain Haversine (no Google Maps, matches the existing location decision), not persisted/cached. (3) Only a `VERIFIED` + `ACTIVE` salon's `ACTIVE` branches ever appear — same "bookable" gate `GET /availability/slots` already enforces. (4) No pagination (same precedent as the Reviews listing endpoints).

### GET /public/branches/:branchId — 🟢 Live

Purpose: Salon Details screen, service menu embedded for Select Services. Authentication: Public. Success: `{ "branchId":"", "salonId":"", "salonName":"", "branchName":"", "description":"", "coverImage":null, "gallery":[], "city":"", "addressLine1":"", "latitude":0, "longitude":0, "phone":null, "verificationStatus":"VERIFIED", "averageRating":4.8, "reviewCount":512, "openingTime":"09:00", "closingTime":"21:00", "services":[{ "id":"", "categoryId":"", "categoryName":"", "name":"", "durationMinutes":45, "basePrice":499, "imageUrl":null }] }` — bare object, no envelope. Errors: `404` (not found, or found but not `VERIFIED`/`ACTIVE` — same non-leaking 404 as an owner requesting a branch they don't own), `500`. Frontend: skeleton detail, only list `services` with `status=ACTIVE`, use `phone` for a Contact/Call-Salon button. **Backend notes:** `gallery` is real now (Module 17, `salon_gallery_images`) — empty `[]` just means the owner hasn't added photos yet, not that the feature is missing. `phone` is new (this session) — the branch's own `phone` column, null if the owner never set one.

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

Purpose: Booking detail/history. Authentication: detail: Customer owner, owning Salon Owner, or Admin; history: Customer. History query: `status=PENDING|APPROVED|CANCELLED|COMPLETED`. Detail success: `{ "booking": {} }`. Errors: `401`, `403`, `404`, `500`. Frontend: skeleton detail/history and status-specific empty state. **Backend note (Module 11):** the booking object on both endpoints now also carries resolved `salonName`, `branchName`, `city` (all always populated), `staffName` (populated only when `selectedStaffId` is set, otherwise `null`), and `branchPhone` (new, this session — for a "Call Salon" button) — resolved server-side, no extra lookups needed to render `components/booking-card.tsx`'s salon name/stylist. `salonId`/`branchId`/`selectedStaffId` are unchanged. This resolution is **not** applied to the mutation-confirmation responses (`cancel`/`approve`/`reject`/`approve-reschedule`/`walk-in`) — those fields come back `null` there; only the two read endpoints above resolve names.

### POST /bookings/:id/cancel — 🟢 Live (finalized policy, Module 16)

Purpose: Customer cancellation. Authentication: booking owner. Body: `{ "reasonCode"?: "NEED_HELP"|"TOOK_TOO_LONG_TO_CONFIRM"|"BOOKED_BY_MISTAKE"|"BOOKED_ELSEWHERE"|"OTHER", "reason"?: "Change of plans" }` — both optional today (not yet required — see note below), send either/both when you have them. Validation: only a `PENDING`/`AWAITING_PAYMENT`/`APPROVED` booking, and only up to **2 hours** before `scheduledStart` — inside that window it's a `409`, no exceptions. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirmation dialog with a **fixed reason picker** (the 5 `reasonCode` values above — mirror a "why are you cancelling?" list, "Other" reveals a freeform `reason` field), mutation lock, update local availability/history. **Backend note:** the cancellation cutoff is finalized (2 hours, no strike for a normal cancel) — safe to build permanent copy against it now. `reasonCode` is new and currently optional so this isn't a breaking change for any in-flight frontend work; **once the reason-picker UI ships, ask backend to make it required** so cancellation analytics are clean going forward.

### POST /bookings/:id/reschedule-request; POST /bookings/:id/approve-reschedule; POST /bookings/:id/reject-reschedule — 🟢 Live

Purpose: Customer proposed reschedule and Salon Owner decision. Authentication: customer owner for request; owning Salon Owner for decision. Request body: `{ "bookingDate":"2026-10-03", "slotId":"slot_456", "reason":"Not available" }`; rejection body `{ "reason":"" }`; approval body not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: retain original appointment until accepted; show request-pending UI. **Backend note:** approve/reject always act on the booking's most recent pending reschedule request — there's no request ID in these routes.

### GET /salon-bookings; POST /salon-bookings/:id/approve; POST /salon-bookings/:id/reject; POST /salon-bookings/:id/propose-reschedule; POST /salon-bookings/walk-in — 🟢 Live

Purpose: Salon booking management. Authentication: owning Salon Owner. List query: `status=PENDING|APPROVED|COMPLETED|CANCELLED`. Approve body: `{ "notes":"" }`; reject body `{ "reason":"" }` (reason required); proposed-reschedule body `{ "bookingDate":"", "slotId":"", "reason":"" }`; walk-in body `{ "customerName":"", "customerPhone":"", "services":[], "staffId":"", "bookingDate":"", "slotId":"" }`. Validation: owned booking/branch; full availability validation; walk-ins consume capacity and use standard duration/pricing. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: owner dashboard status filters, action-level loading, no-bookings state, confirm reject/walk-in creation. **Backend notes:** (1) `walk-in`'s `staffId` is required, not optional as elsewhere — it's the only field in this body that tells the backend which branch the walk-in belongs to, and a walk-in is created straight to `APPROVED` (no separate approval step). (2) `propose-reschedule` creates the request, but there's currently no endpoint for the customer to accept/reject a salon-proposed reschedule — don't build that screen yet, it has nothing to call.

### POST /salon-bookings/:id/block-slot

Purpose: Explicitly marked **Future Feature — Not MVP** in the supplied API Inventory. Do not call or build a UI for this endpoint.

## Payment and Coupon — 🟢 Live (Module 7 — Payment + Coupon)

### POST /payments/create-order; POST /payments/verify — 🟢 Live

Purpose: Create/verify online payment. Authentication: Customer. Create body `{ "bookingId":"booking_123" }`; success `{ "orderId":"", "amount":500, "currency":"INR" }`. Verify body `{ "orderId":"", "paymentId":"", "signature":"" }`; success `{ "success":true, "paymentStatus":"SUCCESS" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent duplicate payment initiation; complete only after verification response; show retry UI for failure. **Backend notes:** provider is Razorpay — `create-order` requires the booking to already be `APPROVED` by the salon (409 otherwise) and blocks a second order while one is pending/paid (a failed one can be retried). No webhook exists; a payment only ever updates when the frontend actually calls `/verify` after Razorpay checkout completes, so don't skip that call on any code path. **Module 13**: a `PENDING` order now also auto-expires to `FAILED` on its own after `PAYMENT_ORDER_EXPIRY_MINUTES` (currently 20) if `/verify` is never called — see `POST /payments/:paymentId/cancel` below for the immediate counterpart to this backstop.

### POST /payments/:paymentId/cancel — 🟢 Live (Module 13)

Purpose: Cancel a still-`PENDING` payment attempt immediately (call this from Razorpay checkout's `ondismiss` handler — widget closed without completing) so `create-order` becomes retryable right away instead of waiting out the automatic expiry window. Authentication: payment's own Customer. Body: none. Success: default envelope, `{ "success":true, "data": { ...payment fields... } }` with `status:"FAILED"`. Errors: `401`, `404` (not found, or found but not yours — same non-leaking 404 as elsewhere), `409` (payment isn't `PENDING` — already resolved or already cancelled), `500`. Frontend: call this from `ondismiss` before showing your own retry button; a `409` here just means it already resolved another way (e.g. `/verify` landed first) — refresh the payment/booking state rather than treating it as a real error.

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

### GET/POST /admin/categories, PATCH/DELETE /admin/categories/:id — 🟢 Live

Purpose: platform service-category CRUD (previously `db:seed`-only). Authentication: ADMIN only. Create body `{ "name": string, "slug"?: string, "icon"?: string }` (slug auto-generated from name if omitted). Update body: any of `name`/`slug`/`icon`/`status` (`ACTIVE|INACTIVE`). Delete soft-deletes. Errors: `400`, `401`, `403`, `404`, `409` (duplicate slug), `500`.

### GET/POST /admin/coupons, PATCH/DELETE /admin/coupons/:id — 🟢 Live

Purpose: platform coupon CRUD (previously `db:seed`-only, only `POST /payments/coupons/validate` existed). Authentication: ADMIN only. Create body `{ "couponCode", "type": "FIXED"|"PERCENTAGE", "value", "minimumAmount"?, "maxDiscount"?, "usageLimit"?, "startsAt"?, "expiresAt"? }` (`startsAt`/`expiresAt` ISO datetime). Update body: any of the above plus `active`. Delete soft-deletes. Errors: `400`, `401`, `403`, `404`, `409` (duplicate code), `500`.

### GET/POST /admin/settlements, POST /admin/settlements/:id/mark-settled — 🟢 Live

Purpose: manual settlement records (TRD: "manual MVP records" — no commission-rate rule exists anywhere, so this doesn't compute one; the admin enters amounts from their own accounting). Authentication: ADMIN only. Create body `{ "salonId", "branchId"?, "periodStart", "periodEnd" (ISO datetime), "grossAmount", "commissionAmount"?, "refundAmount"?, "adjustmentAmount"?, "bookingIds"?: string[] }` — `netAmount` is computed (`gross - commission - refund + adjustment`). List query `salonId?`/`status?`. Errors: `400`, `401`, `403`, `404`, `500`.

### GET/POST/POST /admin/customers/:customerId/strikes, POST .../:strikeId/remove — 🟢 Live

Purpose: view/manage a customer's strike history. Authentication: ADMIN only. `GET` returns `{ customerId, activeNoShowCount, advancePaymentRequired, strikes: [...] }`. `POST` adds a manual strike: `{ "type": "FAKE_BOOKING"|"NO_SHOW"|"ABUSIVE_CANCELLATION", "bookingId"?, "notes"? }` (`NO_SHOW` strikes are normally auto-recorded — see `POST /salon-bookings/:id/no-show` below — this lets an admin backfill or record the other two types, which have no automated trigger yet). `POST .../remove` (reason required) marks a strike removed (metadata only, never deleted) — this is the only way to lift the advance-payment requirement early, since it's otherwise permanent. Errors: `400`, `401`, `403`, `404`, `409` (already removed), `500`.

### Not built yet
`docs/ADMIN_CONTRACT.md` (backend repo) is now fully implemented, and its explicitly-excluded items above (settlement creation, coupon/category management, customer strikes) are now also built, per a new contract co-defined directly with the developer this session. Nothing currently outstanding on the Admin surface.

## Customer strikes / advance payment / NO_SHOW — 🟢 Live (new, this session)

**Policy** (finalized, not provisional): a customer's 4th lifetime `NO_SHOW` accumulates permanently — every `PAY_AT_SALON` booking after that requires a 10%-of-total advance deposit before the salon can approve it. Choosing `ONLINE` payment instead needs no separate advance (paying the full amount upfront already covers it). The restriction never lifts automatically — only an admin removing a strike (see above) can lower it back under the threshold.

- `POST /bookings` gains no new required field, but its response's booking now carries `requiresAdvancePayment`/`advanceAmount` (both visible via `GET /bookings/:id`) — check these after creating a `PAY_AT_SALON` booking to know whether a payment step is needed before the salon will even review it.
- The advance is paid through the **existing** `POST /payments/create-order`/`POST /payments/verify` endpoints — no new payment endpoints. If `requiresAdvancePayment` is true and unpaid, `create-order` returns an order for just the advance amount (not the full booking total); once `verify` succeeds, `POST /salon-bookings/:id/approve` becomes callable (409 until then). This is on top of / independent from the normal `AWAITING_PAYMENT` full-payment flow for `ONLINE` bookings — a `PAY_AT_SALON` booking never enters `AWAITING_PAYMENT`.
- `POST /salon-bookings/:id/no-show` (owning Salon Owner, `{}` body) — marks an `APPROVED` booking `NO_SHOW` any time at/after its scheduled start. Records the strike automatically. Errors: `400` (too early), `401`, `403`, `404`, `409` (not `APPROVED`), `500`.
- Cancelling (`POST /bookings/:id/cancel`) a booking whose advance was paid forfeits it — no refund-request is possible on it (`POST /payments/refund-request` will `409`) — but a `FIXED` coupon for that exact amount is auto-issued to the customer, redeemable via the existing `couponCode` field on `POST /bookings` (personalized — only that customer can use it). Frontend: surface the issued coupon somewhere the customer will see it (a notification event `ADVANCE_PAYMENT_FORFEITED_COUPON_ISSUED` fires, carrying the code and amount, but there's no "my coupons" list endpoint — same precedent as coupons generally having no discovery endpoint besides validate-by-code).

## Cancellation, refund & review-edit policy — finalized this session (previously provisional/no-cutoff)

- `POST /bookings/:id/cancel`: free up to **2 hours** before `scheduledStart`; blocked entirely inside that window (`409`, no exceptions/strikes for a late attempt).
- `PATCH /reviews/:reviewId`: only within **48 hours** of the review's `createdAt`; `422` past that.
- OTP: unchanged numerically except `OTP_EXPIRY_SECONDS` 300→600 (10 minutes) — attempts/cooldown/rate-limit were already implemented as documented in the TRD, just never called out here.

## Booking response gaps closed — 🟢 Live (new, this session)

- `GET /users/me/bookings` — now live (was `⚪ Not built`). Query `status=COMPLETED|CANCELLED|UPCOMING` (`UPCOMING` = `PENDING`/`AWAITING_PAYMENT`/`APPROVED`). Default envelope, array of the same booking DTO `GET /bookings/my-bookings` returns — this is effectively an alias over the same data under the documented `/users/me` path.
- Customer can now respond to a salon-proposed reschedule: **the existing** `POST /bookings/:id/approve-reschedule`/`POST /bookings/:id/reject-reschedule` endpoints now work for **either** direction — whoever did *not* propose the pending reschedule request is the one who must call them (a customer proposal still needs the owning Salon Owner to respond, unchanged; a salon proposal now needs the booking's own customer). No new route names were introduced. Calling it as the wrong party (e.g. an owner trying to approve their own proposal) returns `404`, same "don't leak existence" pattern as everywhere else.

## Salon media gallery, promotions, slot templates, owner analytics — 🟢 Live (new, this session, no contract previously existed)

### GET/POST /salons/:salonId/gallery, DELETE .../gallery/:imageId — 🟢 Live
Purpose: multi-image gallery per salon. Authentication (write): owning Salon Owner. Add body `{ "imageUrl": string (URL), "displayOrder"?: number }` — same "URL string, frontend hosts the file elsewhere" pattern as `salons.logo`/`coverImage`, no upload endpoint. `GET /public/branches/:branchId`'s `gallery` field (previously always `[]`) is now populated from this.

### GET/POST /branches/:id/slot-templates, PATCH/DELETE .../slot-templates/:templateId — 🟢 Live
Purpose: owner-defined time-slot templates, replacing the fixed 30-minute interval `GET /availability/slots` used everywhere before. Authentication: owning Salon Owner. Body `{ "name", "startTime"/"endTime" (HH:MM), "slotDurationMinutes" }`. A branch with zero active templates keeps the old fixed-interval behavior unchanged (fully backward compatible) — only branches that add one or more templates see per-template slot generation.

### GET/POST /promotions, PATCH/DELETE /promotions/:id (owner) — 🟢 Live
### GET /public/promotions?branchId= (public, no auth) — 🟢 Live
Purpose: marketing promotions (title/description/banner/date range), targeting one or more of the owner's own branches/services. **Not related to coupons** — no coupon-code linkage, purely display content; `POST /payments/coupons/validate` remains the only coupon path. Create body `{ "title", "description"?, "bannerImageUrl"?, "startsAt"/"endsAt" (ISO datetime), "branchIds": string[], "serviceIds"?: string[] }`. Auto-deactivates at `endsAt`. Public discovery returns only currently-active, in-range promotions.

### GET /salons/:salonId/analytics?from&to — 🟢 Live
Purpose: owner-facing analytics for one salon (beyond Admin's platform-wide reports overview). Authentication: owning Salon Owner. Query `from`/`to` (`YYYY-MM-DD`, optional, default last 30 days). Success: `{ totalBookings, completedBookings, cancelledBookings, noShowBookings, totalRevenue, averageRating, reviewCount, topServices: [{serviceId, serviceName, bookingCount}] }` — `averageRating`/`reviewCount` are live (not date-ranged), everything else is scoped to `from`/`to`.

## ⚪ Not built yet — pending a decision, don't build frontend against these

`docs/NEXT_SESSION_PLAN.md` (backend repo) lists 5 items identified from a competitor comparison: service variants/customisation, price-tier + gender-served tags on listing cards, offer banners on listing cards, a general customer wallet, and a "pay for a walk-in with no prior booking" flow. **None of these have a contract yet** — each has open product/schema questions that need answering with the client before any endpoint exists. Don't start frontend work against guessed shapes for these; check back once `docs/NEXT_SESSION_PLAN.md`'s items move to their own `🟢 Live` sections above.
