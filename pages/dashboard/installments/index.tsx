/**
 * Dashboard — Installment Agreements
 *
 * Lists all BNPL installment agreements for the tenant with per-charge
 * breakdown and the ability to cancel active agreements.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "@/lib/use-toast";
import { client } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { formatAmount } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type InstallmentCharge = components["schemas"]["InstallmentCharge"];
type InstallmentAgreement = components["schemas"]["InstallmentAgreementListItem"];

interface AgreementsResponse {
  data: InstallmentAgreement[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHARGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CHARGED: CheckCircle,
  DECLINED: XCircle,
  ERROR: AlertTriangle,
  PENDING: Clock,
};

const CHARGE_COLORS: Record<string, string> = {
  CHARGED: "text-green-600",
  DECLINED: "text-red-600",
  ERROR: "text-orange-500",
  PENDING: "text-muted-foreground",
};

// ─── Row component ────────────────────────────────────────────────────────────

function AgreementRow({ agreement }: { agreement: InstallmentAgreement }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [charges, setCharges] = useState<InstallmentCharge[] | null>(null);
  const [loadingCharges, setLoadingCharges] = useState(false);

  async function toggleExpand() {
    if (!expanded && !charges) {
      setLoadingCharges(true);
      try {
        const { data, error } = await client.GET("/installment-agreements/{id}", {
          params: { path: { id: agreement.id } },
        });
        if (error) throw error;
        setCharges(data?.installmentCharges ?? []);
      } catch {
        setCharges([]);
      } finally {
        setLoadingCharges(false);
      }
    }
    setExpanded((v) => !v);
  }

  const cancelMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/installment-agreements/{id}/cancel", {
        params: { path: { id: agreement.id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-agreements"] });
      toast.success("Agreement cancelled");
    },
    onError: () => toast.error("Failed to cancel agreement"),
  });

  const progress =
    agreement.totalInstallments > 0
      ? Math.round((agreement.paidCount / agreement.totalInstallments) * 100)
      : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-0">
        {/* Summary row */}
        <div className="flex items-start gap-3 pb-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={agreement.status} />
              {agreement.plan && (
                <span className="text-xs text-muted-foreground">{agreement.plan.name}</span>
              )}
            </div>
            <p className="text-sm font-semibold">
              {formatAmount(agreement.principalAmount, agreement.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {agreement.paidCount} / {agreement.totalInstallments} installments ·{" "}
              {formatAmount(agreement.installmentAmount, agreement.currency)}/mo
            </p>
            {/* Progress */}
            <Progress
              value={progress}
              variant={agreement.status === "DEFAULTED" ? "error" : "success"}
              className="max-w-[200px]"
            />
            <p className="text-[10px] text-muted-foreground font-mono">{agreement.id}</p>
            {agreement.nextChargeDate && (
              <p className="text-[10px] text-muted-foreground">
                Next charge: {new Date(agreement.nextChargeDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {agreement.status === "ACTIVE" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive px-2"
                disabled={cancelMut.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelMut.mutate();
                }}
              >
                {cancelMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel"}
              </Button>
            )}
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
            >
              {loadingCharges ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Charges breakdown */}
        {expanded && charges && (
          <div className="border-t py-3 space-y-2">
            {charges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">No charge records yet.</p>
            ) : (
              charges.map((c) => {
                const Icon = CHARGE_ICONS[c.status] ?? Clock;
                const color = CHARGE_COLORS[c.status] ?? "text-muted-foreground";
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">
                          #{c.installmentNumber}
                          {c.attemptNumber > 1 && (
                            <span className="text-muted-foreground ml-1">
                              (attempt {c.attemptNumber})
                            </span>
                          )}
                        </span>
                        <span className={`font-semibold ${color}`}>{c.status}</span>
                      </div>
                      {c.errorMessage && (
                        <p className="text-[10px] text-destructive truncate">{c.errorMessage}</p>
                      )}
                      {c.processedAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(c.processedAt).toLocaleString()} · {Number(c.amount).toFixed(2)}{" "}
                          {c.currency}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstallmentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery<AgreementsResponse>({
    queryKey: ["installment-agreements", statusFilter],
    queryFn: async () => {
      const { data, error } = await client.GET("/installment-agreements", {
        params: { query: statusFilter ? { status: statusFilter } : {} },
      });
      if (error) throw error;
      return data ?? { data: [], total: 0, page: 1, limit: 20 };
    },
  });

  const agreements = data?.data ?? [];

  const STATUSES = ["", "ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED", "PENDING_CHECKOUT"];

  return (
    <DashboardLayout title="Installments">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">Installment Agreements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage BNPL installment agreements across all customers.
          </p>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s || "ALL"}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : agreements.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No installment agreements"
            description={
              statusFilter
                ? `No ${statusFilter.replace("_", " ").toLowerCase()} agreements found.`
                : "No BNPL agreements yet."
            }
          />
        ) : (
          <div className="space-y-3">
            {agreements.map((agr) => (
              <AgreementRow key={agr.id} agreement={agr} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
