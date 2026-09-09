# Next session — the hard remaining items from the LUZO comparison

Source: `docs/COMPETITOR_COMPARISON_LUZO.md`'s "Real feature work" list. The four cheap items from that doc (plus the `BOOKING_DEFAULT_EXPIRY_MINUTES` change) are done — see `docs/PROGRESS.md`'s Module 19 and the previous commit. This document is what's left: real product/schema decisions, not quick additions. **None of these are built. None have a contract yet.** Per this project's whole discipline (`CLAUDE.md`: "never build ahead of the documented contract"), the first thing next session should do for each item picked up is get the open questions below answered — not guess and build.

Priority order below is a suggestion, not a mandate — ask which the user wants first.

## 1. Service variants / customisation

**Why:** LUZO requires a single-select variant (e.g. Facial — Papaya ₹999 / Diamond ₹1499) before a customisable service can be added to cart. Salonjaa's `branch_services` is flat (`name`, `durationMinutes`, `basePrice`) — a salon offering priced variants today has to model each as a wholly separate service, which pollutes the menu.

**Open questions to ask the user before building:**
- Does a variant override just the **price**, or also **duration**? (LUZO's variants are same-service-different-ingredient, likely same duration — but don't assume.)
- Is selection **required single-select only** (matches LUZO exactly), or should the schema also allow future multi-select add-ons? Building for single-select now, extensibly, is probably right — but confirm.
- Does an existing booking's `booking_services` snapshot need a `variantId`/`variantName`/`variantPrice` column (yes, almost certainly — immutable snapshot, same reasoning as everything else in that table), or is variant choice folded into the price/duration already snapshotted (no visible "which variant" record)?

**Likely shape once decided:** new `service_variants` table (`id`, `branchServiceId`, `name`, `price`, maybe `durationMinutes` override, `active`, soft-delete) + `branch_services` gains `hasVariants`/`variantRequired` boolean, or variants' mere existence implies required-selection. `booking_services` gains nullable variant snapshot columns. Owner-facing CRUD under `POST/GET /services/:id/variants` (matches the existing `staff`/`services` assignment-endpoint pattern). `POST /bookings`'s `services` array entries need a way to carry `{serviceId, variantId?}` instead of a bare ID — this is the one part of the *existing* contract that would change shape, flag it clearly to the frontend before building.

## 2. Price tier + gender-served tags on listing cards — ✅ Done (Module 21)

Built per the decisions below (computed price tier, branch-level gender-served). See `docs/PROGRESS.md`'s Module 21 entry and `docs/frontend_handover.md`'s listing-card-signals section for the shipped contract.


**Why:** LUZO's cards show ₹/₹₹/₹₹₹ and Unisex/Men at a glance — cheap signal for shortlisting, currently absent from `PublicBranchListItemDTO`.

**Open questions:**
- Price tier: **computed** (bucket the branch's average/min active-service `basePrice` into 3 tiers server-side, no owner input needed) or **owner-set** (a manual field on `branches`/`salons`, more control but one more thing for an owner to fill in during onboarding)? Computed is less work and always accurate; owner-set lets a salon signal "affordable" even with one pricey add-on service skewing an average. Needs a call.
- Gender-served: **owner-set enum** (`UNISEX`/`MEN`/`WOMEN`) is really the only sane option here — no way to infer this from existing data. Just needs a column + where it's set (branch creation? salon-level, not branch-level — check with the user which makes more sense for a multi-branch brand).

**Likely shape once decided:** if owner-set, a column on `salons` or `branches` (decide which) + surfaced on `PublicBranchListItemDTO`/`PublicBranchDetailDTO`. If price tier is computed, it's a pure read-time bucketing in `PublicBranchRepository`/`PublicBranchService`, no schema change at all — genuinely cheap once the bucket thresholds are decided (ask for real ₹ cutoffs, don't invent them).

## 3. Offer banners on listing cards — ✅ Done (Module 21)

Built per the owner-flagged-`featured` tie-break decided with the user. See `docs/PROGRESS.md`'s Module 21 entry and `docs/frontend_handover.md`'s listing-card-signals section for the shipped contract.


**Why:** LUZO shows "Get 40% OFF via LUZO" right on the card. Module 17's promotions (`GET /public/promotions?branchId=`) already exist as a separate list — nothing surfaces the most relevant one *on* the branch card itself today.

**Open question:** if a branch has multiple active promotions, which one goes on the card — soonest-ending, most-recently-created, or an owner-flagged "featured" one (needs a new boolean)? This is genuinely the only real decision here.

**Likely shape once decided:** this one might not even need a schema change — `PublicBranchListItemDTO` gains an optional `activePromotion: {title, bannerImageUrl} | null`, computed via the same query `getRatingAggregates` already does in bulk for the branch list (avoid N+1). **Probably the cheapest of the five "hard" items** — consider doing this one first once the tie-break question is answered.

## 4. General customer wallet — ✅ Done (Module 20)

Built per the "Recommendation for scoping this down" below, confirmed with the user rather than assumed. See `docs/PROGRESS.md`'s Module 20 entry and `docs/frontend_handover.md`'s wallet section for the shipped contract. Left in place below for the record of the original open questions and how each was resolved.

**Why:** LUZO's account area has a stored-balance wallet; Salonjaa has only the narrow, single-purpose forfeiture-coupon mechanism from Module 16, and refund "approval" today only marks a decision — no money or credit actually moves anywhere (`docs/PROGRESS.md`'s Module 9b note: "no automated eligibility logic... no gateway wired for issuing funds").

**Open questions — this is the deepest one, needs real product discussion, not just a schema call:**
- Does an approved refund credit the wallet (in-app credit, no real payment-gateway refund integration needed) instead of/in addition to the current "just marks approved, no money moves" behavior? This is likely the actual point of building a wallet — it's the missing mechanism, not just a nice-to-have account screen.
- Can wallet balance be spent as a `paymentMethod` on `POST /bookings` (a third option alongside `ONLINE`/`PAY_AT_SALON`), or only as a discount applied like a coupon?
- Does the Module 16 forfeiture-coupon mechanism get **replaced** by wallet credits going forward, or do both coexist (coupon for a specific forfeited amount tied to one event, wallet for general balance)?
- Any withdrawal/expiry rules, or does balance just sit indefinitely until spent?

**Recommendation for scoping this down for a first pass:** wallet balance credited only by admin-approved refunds + Module 16 forfeitures; spendable as a new `paymentMethod: "WALLET"` on booking creation (reuses the exact payment-method branching `approve()` already has); no withdrawal. Confirm with the user before building — this is a real product decision, not something to default silently.

## 5. "Pay bill" — pay for a visit with no prior booking

**Why:** the single most structural gap. LUZO's sidebar has a CTA independent of "Book Services" — a walk-in customer with zero prior booking can settle up digitally afterward. Every Salonjaa payment is anchored to a `bookingId` (`payments.booking_id NOT NULL`); `POST /salon-bookings/walk-in` exists but is staff-initiated only (`customerName`/`customerPhone` free text, no `customerId`, hardcoded `PAY_AT_SALON` — the real customer's account has no way to discover or pay it).

**This needs a decision on which of two materially different things to build, before any code:**

- **(a) "Claim a walk-in" (smaller, reuses ~95% of existing infrastructure):** a customer who got walked-in enters the booking's existing `bookingNumber` (already a real, customer-facing lookup code) into the app; a new endpoint links that booking's `customerId` to their account (one-time, ownership-checked); from that point on, the *existing* payment flow just works (the booking already has `totalAmount`, `paymentMethod` could switch from `PAY_AT_SALON` to allow `ONLINE` at claim time). Small, contained, no `payments` schema change.
- **(b) Fully decoupled "pay with no booking at all" (bigger, touches a core assumption):** `payments.bookingId` becomes nullable, a new "standalone payment request" concept exists (salon creates one with just an amount + description, customer pays via a link/code with no booking anywhere in the picture). Every place that currently assumes a payment always has a booking (refunds, settlements, the customer payment-history listing, notifications) needs a look. Bigger, more accurately matches what LUZO's "Pay bill" *might* actually be, but nothing in `luzo.txt` confirms it's this rather than (a) — their write-up doesn't show the actual "Pay bill" screen in detail.

**Recommendation:** start with (a) — ask the user to confirm this is what "pay bill" should mean for Salonjaa before considering (b) at all. (a) alone closes most of the practical gap (a walk-in customer can self-serve payment) without redesigning the payment schema's core invariant.

## How to start next session

1. Read this file, `docs/COMPETITOR_COMPARISON_LUZO.md`, and `docs/PROGRESS.md`'s Module 15–19 entries for full context — don't re-derive any of today's reasoning from scratch.
2. Ask the user which of the 5 items above to tackle, and in what order — don't assume this document's priority order is final.
3. For whichever item(s) are picked, **ask the open questions listed above before writing any code** — same discipline every module in this project has followed (co-define the contract with the user, then build, per `CLAUDE.md`).
4. Same workflow as every prior module: real migration via `npm run db:generate`, `npm run typecheck && npm run build` before committing, real tests in `tests/` (the Vitest suite is fully set up — `npm test`, see `docs/PROGRESS.md`'s Module 18), update `docs/PROGRESS.md` and `docs/frontend_handover.md` in the same commit as the feature.
