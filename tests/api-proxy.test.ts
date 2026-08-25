import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const server = setupServer();

let checkoutProxy: typeof import("@/pages/api/checkout-proxy").default;
let installmentPlansProxy: typeof import("@/pages/api/installment-plans-proxy").default;

beforeAll(async () => {
  // Listen first so the proxy handlers (which import serverClient) capture the
  // MSW-patched global fetch at module load.
  server.listen({ onUnhandledRequest: "error" });
  ({ default: checkoutProxy } = await import("@/pages/api/checkout-proxy"));
  ({ default: installmentPlansProxy } = await import("@/pages/api/installment-plans-proxy"));
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Minimal NextApiResponse double. Records the status and JSON body so tests can
 * assert what the proxy route returned to the public browser.
 */
function mockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function mockRequest(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return { method: "GET", query: {}, body: undefined, ...overrides } as NextApiRequest;
}

describe("checkout-proxy (POST /api/checkout-proxy)", () => {
  it("forwards a successful pay request and returns the intent", async () => {
    server.use(
      http.post("http://localhost:4000/public/checkout/slug-1/pay", () =>
        HttpResponse.json({
          intentId: "intent-123",
          redirectUrl: "https://pay.example.com/redirect",
          providerData: null,
        }),
      ),
    );

    const req = mockRequest({
      method: "POST",
      body: { slug: "slug-1", installmentPlanId: "plan-9" },
    });
    const res = mockResponse();
    await checkoutProxy(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ intentId: "intent-123" });
  });

  it("rejects non-POST methods", async () => {
    const res = mockResponse();
    await checkoutProxy(mockRequest({ method: "GET" }), res as unknown as NextApiResponse);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a missing slug", async () => {
    const res = mockResponse();
    await checkoutProxy(
      mockRequest({ method: "POST", body: {} }),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(400);
  });

  it("maps an upstream error to the upstream status", async () => {
    server.use(
      http.post(
        "http://localhost:4000/public/checkout/slug-1/pay",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const res = mockResponse();
    await checkoutProxy(
      mockRequest({ method: "POST", body: { slug: "slug-1" } }),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(404);
  });
});

describe("installment-plans-proxy (GET /api/installment-plans-proxy)", () => {
  it("forwards a successful plans request", async () => {
    server.use(
      http.get("http://localhost:4000/public/installment-plans/slug-1", () =>
        HttpResponse.json({ currency: "MAD", principal: 1000, plans: [] }),
      ),
    );

    const res = mockResponse();
    await installmentPlansProxy(
      mockRequest({ method: "GET", query: { slug: "slug-1" } }),
      res as unknown as NextApiResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ currency: "MAD" });
  });

  it("rejects non-GET methods", async () => {
    const res = mockResponse();
    await installmentPlansProxy(mockRequest({ method: "POST" }), res as unknown as NextApiResponse);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a missing slug", async () => {
    const res = mockResponse();
    await installmentPlansProxy(
      mockRequest({ method: "GET", query: {} }),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(400);
  });

  it("maps an upstream 404 to 404", async () => {
    server.use(
      http.get(
        "http://localhost:4000/public/installment-plans/slug-1",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const res = mockResponse();
    await installmentPlansProxy(
      mockRequest({ method: "GET", query: { slug: "slug-1" } }),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(404);
  });
});
