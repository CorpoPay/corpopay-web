import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();

let serverClient: typeof import("@/lib/client").serverClient;

beforeAll(async () => {
  // Listen first so openapi-fetch captures the MSW-patched global fetch when the
  // module is imported — serverClient uses openapi-fetch's default fetch, which
  // is resolved at module load, unlike `client` which injects its own fetch.
  server.listen({ onUnhandledRequest: "error" });
  ({ serverClient } = await import("@/lib/client"));
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("serverClient (public / server)", () => {
  it("fetches a public endpoint without attaching auth headers", async () => {
    let authHeader: string | null = null;

    server.use(
      http.get("http://localhost:4000/public/installment-plans/slug-1", ({ request }) => {
        authHeader = request.headers.get("authorization");
        return HttpResponse.json({ currency: "MAD", principal: 1000, plans: [] });
      }),
    );

    const { data, error } = await serverClient.GET("/public/installment-plans/{slug}", {
      params: { path: { slug: "slug-1" } },
    });

    expect(error).toBeUndefined();
    expect(data?.currency).toBe("MAD");
    expect(data?.plans).toEqual([]);
    expect(authHeader).toBeNull();
  });

  it("surfaces the upstream status on an error response", async () => {
    server.use(
      http.get(
        "http://localhost:4000/public/installment-plans/missing",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { data, error, response } = await serverClient.GET("/public/installment-plans/{slug}", {
      params: { path: { slug: "missing" } },
    });

    expect(data).toBeUndefined();
    expect(error).toBeDefined();
    expect(response.status).toBe(404);
  });
});
