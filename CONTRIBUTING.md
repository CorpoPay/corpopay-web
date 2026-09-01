# Contributing to CorpoPay Web

Browser frontend for CorpoPay — Next.js 16 (pages router) + React 19. Thanks
for contributing. The domain rules that govern CorpoPay (money, statuses,
multi-tenancy) are shared with the API and are non-negotiable — see the
[API repo's `CONTRIBUTING.md`](https://github.com/CorpoPay/corpopay-api/blob/main/CONTRIBUTING.md)
for the full set.

## Prerequisites

- **Node 24+**
- `npm`
- A running `corpopay-api` (see its README), or point `NEXT_PUBLIC_API_URL` at a
  hosted instance.

## Getting started

```bash
npm install
npm run dev   # :3000 — expects the API at NEXT_PUBLIC_API_URL (default http://localhost:4000)
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to override the default.

## The contract

The API's OpenAPI spec is the single source of truth. The web vendors generated
types via:

```bash
# vendored in contract/ — regenerate from corpopay-api with `npm run contract:generate`
cp ../corpopay-api/contract/{api-types.d.ts,openapi.json,enums.ts} contract/
```

Never hand-edit the generated `contract/*` files, or hand-write domain types,
statuses, or money literals.

## Before you submit

```bash
npm run typecheck
npm run lint
npm run test
```

## Conventions (reviewers check these first)

- **Money** — requests are centimes; coerce with `toMoney()` (`lib/money.ts`) and
  format with `formatAmount()` (`lib/utils.ts`).
- **Statuses** — `lib/status.ts` mirrors the Prisma enums; use `statusVariant()` /
  `statusLabel()` rather than hardcoded labels or colors.
- **Data fetching** — TanStack Query for server state; react-hook-form + Zod for
  forms.
- **UI** — Tailwind CSS + shadcn/ui (Radix). Reuse existing components before
  adding new ones.

## Pull request process

- Open a PR against `main`.
- Keep changes focused; add/update tests for new behavior.
- CI must be green (typecheck, lint, test, audit, coverage, and security scans).
- A maintainer will review; discussion is welcome, but the domain rules above
  are not optional.
