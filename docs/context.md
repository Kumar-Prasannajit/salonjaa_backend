# Salonjaa Context

## Project Overview

Salonjaa is a multi-city salon discovery, booking, payment, and salon-management platform for Customers, Salon Owners, and Admins. Staff are managed branch records without MVP login access.

## Current Architecture Decisions

- Node.js, Express.js, TypeScript.
- PostgreSQL with Drizzle ORM/migrations.
- Redis for rate limits, cache, short-lived coordination; PostgreSQL bookings remain availability truth.
- BullMQ for delayed expiry and asynchronous notifications/provider work.
- Email OTP authentication; OTP provider interface keeps SMS/WhatsApp pluggable.
- JWT access token: 15 minutes; refresh token: 30 days; refresh-token hashes stored in database; multiple sessions allowed.
- Role authority is `user_roles`; frontend-supplied roles are never trusted.
- Payment and notification providers use adapters/interfaces.

## Business Decisions

- Admin approval is required before a salon is public or accepts bookings.
- One salon owner profile can own multiple salons; each salon has one owner profile; a salon has multiple independent branches.
- Services, staff, bookings, slot schedules, and capacity are branch-scoped.
- Staff do not have login/dashboard access in MVP.
- Customer booking is pending salon approval; pending bookings reserve availability immediately.
- Walk-ins are stored, consume capacity, appear in reports/analytics, and are not commission-applied.
- Online and pay-at-salon payments are supported; Salonjaa receives online payments; settlement is manual in MVP.
- Reviews are limited to completed bookings and one review per booking.
- Historical bookings, payments, refunds, reviews, audit logs, and snapshots are retained.

## Booking Engine Decisions

- `bookings.scheduled_start` and `scheduled_end` are the source of truth; slot templates only generate/select start times.
- Multi-service duration is sequential `sum(service duration × quantity)`; parallel execution is out of scope.
- Effective capacity is `MIN(total chairs, active service staff, optional capacity override)`.
- Capacity is evaluated by full time-range overlap, including pending and approved bookings; rejected, expired, cancelled, refunded, and completed bookings do not consume availability.
- A selected stylist must be branch staff, eligible for all selected services, not on leave, and non-overlapping. Skipped stylist reserves only branch capacity.
- Booking expiry is Admin-configurable, default 12 hours; expiry releases availability and creates no strike.
- Rejection/cancellation release availability by status transition. Approved booking check-in uses a one-time, time-limited OTP.

## Pending Decisions

The source documents leave these implementation details unspecified; this document does not decide them:

- Numeric OTP expiry, retry-attempt limit, resend cooldown, and rate-limit windows.
- Numeric review edit period and booking cancellation/refund eligibility policy.
- Advance-payment amount/collection rule for restricted customers.
- Exact Admin API endpoint inventory and corresponding request/response contracts.
- API contracts for favourites, salon media, slot-template CRUD, promotions, reports, analytics, complaints, no-show and booking check-in actions.
- Exact payment-provider selection and provider credentials.
- Customer-created reschedule acceptance/rejection route names: supplied inventory gives owner approve/reject endpoints while BRD also requires customer response to salon proposals.
- The provided enum file omits `NO_SHOW`, although the finalized BRD requires that state.

## Known Risks

- Concurrent booking attempts require transactional revalidation; cache/Redis locks alone are insufficient.
- The BRD allows permanent service/staff deletion while historical booking FK references must survive; use restrict/soft-delete or nullable historical references with snapshots.
- A staff leave can reduce future effective capacity without automatically cancelling an approved booking; owner must resolve affected appointments.
- API inventory lacks admin routes and many BRD capabilities, so backend routes cannot be safely inferred.
