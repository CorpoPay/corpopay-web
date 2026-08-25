import { datadogRum } from "@datadog/browser-rum";
import { useEffect } from "react";

/**
 * Client-side Datadog RUM initialisation.
 *
 * Rendered from `pages/_app.tsx`; renders nothing itself. `datadogRum.init`
 * runs once on mount (client-only) so no Datadog code executes during SSR.
 * The applicationId / clientToken come from NEXT_PUBLIC_* build-time env vars
 * (inlined by Next.js), never hardcoded. Site/service/team/product are all
 * configurable via env so self-hosters don't inherit CorpoPay's identity.
 */
export default function DatadogInit() {
  useEffect(() => {
    const applicationId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID;
    const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN;
    if (!applicationId || !clientToken) {
      return;
    }

    datadogRum.init({
      applicationId,
      clientToken,
      site: process.env.NEXT_PUBLIC_DD_SITE || "datadoghq.eu",
      service: process.env.NEXT_PUBLIC_DD_SERVICE || "corpopay-web",
      env: process.env.NEXT_PUBLIC_DD_ENV || "dev",
      version: process.env.NEXT_PUBLIC_DD_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: "mask-user-input",
    });

    // Optional team/product tags (for multi-product Datadog orgs). Only set when
    // explicitly configured via env.
    const team = process.env.NEXT_PUBLIC_DD_TEAM;
    const product = process.env.NEXT_PUBLIC_DD_PRODUCT;
    if (team) datadogRum.setGlobalContextProperty("team", team);
    if (product) datadogRum.setGlobalContextProperty("product", product);
  }, []);

  return null;
}
