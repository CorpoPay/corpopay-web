import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { client } from "@/lib/client";

const server = setupServer(
  http.get("http://localhost:4000/health", () => HttpResponse.json({ status: "ok" })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => localStorage.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("client (authenticated browser)", () => {
  it("fetches a typed response through MSW", async () => {
    const { data, error } = await client.GET("/health");
    expect(error).toBeUndefined();
    expect(data?.status).toBe("ok");
  });

  it("attaches the stored JWT as a Bearer token", async () => {
    localStorage.setItem("cp_token", "test-jwt");
    let authHeader: string | null = null;

    server.use(
      http.get("http://localhost:4000/health", ({ request }) => {
        authHeader = request.headers.get("authorization");
        return HttpResponse.json({ status: "ok" });
      }),
    );

    await client.GET("/health");

    expect(authHeader).toBe("Bearer test-jwt");
  });

  it("clears the stored credentials on a 401", async () => {
    // Put the browser on /login so the redirect branch (which jsdom cannot
    // navigate) is skipped; we only assert the credential cleanup here.
    window.history.pushState({}, "", "/login");
    localStorage.setItem("cp_token", "stale-token");
    localStorage.setItem("cp_user", "stale-user");

    server.use(
      http.get("http://localhost:4000/health", () => new HttpResponse(null, { status: 401 })),
    );

    const { response } = await client.GET("/health");

    expect(response.status).toBe(401);
    expect(localStorage.getItem("cp_token")).toBeNull();
    expect(localStorage.getItem("cp_user")).toBeNull();
  });
});
