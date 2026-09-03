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
| Availability and Booking | Availability, Booking (not started) | ⚪ Not built |
| Payment and Coupon | Payment, Coupon (not started) | ⚪ Not built |
| Reviews | Review (not started) | ⚪ Not built |
| Admin | Admin (not started) | ⚪ Not built |

A companion Postman collection ("Salonjaa API") and environment ("Salonjaa - Local") exist for the 🟢 Live sections only, generated from an OpenAPI spec at `postman/specs/openapi.yaml` in the backend repo.

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

## Availability and Booking — ⚪ Not built (Availability, Booking modules not started)

### GET /availability/slots

Purpose: Return available booking start slots. Authentication: Public. Query: `branchId`, `date`, `serviceIds`. Success: `[{ "slotId":"", "startTime":"10:00", "endTime":"11:30", "available":true }]`. Validation: valid active services at branch/date. Errors: `400`, `404`, `500`. Frontend: debounce selection changes, show inline loading, and show “no slots available” empty state.

### GET /availability/staff

Purpose: Return eligible available staff. Authentication: Public. Query: `branchId`, `serviceIds`, `date`. Success: `[{ "staffId":"", "name":"", "type":"NORMAL" }]`. Errors: `400`, `404`, `500`. Frontend: allow “no preference”; show no eligible stylist state.

### POST /bookings

Purpose: Create pending customer booking and immediately reserve capacity. Authentication: Customer. Body: `{ "salonId":"salon_123", "branchId":"branch_123", "services":["service_1","service_2"], "staffId":"staff_123", "bookingDate":"2026-10-01", "slotId":"slot_123", "notes":"Optional notes" }`. Validation: staff optional; nonempty services; availability/capacity/stylist checks. Success: `{ "bookingId":"", "status":"PENDING" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent double submit, refresh slots on conflict, show pending-approval state.

### GET /bookings/:id; GET /bookings/my-bookings

Purpose: Booking detail/history. Authentication: detail: Customer owner, owning Salon Owner, or Admin; history: Customer. History query: `status=PENDING|APPROVED|CANCELLED|COMPLETED`. Detail success: `{ "booking": {} }`. Errors: `401`, `403`, `404`, `500`. Frontend: skeleton detail/history and status-specific empty state.

### POST /bookings/:id/cancel

Purpose: Customer cancellation. Authentication: booking owner. Body: `{ "reason":"Change of plans" }`. Validation: upcoming, not completed; cancellation policy/strike rules apply. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirmation dialog, mutation lock, update local availability/history.

### POST /bookings/:id/reschedule-request; POST /bookings/:id/approve-reschedule; POST /bookings/:id/reject-reschedule

Purpose: Customer proposed reschedule and Salon Owner decision. Authentication: customer owner for request; owning Salon Owner for decision. Request body: `{ "bookingDate":"2026-10-03", "slotId":"slot_456", "reason":"Not available" }`; rejection body `{ "reason":"" }`; approval body not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: retain original appointment until accepted; show request-pending UI.

### GET /salon-bookings; POST /salon-bookings/:id/approve; POST /salon-bookings/:id/reject; POST /salon-bookings/:id/propose-reschedule; POST /salon-bookings/walk-in

Purpose: Salon booking management. Authentication: owning Salon Owner. List query: `status=PENDING|APPROVED|COMPLETED|CANCELLED`. Approve body: `{ "notes":"" }`; reject body `{ "reason":"" }` (reason required); proposed-reschedule body `{ "bookingDate":"", "slotId":"", "reason":"" }`; walk-in body `{ "customerName":"", "customerPhone":"", "services":[], "staffId":"", "bookingDate":"", "slotId":"" }`. Validation: owned booking/branch; full availability validation; walk-ins consume capacity and use standard duration/pricing. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: owner dashboard status filters, action-level loading, no-bookings state, confirm reject/walk-in creation.

### POST /salon-bookings/:id/block-slot

Purpose: Explicitly marked **Future Feature — Not MVP** in the supplied API Inventory. Do not call or build a UI for this endpoint.

## Payment and Coupon — ⚪ Not built (Payment, Coupon modules not started)

### POST /payments/create-order; POST /payments/verify

Purpose: Create/verify online payment. Authentication: Customer. Create body `{ "bookingId":"booking_123" }`; success `{ "orderId":"", "amount":500, "currency":"INR" }`. Verify body `{ "orderId":"", "paymentId":"", "signature":"" }`; success `{ "success":true, "paymentStatus":"SUCCESS" }`. Errors: `400`, `401`, `403`, `409`, `422`, `500`. Frontend: prevent duplicate payment initiation; complete only after verification response; show retry UI for failure.

### GET /payments/:paymentId; GET /payments/my-payments; POST /payments/refund-request; GET /payments/refunds; GET /payments/salon-settlements

Purpose: Payment/refund/settlement reads and customer refund request. Authentication: payment detail Customer owner, owning Salon Owner, or Admin; my/refunds Customer; settlements owning Salon Owner. Refund body `{ "bookingId":"", "reason":"" }`; booking must be refund-eligible, initial status PENDING. Settlement example `[{ "settlementId":"", "amount":5000, "status":"COMPLETED" }]`. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: use finance-table skeletons and empty states; show refund PENDING as non-final.

### POST /payments/coupons/validate

Purpose: Validate coupon before booking confirmation. Authentication: Customer. Body `{ "couponCode":"", "bookingAmount":1000 }`. Success `{ "valid":true, "discount":100 }`. Errors: `400`, `401`, `422`, `500`. Frontend: validate on explicit apply, show inline result, never trust client-calculated discount.

## Reviews — ⚪ Not built (Review module not started)

### POST /reviews; POST /reviews/:reviewId/images; PATCH /reviews/:reviewId

Purpose: Create, upload images for, and edit an owned review. Authentication: Customer. Create body `{ "bookingId":"", "overallRating":5, "review":"Excellent service", "serviceRating":5, "staffRating":5, "hygieneRating":5, "ambienceRating":5, "productRating":5 }`. Validation: completed booking, one review/booking, ratings 1–5; edit only by owner in allowed edit period; image upload contract not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `422`, `500`. Frontend: validate rating bounds, upload with per-file progress, show completed-booking-only empty/locked state.

### GET /reviews/:reviewId; GET /reviews/salon/:salonId; GET /reviews/service/:serviceId; GET /reviews/staff/:staffId

Purpose: Read review detail/listings. Authentication: not specified; treat as public display routes. Request/response pagination contracts not supplied. Errors: `400`, `404`, `500`. Frontend: skeleton cards and “no reviews yet” state.

### POST /reviews/:reviewId/report; POST /reviews/:reviewId/reply

Purpose: Report review or salon-owner reply. Authentication: report Customer or Salon Owner; reply owning Salon Owner. Report body `{ "reason":"" }`; reply body `{ "message":"" }`. Validation: reviewer identity/ownership; response contracts not supplied. Errors: `400`, `401`, `403`, `404`, `409`, `500`. Frontend: confirm report, lock reply submit while pending, update thread on success.

## Admin — ⚪ Not built (Admin module not started)

The supplied Admin API Inventory contains no endpoints. Do not implement frontend calls for Admin until its endpoint inventory defines method, path, request, response, and authorization contract.
