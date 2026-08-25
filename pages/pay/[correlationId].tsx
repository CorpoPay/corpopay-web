import { Shield } from "lucide-react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { serverClient } from "@/lib/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RelayData {
  // VPS / Payzone fields
  paywallUrl?: string;
  payload?: string;
  signature?: string;
  mode?: string;
  // Stripe fields
  /** Direct Stripe-hosted checkout URL — present when provider is STRIPE */
  redirectUrl?: string;
}

interface Props {
  relay: RelayData | null;
  /** true → payment already processed (SUCCEEDED / FAILED / CANCELED / REFUNDED) */
  terminal: boolean;
  /** true → session expired — the Stripe/VPS session timed out before the customer paid */
  expired: boolean;
  notFound: boolean;
  /** true → upstream API error — show a generic "try again" message instead of "already processed" */
  unavailable: boolean;
}

// ─── SSR ───────────────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const correlationId = params?.correlationId as string;

  const defaultProps = {
    relay: null,
    terminal: false,
    expired: false,
    notFound: false,
    unavailable: false,
  };

  try {
    const { data, error, response } = await serverClient.GET("/public/pay/{correlationId}", {
      params: { path: { correlationId } },
    });

    if (error || !data) {
      if (response.status === 404) {
        return { props: { ...defaultProps, notFound: true } };
      }
      return { props: { ...defaultProps, unavailable: true } };
    }

    // SUCCEEDED / REFUNDED → genuinely already paid
    const terminal = ["SUCCEEDED", "REFUNDED"].includes(data.status);

    // FAILED / CANCELED → session expired or was voided — user should retry
    // by going back to the booking page and clicking "Pay" again.
    const expired = ["FAILED", "CANCELED"].includes(data.status);

    // Normalise providerData — for Stripe the relay page only needs redirectUrl;
    // for VPS/Payzone it needs paywallUrl + payload + signature + mode.
    const pd = data.providerData;
    const relay: RelayData | null = pd
      ? {
          paywallUrl: pd.paywallUrl,
          payload: pd.payload,
          signature: pd.signature,
          mode: pd.mode,
          redirectUrl: pd.redirectUrl,
        }
      : null;

    // A relay object is only useful if it has something to act on.
    const hasAction =
      relay && (relay.redirectUrl || (relay.paywallUrl && relay.payload && relay.signature));

    return {
      props: {
        ...defaultProps,
        relay: hasAction ? relay : null,
        terminal,
        expired,
      },
    };
  } catch {
    // Any other upstream error (5xx, network timeout, etc.) — do NOT treat as
    // terminal. Show an "unavailable" message so the user knows to try again
    // rather than thinking their payment has already gone through.
    return { props: { ...defaultProps, unavailable: true } };
  }
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PayRelayPage({ relay, terminal, expired, notFound, unavailable }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  // For Stripe: redirect directly to the Stripe-hosted checkout URL.
  useEffect(() => {
    if (relay?.redirectUrl) {
      window.location.href = relay.redirectUrl;
    }
  }, [relay?.redirectUrl]);

  // For VPS/Payzone: auto-submit the hidden form the moment the page mounts.
  // The form targets _self so the full page navigates to Payzone's hosted UI.
  useEffect(() => {
    if (relay && !relay.redirectUrl && formRef.current) {
      formRef.current.submit();
    }
  }, [relay]);

  if (notFound) {
    return (
      <StatusPage>
        <p className="text-lg font-semibold">Payment link not found</p>
        <p className="text-sm text-muted-foreground mt-1">
          This payment link doesn&apos;t exist or may have expired.
        </p>
      </StatusPage>
    );
  }

  if (terminal) {
    return (
      <StatusPage>
        <p className="text-lg font-semibold">Payment already processed</p>
        <p className="text-sm text-muted-foreground mt-1">
          This payment has already been completed successfully.
        </p>
      </StatusPage>
    );
  }

  if (expired) {
    return (
      <StatusPage>
        <p className="text-lg font-semibold">Payment session expired</p>
        <p className="text-sm text-muted-foreground mt-1">
          This payment session has expired. Please go back to your booking and click{" "}
          <strong>Pay</strong> again to start a new session.
        </p>
      </StatusPage>
    );
  }

  if (unavailable) {
    return (
      <StatusPage>
        <p className="text-lg font-semibold">Payment session unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">
          We could not load your payment session. Please try again in a moment.
        </p>
      </StatusPage>
    );
  }

  if (!relay) {
    return (
      <StatusPage>
        <p className="text-lg font-semibold">Payment session unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">
          This payment session could not be loaded. Please try again.
        </p>
      </StatusPage>
    );
  }

  // Active session — hidden form auto-submitted on mount
  return (
    <>
      <Head>
        <title>Redirecting to secure payment…</title>
      </Head>

      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/30">
        {relay.redirectUrl ? null : ( // Show a spinner while the browser navigates. // Stripe: window.location.href redirect is already triggered in useEffect above.
          /*
            VPS/Payzone: This form is submitted programmatically via useEffect.
            It POSTs payload + signature + mode to Payzone's hosted paywall URL.

            `mode` must be a top-level POST field: the paywall JS reads it from
            the form data (not from inside the payload JSON) when calling
            /pwthree/api/initialize?mode=DEEP_LINK&... — without it initialize
            400s and the paywall never renders (confirmed in sandbox logs).
          */
          <form ref={formRef} method="POST" action={relay.paywallUrl} className="hidden">
            <input type="hidden" name="payload" value={relay.payload} />
            <input type="hidden" name="signature" value={relay.signature} />
            <input type="hidden" name="mode" value={relay.mode} />
          </form>
        )}

        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting you to secure payment…</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          {relay.redirectUrl
            ? "Secured by CorpoPay · Powered by Stripe"
            : "Secured by CorpoPay · Powered by Payzone"}
        </div>
      </div>
    </>
  );
}

// ─── Shared layout for non-redirect states ──────────────────────────────────────

function StatusPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <title>CorpoPay — Secure Payment</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-center">
        {children}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4">
          <Shield className="h-3 w-3" />
          Secured by CorpoPay
        </div>
      </div>
    </>
  );
}
