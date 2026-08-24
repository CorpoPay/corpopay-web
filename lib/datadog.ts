import { datadogRum } from "@datadog/browser-rum";

/**
 * Lightweight typed wrapper around Datadog RUM for Product Analytics. The rest of
 * the app calls `trackAction` (instead of reaching into the SDK directly) so the
 * checkout funnel is a single, consistent set of named actions.
 *
 * No-ops safely when RUM isn't initialised (e.g. a build without a client token),
 * so calls are safe on every page without a guard.
 */
export function trackAction(name: string, context: Record<string, unknown> = {}): void {
  try {
    datadogRum.addAction(name, context);
  } catch {
    // RUM not initialised — ignore.
  }
}
