/**
 * Simulation Modal — two modes:
 *
 * [Direct Charge]  Smoke-test VPS end-to-end without SPP.
 *   prepare → open PayWall (inline iframe) → poll intent status → done
 *
 * [BNPL]  4-phase installment simulation (requires SPP enabled on merchant).
 *   checkout → configure → running → done
 *
 * The VPS PayWall is rendered inside a full-screen iframe overlay on the
 * same page — no new tab, no popup.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  PlayCircle,
  RefreshCw,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { client } from "@/lib/client";

// --- Types -------------------------------------------------------------------

interface PrepareResult {
  linkId: string;
  agreementId: string;
  paywallUrl: string;
  paywallPayload: string;
  paywallSignature: string;
  preview: {
    totalInstallments: number;
    installmentAmount: number;
    principalAmount: number;
    apr: number;
    currency: string;
  };
}

interface InstallmentPlan {
  id: string;
  durationMonths: number;
  annualInterestRate: number;
  minAmount: number | null;
  maxAmount: number | null;
}

interface AwaitResult {
  found: boolean;
  agreementId?: string;
  status?: string;
  totalInstallments?: number;
  paidCount?: number;
  installmentAmount?: number;
  currency?: string;
  /** Present when VPS requires 3DS before the agreement can be activated */
  paymentServiceUrl?: string | null;
}

interface InstallmentCharge {
  id: string;
  installmentNumber: number;
  amount: number | string;
  currency: string;
  status: string;
  attemptNumber: number;
  processedAt?: string | null;
  errorMessage?: string | null;
}

interface StatusResult {
  agreementId: string;
  agreement: {
    status: string;
    totalInstallments: number;
    paidCount: number;
    principalAmount: number;
    installmentAmount: number;
    currency: string;
  };
  installmentCharges: InstallmentCharge[];
  done: boolean;
}

interface SimulationModalProps {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
}

// --- Helpers -----------------------------------------------------------------

type SimMode = "direct" | "preauth" | "bnpl";
type Phase = "checkout" | "configure" | "running" | "done";
type DirectPhase = "idle" | "ready" | "polling" | "done";
type PreauthPhase = "idle" | "ready" | "polling" | "authorized" | "done";

interface DirectPrepareResult {
  intentId: string;
  linkId: string;
  paywallUrl: string;
  paywallPayload: string;
  paywallSignature: string;
  amount: number;
}

interface DirectStatusResult {
  intentId: string;
  status: string;
  providerRef: string | null;
  terminal: boolean;
  /** Present when VPS requires 3DS — load this URL in the inline iframe */
  paymentServiceUrl?: string | null;
  settleError?: string;
}

interface PreauthStatusResult {
  intentId: string;
  status: string;
  providerRef: string | null;
  terminal: boolean;
  /** true when VPS has AUTHORISED (funds held) but not yet settled */
  authorized: boolean;
  paymentServiceUrl?: string | null;
  queryError?: string;
}

const CHARGE_STATUS_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  CHARGED: { icon: CheckCircle, color: "text-green-600" },
  DECLINED: { icon: XCircle, color: "text-red-600" },
  ERROR: { icon: AlertTriangle, color: "text-orange-500" },
  PENDING: { icon: Clock, color: "text-muted-foreground" },
};

const AGR_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  DEFAULTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-700",
  PENDING_CHECKOUT: "bg-yellow-100 text-yellow-800",
};

const PHASES: Phase[] = ["checkout", "configure", "running", "done"];

function fmtAmt(n: number, cur: string) {
  return `${n.toFixed(2)} ${cur}`;
}

function computeInstallmentPreview(principal: number, aprPct: number, n: number) {
  if (n <= 0 || principal <= 0) return { monthly: 0, total: 0, interest: 0 };
  let monthly: number;
  if (aprPct === 0) {
    monthly = Math.round((principal / n) * 100) / 100;
  } else {
    const r = aprPct / 100 / 12;
    const factor = (1 + r) ** n;
    monthly = Math.ceil(((principal * (r * factor)) / (factor - 1)) * 100) / 100;
  }
  const total = Math.round(monthly * n * 100) / 100;
  const interest = Math.round((total - principal) * 100) / 100;
  return { monthly, total, interest };
}

// --- Component ---------------------------------------------------------------

export default function SimulationModal({ tenantId, tenantName, onClose }: SimulationModalProps) {
  const qc = useQueryClient();

  const [mode, setMode] = useState<SimMode>("direct");

  // ── Direct charge state ──────────────────────────────────────────────────
  const [directPhase, setDirectPhase] = useState<DirectPhase>("idle");
  const [directData, setDirectData] = useState<DirectPrepareResult | null>(null);
  const [directAmount, setDirectAmount] = useState("1.00");
  const [directPaywallOpen, setDirectPaywallOpen] = useState(false);
  const directFormRef = useRef<HTMLFormElement>(null);

  // ── Pre-Auth state ────────────────────────────────────────────────────────
  const [preauthPhase, setPreauthPhase] = useState<PreauthPhase>("idle");
  const [preauthData, setPreauthData] = useState<DirectPrepareResult | null>(null);
  const [preauthAmount, setPreauthAmount] = useState("1.00");
  const [preauthPaywallOpen, setPreauthPaywallOpen] = useState(false);
  const preauthFormRef = useRef<HTMLFormElement>(null);

  // ── BNPL state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("checkout");
  const [prepareData, setPrepareData] = useState<PrepareResult | null>(null);
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AwaitResult | null>(null);
  const [bnplPaywallOpen, setBnplPaywallOpen] = useState(false);
  const bnplFormRef = useRef<HTMLFormElement>(null);

  const [bnplAmount, setBnplAmount] = useState("1000.00");
  const [bnplMonths, setBnplMonths] = useState(3);

  const plansQuery = useQuery<{ data: InstallmentPlan[] }>({
    queryKey: ["sim-plans", tenantId],
    queryFn: async () => {
      const { data, error } = await client.GET("/admin/simulation/bnpl/plans/{tenantId}", {
        params: { path: { tenantId } },
      });
      if (error) throw error;
      return data ?? { data: [] };
    },
  });
  const simPlans = plansQuery.data?.data ?? [];
  const plansLoaded = !!plansQuery.data;
  const missingPlans = plansLoaded && simPlans.length === 0;
  const aprForMonths = (m: number): number | null =>
    simPlans.find((p) => p.durationMonths === m)?.annualInterestRate ?? null;

  const [chargeDelay, setChargeDelay] = useState("30");
  const [retryDelay1, setRetryDelay1] = useState("15");
  const [retryDelay2, setRetryDelay2] = useState("30");
  const [retryDelay3, setRetryDelay3] = useState("60");

  // Phase 1 - prepare
  const prepareMut = useMutation({
    mutationFn: async (): Promise<PrepareResult> => {
      const { data, error } = await client.POST("/admin/simulation/bnpl/prepare", {
        body: {
          tenantId,
          amount: parseFloat(bnplAmount) || 1000,
          months: bnplMonths,
          apr: aprForMonths(bnplMonths) ?? 0,
        },
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (data) => setPrepareData(data),
  });

  function openPaywall() {
    if (!prepareData) return;
    setBnplPaywallOpen(true);
    // submit the hidden form into the named iframe on next tick
    setTimeout(() => bnplFormRef.current?.submit(), 50);
  }

  // Phase 1 - await agreement
  const awaitQuery = useQuery<AwaitResult>({
    queryKey: ["bnpl-await", prepareData?.linkId],
    queryFn: async () => {
      const { data, error } = await client.GET("/admin/simulation/bnpl/await-agreement/{linkId}", {
        params: { path: { linkId: prepareData?.linkId ?? "" } },
      });
      if (error) throw error;
      return data ?? { found: false };
    },
    enabled: !!prepareData && phase === "checkout",
    refetchInterval: (d) => (d.state.data?.found ? false : 3_000),
    retry: false,
  });

  useEffect(() => {
    const d = awaitQuery.data;
    if (!d) return;

    if (d.found && d.agreementId) {
      setAgreementId(d.agreementId);
      setPreview(d);
      setBnplPaywallOpen(false);
      setPhase("configure");
      return;
    }

    // VPS signalled 3DS redirect — load the paymentServiceUrl in the BNPL iframe
    if (d.paymentServiceUrl && phase === "checkout") {
      setBnplPaywallOpen(true);
      const nav = document.createElement("form");
      nav.method = "GET";
      nav.action = d.paymentServiceUrl;
      nav.target = "bnpl-paywall-frame";
      document.body.appendChild(nav);
      nav.submit();
      document.body.removeChild(nav);
    }
  }, [awaitQuery.data]);

  // Phase 2 - fire
  const fireMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/admin/simulation/bnpl/fire", {
        body: {
          agreementId: agreementId ?? "",
          chargeDelay: parseInt(chargeDelay, 10) || 30,
          retryDelay1: parseInt(retryDelay1, 10) || 15,
          retryDelay2: parseInt(retryDelay2, 10) || 30,
          retryDelay3: parseInt(retryDelay3, 10) || 60,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => setPhase("running"),
  });

  // Phase 3 - poll status
  const statusQuery = useQuery<StatusResult>({
    queryKey: ["bnpl-status", agreementId],
    queryFn: async () => {
      const { data, error } = await client.GET("/admin/simulation/bnpl/status/{agreementId}", {
        params: { path: { agreementId: agreementId ?? "" } },
      });
      if (error || !data) throw error;
      return data;
    },
    enabled: phase === "running" && !!agreementId,
    refetchInterval: (d) => (d.state.data?.done ? false : 2_000),
  });

  useEffect(() => {
    if (statusQuery.data?.done) setPhase("done");
  }, [statusQuery.data?.done]);

  // Phase 4 - cleanup
  const cleanupMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.DELETE("/admin/simulation/bnpl/cleanup/{agreementId}", {
        params: { path: { agreementId: agreementId ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["bnpl-status", agreementId] });
      qc.removeQueries({ queryKey: ["bnpl-await", prepareData?.linkId] });
      onClose();
    },
  });

  // ── Direct charge mutations / queries ────────────────────────────────────
  const directPrepareMut = useMutation({
    mutationFn: async (): Promise<DirectPrepareResult> => {
      const { data, error } = await client.POST("/admin/simulation/direct/prepare", {
        body: {
          tenantId,
          amount: parseFloat(directAmount) || 1.0,
        },
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (data) => {
      setDirectData(data);
      setDirectPhase("ready");
    },
  });

  function openDirectPaywall() {
    if (!directData) return;
    setDirectPaywallOpen(true);
    setDirectPhase("polling");
    setTimeout(() => directFormRef.current?.submit(), 50);
  }

  const directStatusQuery = useQuery<DirectStatusResult>({
    queryKey: ["direct-status", directData?.intentId],
    queryFn: async () => {
      const { data, error } = await client.GET("/admin/simulation/direct/status/{intentId}", {
        params: { path: { intentId: directData?.intentId ?? "" } },
      });
      if (error || !data) throw error;
      return data;
    },
    enabled: directPhase === "polling" && !!directData?.intentId,
    refetchInterval: (d) => (d.state.data?.terminal ? false : 2_000),
  });

  useEffect(() => {
    const d = directStatusQuery.data;
    if (!d) return;

    if (d.terminal) {
      setDirectPhase("done");
      setDirectPaywallOpen(false);
      return;
    }

    // VPS signalled a 3DS redirect — load the paymentServiceUrl in the iframe.
    // We do this by pointing the hidden form's action at the new URL and
    // submitting it (GET) into the named iframe.
    if (d.paymentServiceUrl && directPhase === "polling") {
      setDirectPaywallOpen(true);
      // Navigate the iframe directly via a temporary form GET
      const nav = document.createElement("form");
      nav.method = "GET";
      nav.action = d.paymentServiceUrl;
      nav.target = "direct-paywall-frame";
      document.body.appendChild(nav);
      nav.submit();
      document.body.removeChild(nav);
    }
  }, [directStatusQuery.data]);

  const directCleanupMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.DELETE("/admin/simulation/direct/cleanup/{intentId}", {
        params: { path: { intentId: directData?.intentId ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["direct-status", directData?.intentId] });
      onClose();
    },
  });

  function resetDirect() {
    qc.removeQueries({ queryKey: ["direct-status", directData?.intentId] });
    setDirectData(null);
    setDirectPhase("idle");
    setDirectPaywallOpen(false);
  }

  // ── Pre-Auth mutations / queries ─────────────────────────────────────────
  const preauthPrepareMut = useMutation({
    mutationFn: async (): Promise<DirectPrepareResult> => {
      const { data, error } = await client.POST("/admin/simulation/preauth/prepare", {
        body: {
          tenantId,
          amount: parseFloat(preauthAmount) || 1.0,
        },
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPreauthData(data);
      setPreauthPhase("ready");
    },
  });

  function openPreauthPaywall() {
    if (!preauthData) return;
    setPreauthPaywallOpen(true);
    setPreauthPhase("polling");
    setTimeout(() => preauthFormRef.current?.submit(), 50);
  }

  const preauthStatusQuery = useQuery<PreauthStatusResult>({
    queryKey: ["preauth-status", preauthData?.intentId],
    queryFn: async () => {
      const { data, error } = await client.GET("/admin/simulation/preauth/status/{intentId}", {
        params: { path: { intentId: preauthData?.intentId ?? "" } },
      });
      if (error || !data) throw error;
      return data;
    },
    enabled: preauthPhase === "polling" && !!preauthData?.intentId,
    refetchInterval: (d) => {
      const data = d.state.data;
      if (!data) return 2_000;
      if (data.terminal || data.authorized) return false;
      return 2_000;
    },
  });

  useEffect(() => {
    const d = preauthStatusQuery.data;
    if (!d) return;

    if (d.authorized) {
      setPreauthPhase("authorized");
      setPreauthPaywallOpen(false);
      return;
    }

    if (d.terminal) {
      setPreauthPhase("done");
      setPreauthPaywallOpen(false);
      return;
    }

    if (d.paymentServiceUrl && preauthPhase === "polling") {
      setPreauthPaywallOpen(true);
      const nav = document.createElement("form");
      nav.method = "GET";
      nav.action = d.paymentServiceUrl;
      nav.target = "preauth-paywall-frame";
      document.body.appendChild(nav);
      nav.submit();
      document.body.removeChild(nav);
    }
  }, [preauthStatusQuery.data]);

  const preauthCaptureMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/admin/simulation/preauth/capture/{intentId}", {
        params: { path: { intentId: preauthData?.intentId ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => setPreauthPhase("done"),
  });

  const preauthCancelMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/admin/simulation/preauth/cancel/{intentId}", {
        params: { path: { intentId: preauthData?.intentId ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => setPreauthPhase("done"),
  });

  const preauthCleanupMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.DELETE("/admin/simulation/preauth/cleanup/{intentId}", {
        params: { path: { intentId: preauthData?.intentId ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["preauth-status", preauthData?.intentId] });
      onClose();
    },
  });

  function resetPreauth() {
    qc.removeQueries({ queryKey: ["preauth-status", preauthData?.intentId] });
    setPreauthData(null);
    setPreauthPhase("idle");
    setPreauthPaywallOpen(false);
  }

  const pStatus = preauthStatusQuery.data;

  const agr = statusQuery.data?.agreement;
  const charges = statusQuery.data?.installmentCharges ?? [];
  const dStatus = directStatusQuery.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* ── Hidden forms that POST into the named iframes ─────────────────── */}
      {directData && (
        <form
          ref={directFormRef}
          method="POST"
          action={directData.paywallUrl}
          target="direct-paywall-frame"
          className="hidden"
        >
          <input type="hidden" name="payload" value={directData.paywallPayload} />
          <input type="hidden" name="signature" value={directData.paywallSignature} />
        </form>
      )}
      {preauthData && (
        <form
          ref={preauthFormRef}
          method="POST"
          action={preauthData.paywallUrl}
          target="preauth-paywall-frame"
          className="hidden"
        >
          <input type="hidden" name="payload" value={preauthData.paywallPayload} />
          <input type="hidden" name="signature" value={preauthData.paywallSignature} />
        </form>
      )}
      {prepareData && (
        <form
          ref={bnplFormRef}
          method="POST"
          action={prepareData.paywallUrl}
          target="bnpl-paywall-frame"
          className="hidden"
        >
          <input type="hidden" name="payload" value={prepareData.paywallPayload} />
          <input type="hidden" name="signature" value={prepareData.paywallSignature} />
        </form>
      )}

      {/* ── PayWall iframe overlay (Direct) ───────────────────────────────── */}
      {directPaywallOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/40 shrink-0">
            <button
              type="button"
              onClick={() => setDirectPaywallOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Simulation
            </button>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs font-medium">VPS Sandbox PayWall — Direct Charge</span>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw
                className={`h-3 w-3 ${directStatusQuery.isFetching ? "animate-spin" : ""}`}
              />
              {directPhase === "polling"
                ? dStatus?.paymentServiceUrl
                  ? "Waiting for 3DS completion..."
                  : "Waiting for payment..."
                : "Polling paused"}
            </div>
          </div>
          <iframe
            name="direct-paywall-frame"
            className="flex-1 w-full border-0"
            title="VPS PayWall — Direct Charge"
          />
        </div>
      )}

      {/* ── PayWall iframe overlay (Pre-Auth) ──────────────────────────────── */}
      {preauthPaywallOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/40 shrink-0">
            <button
              type="button"
              onClick={() => setPreauthPaywallOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Simulation
            </button>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs font-medium">VPS Sandbox PayWall — Pre-Auth (AUTHORIZE)</span>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw
                className={`h-3 w-3 ${preauthStatusQuery.isFetching ? "animate-spin" : ""}`}
              />
              {preauthPhase === "polling"
                ? pStatus?.paymentServiceUrl
                  ? "Waiting for 3DS completion..."
                  : "Waiting for authorization..."
                : "Polling paused"}
            </div>
          </div>
          <iframe
            name="preauth-paywall-frame"
            className="flex-1 w-full border-0"
            title="VPS PayWall — Pre-Auth"
          />
        </div>
      )}

      {/* ── PayWall iframe overlay (BNPL) ─────────────────────────────────── */}
      {bnplPaywallOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/40 shrink-0">
            <button
              type="button"
              onClick={() => setBnplPaywallOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Simulation
            </button>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs font-medium">VPS Sandbox PayWall — BNPL Checkout</span>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className={`h-3 w-3 ${awaitQuery.isFetching ? "animate-spin" : ""}`} />
              {awaitQuery.isFetching ? "Waiting for checkout completion..." : "Polling paused"}
            </div>
          </div>
          <iframe
            name="bnpl-paywall-frame"
            className="flex-1 w-full border-0"
            title="VPS PayWall — BNPL Checkout"
          />
        </div>
      )}

      <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <h2 className="text-sm font-bold leading-none">VPS Simulation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{tenantName}</p>
            </div>
          </div>
          {/* Mode tabs */}
          <div className="flex rounded-lg border overflow-hidden text-xs mr-4">
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors ${
                mode === "direct" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <CreditCard className="h-3 w-3" />
              Direct
            </button>
            <button
              type="button"
              onClick={() => setMode("preauth")}
              className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors ${
                mode === "preauth" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Clock className="h-3 w-3" />
              Pre-Auth
            </button>
            <button
              type="button"
              onClick={() => setMode("bnpl")}
              className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors ${
                mode === "bnpl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Zap className="h-3 w-3" />
              BNPL
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── PRE-AUTH MODE ───────────────────────────────────────────── */}
          {mode === "preauth" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">
                  Two-Step Payment — AUTHORIZE then SETTLE or AUTH_REVERSAL
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  Reserves/holds funds on the card without capturing. You then manually choose to{" "}
                  <strong>Capture</strong> (SETTLE) or <strong>Release</strong> (AUTH_REVERSAL).
                </p>
              </div>

              {preauthPrepareMut.isError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {(preauthPrepareMut.error as any)?.response?.data?.error ??
                    "Failed to prepare session"}
                </p>
              )}
              {preauthCaptureMut.isError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Capture failed:{" "}
                  {(preauthCaptureMut.error as any)?.response?.data?.error ?? "Unknown error"}
                </p>
              )}
              {preauthCancelMut.isError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Release failed:{" "}
                  {(preauthCancelMut.error as any)?.response?.data?.error ?? "Unknown error"}
                </p>
              )}

              {preauthPhase === "idle" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="preauth-amount" className="text-xs">
                      Amount to hold (MAD)
                    </Label>
                    <Input
                      id="preauth-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={preauthAmount}
                      onChange={(e) => setPreauthAmount(e.target.value)}
                      className="h-8 text-sm w-32"
                    />
                  </div>
                </div>
              )}

              {(preauthPhase === "ready" || preauthPhase === "polling") && preauthData && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs space-y-1">
                    <p className="font-semibold text-sm">Authorization Session Created</p>
                    <p className="text-muted-foreground">
                      Hold amount: {preauthData.amount.toFixed(2)} MAD
                    </p>
                    <p className="text-muted-foreground font-mono text-[10px] break-all">
                      intent: {preauthData.intentId}
                    </p>
                  </div>

                  {preauthPhase === "ready" && (
                    <button
                      type="button"
                      onClick={openPreauthPaywall}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-3 font-medium text-sm text-primary"
                    >
                      <CreditCard className="h-4 w-4" />
                      Open PayWall (AUTHORIZE)
                    </button>
                  )}

                  {preauthPhase === "polling" && (
                    <div className="space-y-2">
                      {pStatus?.paymentServiceUrl && (
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1.5">
                          <p className="font-semibold">3DS verification required</p>
                          <p>Complete the challenge in the paywall to finish the authorization.</p>
                          <button
                            type="button"
                            onClick={() => setPreauthPaywallOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-amber-900 underline underline-offset-2"
                          >
                            <ArrowLeft className="h-3 w-3 rotate-180" />
                            Re-open 3DS challenge
                          </button>
                        </div>
                      )}
                      {!pStatus?.paymentServiceUrl && (
                        <button
                          type="button"
                          onClick={() => setPreauthPaywallOpen(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 hover:bg-muted/40 transition-colors p-2.5 text-xs text-muted-foreground"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Re-open PayWall
                        </button>
                      )}
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw
                          className={`h-3 w-3 ${preauthStatusQuery.isFetching ? "animate-spin" : ""}`}
                        />
                        {pStatus?.paymentServiceUrl
                          ? "Waiting for 3DS completion..."
                          : "Waiting for authorization..."}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {preauthPhase === "authorized" && preauthData && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <p className="font-bold text-sm text-amber-800 dark:text-amber-300">
                        Funds Held — Awaiting Your Decision
                      </p>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      VPS has <strong>AUTHORISED</strong> the card. {preauthData.amount.toFixed(2)}{" "}
                      MAD is reserved but not yet captured. Choose what to do next:
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground break-all">
                      providerRef: {pStatus?.providerRef}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={preauthCaptureMut.isPending || preauthCancelMut.isPending}
                      onClick={() => preauthCaptureMut.mutate()}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-green-500 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:bg-green-950/20 p-4 transition-colors disabled:opacity-50"
                    >
                      {preauthCaptureMut.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      <span className="text-xs font-bold text-green-800 dark:text-green-300">
                        Capture
                      </span>
                      <span className="text-[10px] text-green-700 dark:text-green-400">
                        SETTLE — charge the card
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={preauthCaptureMut.isPending || preauthCancelMut.isPending}
                      onClick={() => preauthCancelMut.mutate()}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-red-400 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:bg-red-950/20 p-4 transition-colors disabled:opacity-50"
                    >
                      {preauthCancelMut.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-red-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-xs font-bold text-red-700 dark:text-red-300">
                        Release
                      </span>
                      <span className="text-[10px] text-red-600 dark:text-red-400">
                        AUTH_REVERSAL — free the hold
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {preauthPhase === "done" &&
                preauthStatusQuery.data &&
                (() => {
                  const finalStatus = preauthCaptureMut.isSuccess
                    ? "SUCCEEDED"
                    : preauthCancelMut.isSuccess
                      ? "CANCELED"
                      : preauthStatusQuery.data.status;
                  const captured = finalStatus === "SUCCEEDED";
                  return (
                    <div
                      className={`rounded-lg border px-4 py-4 text-sm space-y-2 ${
                        captured ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {captured ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-500" />
                        )}
                        <p className={`font-bold ${captured ? "text-green-800" : "text-gray-700"}`}>
                          {captured ? "Payment Captured" : "Authorization Released"}
                        </p>
                      </div>
                      {captured && (
                        <p className="text-xs text-green-700">
                          SETTLE sent — funds captured successfully. Pre-Auth → SETTLE flow
                          confirmed.
                          {preauthStatusQuery.data.providerRef && (
                            <span className="block font-mono text-[10px] mt-0.5">
                              providerRef: {preauthStatusQuery.data.providerRef}
                            </span>
                          )}
                        </p>
                      )}
                      {!captured && (
                        <p className="text-xs text-gray-600">
                          AUTH_REVERSAL sent — hold released, card not charged.
                          {preauthStatusQuery.data.providerRef && (
                            <span className="block font-mono text-[10px] mt-0.5">
                              providerRef: {preauthStatusQuery.data.providerRef}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}

          {/* ── DIRECT CHARGE MODE ─────────────────────────────────────── */}
          {mode === "direct" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-semibold">VPS Smoke Test — No SPP required</p>
                <p className="text-blue-700 dark:text-blue-400">
                  Creates a plain direct charge. Confirms VPS PayWall → webhook → DB works
                  end-to-end without stored payment profiles.
                </p>
              </div>

              {directPrepareMut.isError && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {(directPrepareMut.error as any)?.response?.data?.error ??
                    "Failed to prepare session"}
                </p>
              )}

              {directPhase === "idle" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="direct-amount" className="text-xs">
                      Charge amount (MAD)
                    </Label>
                    <Input
                      id="direct-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={directAmount}
                      onChange={(e) => setDirectAmount(e.target.value)}
                      className="h-8 text-sm w-32"
                    />
                  </div>
                </div>
              )}

              {(directPhase === "ready" || directPhase === "polling") && directData && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs space-y-1">
                    <p className="font-semibold text-sm">Session Created</p>
                    <p className="text-muted-foreground">
                      Amount: {directData.amount.toFixed(2)} MAD
                    </p>
                    <p className="text-muted-foreground font-mono text-[10px] break-all">
                      intent: {directData.intentId}
                    </p>
                  </div>

                  {directPhase === "ready" && (
                    <button
                      type="button"
                      onClick={openDirectPaywall}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-3 font-medium text-sm text-primary"
                    >
                      <CreditCard className="h-4 w-4" />
                      Open PayWall
                    </button>
                  )}

                  {directPhase === "polling" && (
                    <div className="space-y-2">
                      {dStatus?.paymentServiceUrl && (
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1.5">
                          <p className="font-semibold">3DS verification required</p>
                          <p>Complete the challenge in the paywall to finish the charge.</p>
                          <button
                            type="button"
                            onClick={() => setDirectPaywallOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-amber-900 underline underline-offset-2"
                          >
                            <ArrowLeft className="h-3 w-3 rotate-180" />
                            Re-open 3DS challenge
                          </button>
                        </div>
                      )}
                      {!dStatus?.paymentServiceUrl && (
                        <button
                          type="button"
                          onClick={() => setDirectPaywallOpen(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 hover:bg-muted/40 transition-colors p-2.5 text-xs text-muted-foreground"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Re-open PayWall
                        </button>
                      )}
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw
                          className={`h-3 w-3 ${directStatusQuery.isFetching ? "animate-spin" : ""}`}
                        />
                        {dStatus?.paymentServiceUrl
                          ? "Waiting for 3DS completion..."
                          : "Waiting for payment..."}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {directPhase === "done" && dStatus && (
                <div
                  className={`rounded-lg border px-4 py-4 text-sm space-y-2 ${
                    dStatus.status === "SUCCEEDED"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {dStatus.status === "SUCCEEDED" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <p
                      className={`font-bold ${dStatus.status === "SUCCEEDED" ? "text-green-800" : "text-red-800"}`}
                    >
                      {dStatus.status === "SUCCEEDED"
                        ? "Charge Succeeded"
                        : `Charge ${dStatus.status}`}
                    </p>
                  </div>
                  {dStatus.status === "SUCCEEDED" && (
                    <p className="text-xs text-green-700">
                      VPS → webhook → DB pipeline is working correctly.
                      {dStatus.providerRef && (
                        <span className="block font-mono text-[10px] mt-0.5">
                          providerRef: {dStatus.providerRef}
                        </span>
                      )}
                    </p>
                  )}
                  {dStatus.status !== "SUCCEEDED" && (
                    <p className="text-xs text-red-700">
                      Webhook received but charge did not succeed. Check VPS sandbox logs. Status:{" "}
                      <strong>{dStatus.status}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── BNPL MODE ───────────────────────────────────────────────── */}
          {mode === "bnpl" && (
            <>
              {/* PHASE: checkout */}
              {phase === "checkout" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uses a <strong>real VPS sandbox PayWall</strong>. A signed PayWall is launched
                    for the first installment. The stored payment profile is captured automatically
                    on callback.
                  </p>

                  {prepareMut.isError && (
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {(prepareMut.error as any)?.response?.data?.error ??
                        "Failed to prepare session"}
                    </p>
                  )}

                  {!prepareData && (
                    <div className="space-y-3">
                      {/* Amount */}
                      <div className="space-y-1">
                        <Label htmlFor="bnpl-amount" className="text-xs">
                          Loan amount (MAD)
                        </Label>
                        <Input
                          id="bnpl-amount"
                          type="number"
                          min="1"
                          step="1"
                          value={bnplAmount}
                          onChange={(e) => setBnplAmount(e.target.value)}
                          className="h-8 text-sm w-40"
                        />
                      </div>

                      {/* Duration selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Duration</Label>
                        {plansQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading plans...
                          </div>
                        ) : missingPlans ? (
                          <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 space-y-1">
                            <p className="font-semibold">No installment plans configured</p>
                            <p>
                              This tenant has no active installment plans. Create 3, 6, or 12-month
                              plans before running a BNPL simulation.
                            </p>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {[3, 6, 12].map((m) => {
                              const apr = aprForMonths(m);
                              const hasPlan = apr !== null;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  disabled={!hasPlan}
                                  onClick={() => hasPlan && setBnplMonths(m)}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-center transition-colors ${
                                    !hasPlan
                                      ? "opacity-40 cursor-not-allowed border-dashed"
                                      : bnplMonths === m
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "hover:bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <span className="block text-sm font-bold">{m} mo</span>
                                  <span className="block text-[10px] mt-0.5">
                                    {hasPlan ? `${apr}% APR` : "no plan"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Live preview */}
                      {(() => {
                        const principal = parseFloat(bnplAmount) || 0;
                        const apr = aprForMonths(bnplMonths) ?? 0;
                        const { monthly, total, interest } = computeInstallmentPreview(
                          principal,
                          apr,
                          bnplMonths,
                        );
                        if (!principal) return null;
                        return (
                          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs space-y-1.5">
                            <p className="font-semibold text-sm">Preview</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                              <span>Monthly payment</span>
                              <span className="font-mono text-foreground font-medium">
                                {monthly.toFixed(2)} MAD
                              </span>
                              <span>Total repayable</span>
                              <span className="font-mono text-foreground font-medium">
                                {total.toFixed(2)} MAD
                              </span>
                              {interest > 0 && (
                                <>
                                  <span>Total interest</span>
                                  <span className="font-mono text-orange-600 font-medium">
                                    +{interest.toFixed(2)} MAD
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {prepareData && (
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs space-y-1">
                        <p className="font-semibold text-sm">Sandbox Session Created</p>
                        <p className="text-muted-foreground">
                          {prepareData.preview.totalInstallments} ×{" "}
                          {Number(prepareData.preview.installmentAmount).toFixed(2)}{" "}
                          {prepareData.preview.currency}
                          {prepareData.preview.apr > 0 && ` (${prepareData.preview.apr}% APR)`} ={" "}
                          {(
                            prepareData.preview.totalInstallments *
                            prepareData.preview.installmentAmount
                          ).toFixed(2)}{" "}
                          {prepareData.preview.currency}
                        </p>
                        <p className="text-muted-foreground font-mono text-[10px] break-all">
                          link: {prepareData.linkId}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={openPaywall}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-3 font-medium text-sm text-primary"
                      >
                        <Zap className="h-4 w-4" />
                        Open PayWall
                      </button>

                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw
                          className={`h-3 w-3 ${awaitQuery.isFetching ? "animate-spin" : ""}`}
                        />
                        {awaitQuery.isFetching
                          ? awaitQuery.data?.paymentServiceUrl
                            ? "Waiting for 3DS completion..."
                            : "Waiting for checkout completion..."
                          : "Polling paused"}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE: configure */}
              {phase === "configure" && preview && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 px-4 py-3 space-y-0.5 text-xs">
                    <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                      Checkout completed
                    </p>
                    <p className="text-muted-foreground">
                      {preview.totalInstallments} x{" "}
                      {fmtAmt(preview.installmentAmount ?? 0, preview.currency ?? "MAD")}{" "}
                      installments
                    </p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                      {preview.agreementId}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Configure simulated timing (seconds):
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 space-y-1">
                      <Label htmlFor="charge-delay" className="text-xs">
                        Charge interval between installments (s)
                      </Label>
                      <Input
                        id="charge-delay"
                        type="number"
                        min="5"
                        max="3600"
                        value={chargeDelay}
                        onChange={(e) => setChargeDelay(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    {(
                      [
                        { id: "r1", label: "Retry 1 (s)", val: retryDelay1, set: setRetryDelay1 },
                        { id: "r2", label: "Retry 2 (s)", val: retryDelay2, set: setRetryDelay2 },
                        { id: "r3", label: "Retry 3 (s)", val: retryDelay3, set: setRetryDelay3 },
                      ] as const
                    ).map(({ id, label, val, set }) => (
                      <div key={id} className="space-y-1">
                        <Label htmlFor={`d-${id}`} className="text-xs">
                          {label}
                        </Label>
                        <Input
                          id={`d-${id}`}
                          type="number"
                          min="5"
                          max="3600"
                          value={val}
                          onChange={(e) => set(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  {fireMut.isError && (
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {(fireMut.error as any)?.response?.data?.error ?? "Failed to fire simulation"}
                    </p>
                  )}
                </div>
              )}

              {/* PHASES: running / done */}
              {(phase === "running" || phase === "done") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Installment Agreement</p>
                      {agr && (
                        <p className="text-[10px] text-muted-foreground">
                          Paid {agr.paidCount} / {agr.totalInstallments} -{" "}
                          {fmtAmt(agr.installmentAmount, agr.currency)} per installment
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {phase === "running" && !statusQuery.data?.done && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      {agr ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${AGR_STATUS_COLOR[agr.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {agr.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Starting...</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Timeline
                    </p>
                    {charges.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2 text-center">
                        Waiting for first charge...
                      </p>
                    ) : (
                      <div className="relative space-y-2 pl-5">
                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                        {charges.map((c) => {
                          const meta =
                            CHARGE_STATUS_META[c.status] ?? CHARGE_STATUS_META["PENDING"];
                          const Icon = meta.icon;
                          return (
                            <div key={c.id} className="relative flex items-start gap-2.5">
                              <div className="absolute -left-5 mt-0.5">
                                <Icon
                                  className={`h-3.5 w-3.5 ${meta.color} bg-background rounded-full`}
                                />
                              </div>
                              <div className="flex-1 min-w-0 rounded border px-3 py-2 bg-background shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium">
                                    Installment #{c.installmentNumber}
                                    {c.attemptNumber > 1 && (
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        (attempt {c.attemptNumber})
                                      </span>
                                    )}
                                  </span>
                                  <span className={`text-[10px] font-bold ${meta.color}`}>
                                    {c.status}
                                  </span>
                                </div>
                                {c.errorMessage && (
                                  <p className="text-[10px] text-red-600 mt-0.5 truncate">
                                    {c.errorMessage}
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {c.processedAt
                                    ? new Date(c.processedAt).toLocaleTimeString()
                                    : "Pending"}{" "}
                                  - {Number(c.amount).toFixed(2)} {c.currency}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t shrink-0 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8">
            {(mode === "direct" && directPhase === "done") || (mode === "bnpl" && phase === "done")
              ? "Close without clean-up"
              : "Cancel"}
          </Button>

          <div className="flex items-center gap-2">
            {/* ── Direct charge footer actions ── */}
            {mode === "direct" && directPhase === "idle" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={directPrepareMut.isPending}
                onClick={() => directPrepareMut.mutate()}
              >
                {directPrepareMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-1.5 h-3 w-3" />
                    Prepare Charge
                  </>
                )}
              </Button>
            )}
            {mode === "direct" && directPhase === "ready" && (
              <Button size="sm" className="h-8 text-xs" onClick={openDirectPaywall}>
                <CreditCard className="mr-1.5 h-3 w-3" />
                Open PayWall
              </Button>
            )}
            {mode === "direct" && directPhase === "polling" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setDirectPaywallOpen(true)}
              >
                <CreditCard className="mr-1.5 h-3 w-3" />
                Re-open PayWall
              </Button>
            )}
            {mode === "direct" && directPhase === "done" && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetDirect}>
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Run Again
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={directCleanupMut.isPending}
                  onClick={() => directCleanupMut.mutate()}
                >
                  {directCleanupMut.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-3 w-3" />
                      Clean Up DB
                    </>
                  )}
                </Button>
              </>
            )}

            {/* ── Pre-Auth footer actions ── */}
            {mode === "preauth" && preauthPhase === "idle" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={preauthPrepareMut.isPending}
                onClick={() => preauthPrepareMut.mutate()}
              >
                {preauthPrepareMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Clock className="mr-1.5 h-3 w-3" />
                    Prepare Pre-Auth
                  </>
                )}
              </Button>
            )}
            {mode === "preauth" && preauthPhase === "ready" && (
              <Button size="sm" className="h-8 text-xs" onClick={openPreauthPaywall}>
                <CreditCard className="mr-1.5 h-3 w-3" />
                Open PayWall
              </Button>
            )}
            {mode === "preauth" && preauthPhase === "polling" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setPreauthPaywallOpen(true)}
              >
                <CreditCard className="mr-1.5 h-3 w-3" />
                Re-open PayWall
              </Button>
            )}
            {mode === "preauth" && preauthPhase === "done" && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetPreauth}>
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Run Again
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={preauthCleanupMut.isPending}
                  onClick={() => preauthCleanupMut.mutate()}
                >
                  {preauthCleanupMut.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-3 w-3" />
                      Clean Up DB
                    </>
                  )}
                </Button>
              </>
            )}

            {/* ── BNPL footer actions ── */}
            {mode === "bnpl" && phase === "checkout" && !prepareData && (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={prepareMut.isPending || missingPlans || aprForMonths(bnplMonths) === null}
                onClick={() => prepareMut.mutate()}
              >
                {prepareMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-1.5 h-3 w-3" />
                    Prepare Sandbox Session
                  </>
                )}
              </Button>
            )}
            {mode === "bnpl" && phase === "checkout" && prepareData && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openPaywall}>
                <Zap className="mr-1.5 h-3 w-3" />
                Re-open PayWall
              </Button>
            )}
            {mode === "bnpl" && phase === "configure" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={fireMut.isPending}
                onClick={() => fireMut.mutate()}
              >
                {fireMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Firing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-1.5 h-3 w-3" />
                    Fire Simulation
                  </>
                )}
              </Button>
            )}
            {mode === "bnpl" && phase === "done" && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate()}
              >
                {cleanupMut.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Cleaning up...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    Clean Up DB
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
