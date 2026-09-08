# Salonjaa vs. LUZO — booking flow comparison

Source: `luzo.txt` at the repo root (a walkthrough of LUZO's live booking flow, captured via a browser extension — not committed to git per your instruction; this document is the durable output, safe to keep). Compared against Salonjaa's actual implementation, verified live against the running dev server (real seeded data, real API calls — not just reading docs), on 2026-09-09.

**How to read this:** each stage gets a rating, then the concrete gap or the concrete reason we're already fine. Recommendations are separated from analysis and tagged by effort — nothing here is implemented; it's for discussion first, per your ask.

## TL;DR

We're **not behind on the hard part** — real-time capacity/staff-conflict resolution, transactional booking creation, a genuine approval workflow, and (as of today) an anti-abuse strikes/advance-payment system are all real and tested. LUZO's write-up doesn't describe anything as rigorous on the no-show/abuse side; their "multi-slot preference" trick reads as a workaround for *not* having true real-time availability, which we already have.

Where we're genuinely behind is **merchandising and account-retention surface** — the stuff that makes a listing feel alive (offer banners, price tier, photo-forward cards) and the stuff that brings someone back (wallet, gift cards, referrals) — plus a couple of real structural/product gaps worth a deliberate decision: **confirmation SLA**, **service variants**, and a **decoupled "pay for a visit with no prior booking" flow**.

## Stage-by-stage

### 1. Discovery / homepage — **behind, cosmetically**
LUZO: location picker + single search bar + category chips (Salons/Dermatologists/Wellness & Spa/Nails & Lashes) + city directory across 150+ cities.
Salonjaa: `GET /public/branches?city&q&serviceCategoryId&lat&lng&sort`. Verified live — `city`/`q`/category-filter/geolocation-sort all work correctly against seeded data. **What's actually missing:** a "browse by category" chip UX has no backend gap (categories already exist and are filterable), it's a frontend layout choice. The real gap is a **city directory** — no `GET /cities` or similar to list "which cities do we actually operate in," so a city picker today has to be hardcoded or guessed client-side.

### 2. Listing page (salon cards) — **behind on merchandising fields**
LUZO card: cover image, **offer banner**, name, **gender-served tag** (Unisex/Men), **price tier** (₹/₹₹/₹₹₹), address, distance, rating.
Salonjaa (`PublicBranchListItemDTO`, verified live):
```json
{"branchId","salonId","salonName","branchName","city","addressLine1","coverImage","distanceKm","averageRating","reviewCount"}
```
Distance/rating/cover image are there. **Missing:** offer banner (nothing links a promotion to a listing card today — Module 17's promotions are a separate `GET /public/promotions` list, not surfaced per-branch on the card), gender-served tag (not modeled anywhere), price tier (not modeled — would need either a stored tier or a computed one from service prices).

### 3. Salon detail page — **on par structurally, behind on a few CTAs**
LUZO: name/address/category/price tier, **"View Branches" link**, **"pre-booking not mandatory to pay" badge**, hours, Get Directions, Contact, gallery, services preview, About, sticky sidebar with **two CTAs: Book Services / Pay bill**.
Salonjaa (`PublicBranchDetailDTO`, verified live): description, coverImage, **gallery** (real now, Module 17), city/address, lat/lng, verificationStatus, rating, hours, services (grouped by category — see below). Get Directions/Contact are trivially derivable client-side from `latitude`/`longitude`/branch phone (branch has a `phone` field already, just not surfaced in this DTO — one-line addition if wanted).

**Two real gaps here:**
- **"View Branches"** — there's no `salonId` filter on `GET /public/branches` (checked the validator: `city`/`q`/`serviceCategoryId`/`lat`/`lng`/`sort` only, no `salonId`). Can't currently show "here are this brand's other 3 locations." Small, contained fix.
- **"Pay bill" as a separate CTA** — see §9 below, this is the one genuinely structural gap.

The "pre-booking not mandatory to pay" badge is LUZO's framing of *their* policy (cash not accepted, pay-after-service always). We already support the opposite and the same: `PAY_AT_SALON` and `ONLINE` are both real options on our side, so we don't need their badge — we'd want our own ("Pay online or at the salon," if anything).

### 4. Service selection — **on par on data, behind on UX richness**
LUZO: category tabs → collapsible subcategories → line items with duration + "From ₹X" + ADD, **required variant-select modal** for customisable services (e.g. Papaya/Wine Red Grape/Diamond Grey, each its own price), live cart panel, no redirect.
Salonjaa (verified live): services already come back grouped by category (`categoryId`/`categoryName` on every service in `GET /public/branches/:branchId`) — the tab-by-category UX has no backend gap. `POST /bookings` already accepts an array of `services` (multiple line items, duplicates = quantity), computed server-side into `subtotalAmount`/`totalAmount` — the "live cart" is just a client-side reflection of the same array, no redirect needed either way.

**Real gap: service variants/customisation.** There is nothing in the schema for "one service, several priced sub-options" — `branch_services` is flat (`name`, `durationMinutes`, `basePrice`). A salon offering "Facial — Papaya (₹999) / Diamond (₹1499)" today has to model these as two entirely separate services, which pollutes the service list and loses the "these are variants of one thing" grouping. This is a real, decidable feature gap, not a UI gap.

### 5. Slot selection — **we're actually ahead here, despite fewer UI features**
LUZO: 15-minute grid, **select up to 3 preferred slots** (so the salon can offer the closest available one).
Salonjaa (verified live): `GET /availability/slots` returns real per-slot `available: true/false` computed from actual capacity (chairs/staff/existing bookings/leaves) — a customer sees the *true* availability, not a guess. LUZO's "pick 3 and hope" pattern reads as a workaround for not exposing real slot-level availability up front (if they did, there'd be no reason to hedge with 3 picks). We already solve the underlying problem more directly.

Two smaller, real differences worth noting: our slot interval defaults to 30 minutes (LUZO: 15) — configurable now via Module 17's slot-templates if a salon wants finer granularity, no code change needed, just an owner-side config decision. And we don't currently surface "approx total, may change after in-person consultation" messaging — not a backend gap (our price is always exact/quoted), just a framing choice that doesn't obviously apply to us.

### 6. Confirmation — **the one SLA gap worth a real decision**
LUZO: instant landing (already logged in, no OTP at booking time), status becomes **"awaiting confirmation," promised within 15 minutes**, Call Salon shortcut, appointment ID, Pay Bill button, cancel/reschedule actions.
Salonjaa: `POST /bookings` creates `PENDING` (structurally the same "awaiting confirmation" state — we already don't auto-confirm, the salon owner has to call `POST /salon-bookings/:id/approve`), returns a bare `{bookingId, status}`, and a real `bookingNumber` (`SLJ-...`) exists on the row even though it's not in that specific bare response today. **The real gap: `BOOKING_DEFAULT_EXPIRY_HOURS` defaults to 12 hours** — LUZO promises (and presumably enforces on the salon side) a 15-*minute* confirmation window. Twelve hours is a very different customer promise than fifteen minutes. This was set as a placeholder back in Module 6 ("provisional numeric policy... revisit if given a real number") and never revisited — it's the most concrete, decidable improvement in this whole document.

**Decided:** matched exactly to LUZO's 15 minutes. Renamed to `BOOKING_DEFAULT_EXPIRY_MINUTES=15` (hours couldn't express 15 minutes precisely) — see `docs/PROGRESS.md`'s Module 6 note for the change record.

"Call Salon shortcut" is trivial — branch already has a `phone` field, just needs surfacing on the booking-detail response (it's on `GET /branches/:id` for the owner side today, not on the customer-facing booking DTO).

### 7. Appointment lifecycle / My Appointments — **on par underneath, one easy analytics win**
LUZO tabs: Awaiting Confirmation → Today → Upcoming → Served → Cancelled. Cancellation reason is a **fixed list** (Need help / Took too long to confirm / Booked by mistake / Booked somewhere else / Other).
Salonjaa: `bookingStatus` enum (`PENDING`/`AWAITING_PAYMENT`/`APPROVED`/`REJECTED`/`EXPIRED`/`CANCELLED`/`COMPLETED`/`NO_SHOW`) already has enough granularity to derive LUZO's 5 tabs client-side (Today = `APPROVED` with `scheduledStart` = today; Upcoming = `APPROVED` future; Served = `COMPLETED`) — no backend change needed for the tabs themselves.

**Real, cheap gap:** `POST /bookings/:id/cancel`'s `reason` is freeform text (`z.string().trim().max(500).optional()`, checked the validator live). LUZO's fixed reason list exists specifically for churn analytics — right now we can't run "why are people cancelling" as a clean query, only full-text search over free text. Turning this into an enum (with "Other" + freeform still allowed) is a small, high-leverage change for a business you're about to hand data-driven decisions to (the same PROGRESS.md notes already show reason strings are being collected but never structured).

### 8. Account area — **behind, but partly by explicit choice**
LUZO: profile, appointments, **Wallet** (stored balance/refunds), **Gift Cards** (buy/claim/history), **referrals**, **Favourites**.
Salonjaa: profile (`GET/PATCH /users/me`), addresses, `GET /users/me/bookings` (new today). Favourites was explicitly discussed and **deliberately deferred** earlier today (context.md's own Pending Decisions list it) — not an oversight. Gift cards and referrals were never in scope anywhere and would need a real product decision, not a quick add. Wallet is the interesting one: we don't have a general stored-balance concept, but as of today we *do* have a narrow, single-purpose version of it — the forfeiture coupon issued when a restricted customer's advance payment is forfeited (Module 16). A general wallet would generalize that pattern (refunds, forfeitures, goodwill credits all landing in one stored balance instead of one-off coupons) — worth a look once refunds actually move real money (they don't yet; "approve" only marks a decision, per Module 9b).

### 9. "Pay bill" (pay for a visit with no prior booking) — **the one structural gap**
This is the part of LUZO's model most worth sitting with. Their sidebar has **two separate CTAs**: "Book Services" (the flow above) and "Pay bill" — a customer who walked in with zero prior booking can still settle up digitally afterward. Every payment in Salonjaa is anchored to a `bookingId` (`payments.booking_id` is `NOT NULL`) — there's no way for a real customer account to pay for services rendered without a booking existing first. Our closest equivalent is `POST /salon-bookings/walk-in`, but that's **staff-initiated only** (captures `customerName`/`customerPhone` as free text, no `customerId`, hardcoded `PAY_AT_SALON`) — the actual customer's app has no way to discover or settle that visit. If "pay bill" independent of booking is a real product goal, it's a genuine new capability (a payment that can exist standalone, or a walk-in booking a customer can later "claim" into their account), not a tweak.

## Where Salonjaa is already ahead (worth saying plainly, not just gaps)

- **Real concurrency safety.** Two customers racing for the same slot: we resolve it with a Postgres advisory lock inside the booking transaction (verified today with an actual 5-way concurrent test — exactly 1 succeeds, 4 correctly `409`). Nothing in LUZO's write-up suggests they show true real-time slot-level availability at all (their 3-slot hedge implies they don't).
- **No-show economics.** A real strikes system with an escalating consequence (10% advance payment after the 4th no-show, non-refundable-but-convertible-to-coupon on abuse) — LUZO's write-up mentions only a cancellation-reason list for analytics, no enforcement mechanism.
- **A real admin moderation layer.** Salon verification, refund review, complaint resolution, audit logging on every privileged action — none of this is visible or implied in LUZO's customer-facing flow (naturally; it's back-office), but it's a real maturity gap in our favor versus a "consumer app with no described ops tooling."

## Recommendations, roughly by effort

**Cheap, no new schema, worth doing soon:**
- Add `salonId` as a `GET /public/branches` filter — closes the "View Branches" gap.
- Add branch `phone` to the customer-facing booking DTO — closes "Call Salon."
- Turn `cancel`'s freeform `reason` into a fixed enum (+ "Other" freeform) — real analytics value, small change.
- Revisit `BOOKING_DEFAULT_EXPIRY_HOURS` — this is the one that most changes the customer's actual experience of the app. **Needs your call**, not mine: is 12h intentional slack for salons, or should it come down toward something like LUZO's 15 minutes (with a real operational cost to salons if they can't realistically respond that fast)?

**Real feature work, needs a product decision first (same discipline as every other module this project has followed — don't build a contract, define it with you first):**
- Service variants/customisation (schema-level: a `service_variants` table, or repurpose `branch_services` with a parent/child relationship).
- Price-tier and/or gender-served tags on listings (need to decide: manually set by owner, or computed from service prices?).
- Offer banners on listing cards (link a promotion to a branch card — Module 17's promotions already exist, this is "surface the most relevant one on the card," a real but contained addition).
- A general customer wallet (would subsume today's one-off forfeiture-coupon mechanism) — makes most sense once refund approval actually moves money.
- "Pay bill" without a prior booking — the biggest of these, touches the payment/booking data model's core assumption (`payments.bookingId NOT NULL`). Worth a dedicated conversation, not a quick add.

**Deliberately not recommending:**
- LUZO's "cash not accepted, everything through the app" policy — that's a business choice with real trade-offs (walk-in friction, older/less digital-savvy customers), not obviously correct for you. We already support both `ONLINE` and `PAY_AT_SALON` on purpose.
- Multi-slot preference selection (pick 3) — this exists to compensate for *not* having real-time availability, which we already have. Copying it would be adding UI complexity to work around a problem we don't have.
