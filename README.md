# CorpoPay Web

<div align="center">
  <img src="./public/assets/logo/logo-with-text.png" alt="CorpoPay" width="300" />
</div>

[![CI](https://github.com/CorpoPay/corpopay-web/actions/workflows/ci.yml/badge.svg)](https://github.com/CorpoPay/corpopay-web/actions/workflows/ci.yml)
[![CodeQL](https://github.com/CorpoPay/corpopay-web/actions/workflows/codeql.yml/badge.svg)](https://github.com/CorpoPay/corpopay-web/actions/workflows/codeql.yml)
[![release](https://github.com/CorpoPay/corpopay-web/actions/workflows/release-please.yml/badge.svg)](https://github.com/CorpoPay/corpopay-web/actions/workflows/release-please.yml)
[![License](https://img.shields.io/github/license/CorpoPay/corpopay-web)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)

**Browser frontend for CorpoPay** — **Next.js 16 (pages router) + React 19**. Four
surfaces: merchant dashboard, admin backoffice, hosted checkout, and the paywall
relay page. Talks to `corpopay-api` through a generated openapi-fetch client.

## Architecture

```mermaid
flowchart TB
    subgraph Surfaces["CorpoPay Web (Next.js)"]
        Dashboard["Merchant dashboard"]
        Admin["Admin backoffice"]
        Checkout["Hosted checkout"]
        Paywall["Paywall relay"]
    end

    Dashboard --> API["corpopay-api"]
    Admin --> API
    Checkout --> API
    Paywall --> API

    API --> Stripe["Stripe"]
    API --> VPS["VPS / Payzone"]
    API --> NAPS["NAPS"]
```

## Surfaces

- **Merchant dashboard** (`/dashboard/*`) — tenants manage payment links, intents,
  transactions, subscriptions, installments, and provider configs.
- **Admin backoffice** (`/admin/*`) — super-admins manage tenants, search payments,
  monitor webhooks and provider health.
- **Hosted checkout** (`/checkout/:slug`) — customer-facing payment page.
- **Paywall relay** (`/pay/:correlationId`) — redirects to the provider's paywall.

## The contract

The API's OpenAPI spec (`corpopay-api/src/openapi.ts`) is the single source of
truth, published as the `@corpopay/contract` npm package. The web installs it:

```bash
npm install @corpopay/contract
```

Never hand-edit the generated types, or hand-write domain types,
statuses, or money literals.

## Quick start

```bash
npm install
npm run dev   # :3000 — expects the API at NEXT_PUBLIC_API_URL (default http://localhost:4000)
```

## Verify

```bash
npm run typecheck
npm run lint
npm run test
```

## Tech stack

- Next.js 16 (pages router), React 19, TypeScript
- Tailwind CSS + shadcn/ui (Radix)
- TanStack Query, react-hook-form + Zod
- Vitest

## Money & statuses

- **Money** — requests are centimes; coerce with `toMoney()` (`lib/money.ts`) and
  format with `formatAmount()` (`lib/utils.ts`).
- **Statuses** — `lib/status.ts` mirrors the Prisma enums; use `statusVariant()` /
  `statusLabel()`.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Pull requests are welcome. The domain conventions (money, statuses, the contract)
are shared with the API — see the API repo's `CONTRIBUTING.md` for the rules.
