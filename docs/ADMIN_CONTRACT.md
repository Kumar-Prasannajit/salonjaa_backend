# Admin Contract — Refunds, Complaints, Reports

Salon moderation is already shipped (list/verify/reject/suspend/reactivate, audit_logs + admin_actions pattern established). This doc covers the next three pieces, in priority order. Follow the same pattern already established for salon moderation — audit_logs + admin_actions, not a bare/unused audit_logs — reconcile with whatever that actual implementation looks like rather than treating this as the starting authority on that pattern.

Settlement creation, coupon/category management, and customer strikes are explicitly OUT of scope for this pass — not because they're wrong ideas, but because nobody has asked for them yet. Don't build them preemptively.

All routes below require `Authorization: Bearer <accessToken>` for a user with the `ADMIN` role. All routes prefixed `/api/v1/admin`. Standard `{ success: true, data }` envelope. Standard error codes: `400`, `401`, `403`, `404`, `409`, `500`.

---

## 1. Refunds — manual approval only, build this first

No automated eligibility logic. Every refund request an admin sees, they read and decide by hand. `context.md`'s cancellation/refund eligibility policy is explicitly still undecided (listed in its own "Pending Decisions") — do not attempt to encode an eligibility rule here. This is intentional scope-limiting for now, to be automated later based on real cancellation-policy logic once that's defined.

### `GET /admin/refunds`
Query: `status` — `PENDING | APPROVED | PROCESSING | COMPLETED | REJECTED`. Join in booking + payment + customer info so the admin has enough context to decide without a second lookup.

### `GET /admin/refunds/:id`
Full detail — booking, payment, customer, requested reason.

### `POST /admin/refunds/:id/approve`
Body: `{ notes?: string }`
Sets `refunds.status = 'APPROVED'`. Does NOT trigger actual money movement — MVP payment is pay-at-salon only, so "approve" here just marks the decision; there's no gateway to actually issue funds through yet. Audit-logged (same pattern as salon moderation).

### `POST /admin/refunds/:id/reject`
Body: `{ reason: string }` (required — refuse the request without a reason, same validation discipline as salon reject/suspend)
Sets `refunds.status = 'REJECTED'`. Audit-logged.

---

## 2. Complaints

Two sides needed — filing (doesn't exist anywhere yet) and resolving (Admin). Decide where the filing route lives (existing module, or a new minimal complaints module) and explain the reasoning — don't just default silently.

### `POST /complaints` (NOT under /admin — filed by Customer or Salon Owner)
Body: `{ type: 'BOOKING'|'PAYMENT'|'SALON'|'STAFF'|'REFUND'|'OTHER', referenceId?: string, description: string }`
Creates with `status = 'OPEN'`.

### `GET /admin/complaints`
Query: `status` — `OPEN | IN_PROGRESS | RESOLVED | REJECTED`.

### `GET /admin/complaints/:id`
Full detail including filer info and any linked booking/payment.

### `POST /admin/complaints/:id/resolve`
Body: `{ resolutionNotes: string }`
Sets `status = 'RESOLVED'`. Audit-logged.

### `POST /admin/complaints/:id/reject`
Body: `{ reason: string }`
Sets `status = 'REJECTED'`. Audit-logged.

---

## 3. Reports — deliberately minimal, not a BI tool

### `GET /admin/reports/overview`
Optional `from`/`to` date range query params (default: last 30 days). Returns a flat aggregate object:
```json
{
  "totalBookings": 0,
  "completedBookings": 0,
  "cancelledBookings": 0,
  "totalSalons": 0,
  "verifiedSalons": 0,
  "pendingSalons": 0,
  "totalRevenue": 0,
  "openComplaints": 0,
  "pendingRefunds": 0
}
```
Plain aggregate `COUNT`/`SUM` queries against existing tables. No charts, no time-series breakdown, no export. If the client wants more after seeing this, that's a real follow-up conversation — don't pre-build it speculatively.

---

## Testing bar (match what salon moderation already did)

Full lifecycle per piece (e.g. refund: list → approve/reject), validation (reject requires a reason, same as salon), audit trail confirmed via direct SQL, non-admin gets 403, commit each piece (refunds / complaints / reports) separately rather than bundled.
