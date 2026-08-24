/**
 * Money convention — single source of truth.
 *
 * - **Requests** (API payloads) are in **centimes** (integer). A 1 250.00 MAD
 *   payment link is sent as `amount: 125000`.
 * - **Database** stores amounts as MAD `Decimal(12, 2)`.
 * - **Responses** return money as `number | string | null`:
 *     - Prisma `Decimal` serializes to a JSON **string**;
 *     - handlers that call `Number()` emit a **number**;
 *     - absent amounts are `null`.
 *
 * Never silently assume `number`, and never double-multiply centimes ↔ MAD.
 */

/**
 * Narrow the OpenAPI-generated money type (`number | string | unknown`) down to
 * the runtime shape (`number | string | null`). The generated union includes
 * `unknown` because of how `nullable` unions are emitted by zod-to-openapi, but
 * the API only ever returns a number, a string, or null.
 */
export function toMoney(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}
