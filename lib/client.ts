import createClient from "openapi-fetch";
import type { paths } from "./api-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Type-safe API client generated from the CorpoPay OpenAPI spec.
 * Replaces the old raw axios client: attaches the JWT from localStorage and
 * handles 401 the same way the axios interceptors did.
 *
 * Example:
 *   const { data, error } = await client.GET("/health");
 *   const { data } = await client.POST("/auth/login", { body: { email, password } });
 */
/** Extract a human-readable message from an openapi-fetch error body. */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.error === "string") return e.error;
    if (typeof e.message === "string") return e.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export const client = createClient<paths>({
  baseUrl: API_URL,
  headers: { "Content-Type": "application/json" },
  fetch: async (input: Request) => {
    const headers = new Headers(input.headers);
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cp_token");
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(new Request(input, { headers }));

    // On 401 clear token and redirect to login (same as the old axios interceptor)
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("cp_token");
      localStorage.removeItem("cp_user");
      const path = window.location.pathname;
      if (
        !path.startsWith("/login") &&
        !path.startsWith("/register") &&
        !path.startsWith("/checkout")
      ) {
        window.location.href = "/login";
      }
    }

    return res;
  },
});

/**
 * Server-side / public typed client (no JWT header injection). Used by
 * `getServerSideProps` and the `/api/*` proxy routes, which call public
 * endpoints on behalf of the browser.
 */
export const serverClient = createClient<paths>({
  // On Amplify, non-NEXT_PUBLIC_ env vars (like API_BASE_URL) are not reliably
  // exposed to the SSR runtime, so SSR would silently fall back to
  // localhost:4000. NEXT_PUBLIC_API_URL is inlined at build time and available
  // everywhere — use it as the fallback.
  baseUrl: process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});
