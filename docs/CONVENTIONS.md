# Conventions

These patterns are established across Modules 1-3. Follow them exactly for every new module — don't introduce a different style even if it seems cleaner.

## Module file layout
Every module under `src/modules/<name>/` has, as needed:
```
<name>.routes.ts       # Express Router, mounts middleware, wires validators
<name>.controller.ts   # thin HTTP layer only — calls service, shapes the response
<name>.service.ts      # business logic, ownership checks, orchestration
<name>.repository.ts   # all Drizzle queries live here, nowhere else
<name>.validator.ts    # zod schemas
<name>.types.ts         # input/DTO interfaces
```
Controllers never touch the DB directly. Services never import Express types. Repositories never throw `AppError` — that's the service's job (repository returns `null`/rows, service decides what that means).

## Response shapes
Default envelope (use `sendSuccess`/`sendCreated`/`sendNoContent` from `src/shared/response.ts`):
```json
{ "success": true, "data": { ... } }
```
**Exception:** when `frontend_handover.md` documents an exact literal response shape for an endpoint, match that shape exactly, even if it breaks the envelope convention (see Auth's `refresh-token` returning bare `{ accessToken }`, or `GET /users/me` returning the profile with no wrapper at all). Check the doc before assuming the default envelope applies.

Errors always go through the global error handler (`src/middleware/error.middleware.ts`) via `throw new SomeAppError(...)` from `src/shared/errors.ts` — never `res.status().json()` an error manually in a controller.

## Ownership pattern
Every module that has an owner (Salon, Branch, and everything under them — Staff, Service, Booking, etc.) implements a private `assertOwned(userId, resourceId)` in its service that throws `NotFoundError` (not `ForbiddenError`) when the resource doesn't exist OR exists but isn't owned by the caller — this deliberately avoids leaking existence of other users' resource IDs. See `SalonService.assertOwned` and `BranchService.assertOwned`/`BranchRepository.findOwnedBranch` for the reference implementation (Branch ownership is resolved by joining up through `salons` → `salon_owner_profiles` → `users`).

When a new module's resources hang off an existing owned resource (e.g. Staff hangs off Branch), call the parent module's service to verify ownership rather than re-implementing the join — see how `BranchService.create` calls `SalonService.assertOwned` before creating a branch.

## Validation
All request validation is zod schemas in `<name>.validator.ts`, applied via the `validate({ body, params, query })` middleware. Never validate manually in a controller. Coerce/trim in the schema (`.trim()`, `z.coerce.number()`), don't do it in the service.

## Soft delete
Tables with a `deletedAt` column are never hard-deleted from user-facing routes. `DELETE` endpoints set `deletedAt = now()`. All repository read queries filter `isNull(table.deletedAt)`.

## Auth & roles
- `requireAuth` middleware (JWT) always comes before `requireRole(...)` in route chains.
- Roles come only from the JWT `roles` claim, which is derived from `user_roles` at token-issue time — never trust a role from the request body.
- There is currently no API endpoint anywhere in the docs for granting `SALON_OWNER` or `ADMIN` roles. Don't invent one speculatively. Use `npm run db:grant-role` for local testing until Admin module defines this properly.

## Scope discipline (important)
Only build what `docs/frontend_handover.md` documents an endpoint for. `docs/TRD.md` describes more tables than are currently wired to endpoints (e.g. `salon_gallery_images`, `branch_slot_templates`) — these are real future tables, not mistakes, but don't build schema/endpoints for them speculatively. Check `docs/context.md`'s "Pending Decisions" section before inventing a contract that isn't documented anywhere — if a decision is listed there as unresolved, ask rather than assume.

## Git workflow
One module = one commit. After finishing a module: `npm run typecheck`, `npm run build`, confirm the app boots, then commit. Update `docs/PROGRESS.md` in the same commit.
