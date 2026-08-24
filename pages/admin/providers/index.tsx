import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "@/lib/use-toast";
import { Badge } from "@/components/ui/badge";
import { client, getErrorMessage } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { ProviderHealthStatus } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  FlaskConical,
  CheckCircle,
  Users,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SimulationModal from "@/components/SimulationModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderHealth = components["schemas"]["ProviderHealthRecord"];
type VpsTenant = components["schemas"]["AdminVpsTenant"];

type HealthStatus = ProviderHealthStatus;

interface TenantRecurringResult {
  tenantId: string;
  tenantName: string;
  latencyMs: number;
  vpsError?: string;
  dbError?: string;
  checks: {
    connectivity: boolean;
    profileStorage: boolean;
    hasActiveSubscriptions: boolean;
    migrationApplied: boolean;
  };
  subscriptionStats: {
    active: number;
    pastDue: number;
    pending: number;
    cancelledLast30d: number;
    billingEventsTotal: number;
  };
  dueTodayCount: number;
}

interface RecurringTestResult {
  testedAt: string;
  overallStatus: string;
  totalVpsConfigs: number;
  tenants: TenantRecurringResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchHealth(): Promise<ProviderHealth[]> {
  const { data, error } = await client.GET("/admin/provider-health");
  if (error) throw error;
  return data ?? [];
}

async function fetchVpsTenants(): Promise<VpsTenant[]> {
  const { data, error } = await client.GET("/admin/vps-tenants");
  if (error) throw error;
  return data ?? [];
}

async function updateHealth(provider: string, status: HealthStatus): Promise<void> {
  const { error } = await client.PUT("/admin/provider-health/{provider}", {
    params: { path: { provider } },
    body: { status },
  });
  if (error) throw error;
}

const statusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  NORMAL: CheckCircle2,
  DEGRADED: AlertCircle,
  DOWN: XCircle,
};

const statusColor: Record<string, string> = {
  NORMAL: "text-green-600",
  DEGRADED: "text-yellow-500",
  DOWN: "text-red-600",
};

const STATUS_CYCLE: HealthStatus[] = ["NORMAL", "DEGRADED", "DOWN"];

const overallBanner: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  OK: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: CheckCircle,
    label: "All VPS tenants are recurring-billing ready",
  },
  PARTIAL: {
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-800",
    icon: AlertTriangle,
    label: "Tenant has configuration issues",
  },
  FAILING: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: XCircle,
    label: "VPS connection is failing",
  },
  NO_VPS_CONFIGS: {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-700",
    icon: Activity,
    label: "No active VPS provider configs found",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminProviderHealthPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [testResult, setTestResult] = useState<RecurringTestResult | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [simOpen, setSimOpen] = useState(false);

  const { data: providers, isLoading } = useQuery({
    queryKey: ["admin-provider-health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const { data: vpsTenants = [] } = useQuery({
    queryKey: ["admin-vps-tenants"],
    queryFn: fetchVpsTenants,
    enabled: isSuperAdmin,
  });

  const updateMut = useMutation({
    mutationFn: ({ provider, status }: { provider: string; status: HealthStatus }) =>
      updateHealth(provider, status),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-provider-health"] });
      toast.success(`Status set to ${vars.status}`);
    },
    onError: () => toast.error("Failed to update provider status"),
  });

  const testMut = useMutation({
    mutationFn: async (): Promise<RecurringTestResult> => {
      const { data, error } = await client.POST("/admin/recurring-test", {
        body: { tenantId: selectedTenantId || undefined },
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      setTestOpen(true);
    },
  });

  return (
    <>
      <AdminLayout>
        <div className="space-y-6">
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Provider Health</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and override the status of payment provider integrations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => qc.invalidateQueries({ queryKey: ["admin-provider-health"] })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* ── Provider health cards ────────────────────────────────────────── */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
          ) : !providers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No provider health records found.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {providers.map((provider) => {
                const Icon = statusIcon[provider.status] ?? Activity;
                return (
                  <Card key={provider.provider}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base font-semibold">{provider.provider}</CardTitle>
                      <StatusBadge status={provider.status} />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-8 w-8 ${statusColor[provider.status] ?? ""}`} />
                        <div>
                          {provider.notes && (
                            <p className="text-xs text-muted-foreground">{provider.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Updated: {provider.updatedAt ? formatDate(provider.updatedAt) : "Never"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        {STATUS_CYCLE.filter((s) => s !== provider.status).map((s) => (
                          <Button
                            key={s}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={updateMut.isPending}
                            onClick={() =>
                              updateMut.mutate({ provider: provider.provider, status: s })
                            }
                          >
                            Set {s}
                          </Button>
                        ))}
                      </div>

                      {/* ── Recurring billing test (VPS only) ───────────────── */}
                      {isSuperAdmin && provider.provider === "VPS" && (
                        <div className="space-y-3 pt-3 border-t">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Recurring Billing Test
                          </p>

                          <div className="flex items-center gap-2">
                            <Select
                              value={selectedTenantId}
                              onValueChange={(v) => {
                                setSelectedTenantId(v);
                                setTestOpen(false);
                              }}
                            >
                              <SelectTrigger className="h-8 flex-1 text-sm">
                                <SelectValue placeholder="Pick a tenant…" />
                              </SelectTrigger>
                              <SelectContent>
                                {vpsTenants.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testMut.mutate()}
                              disabled={testMut.isPending || !selectedTenantId}
                            >
                              <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                              {testMut.isPending ? "Running…" : "Run Test"}
                            </Button>
                          </div>

                          {testMut.isError && (
                            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {getErrorMessage(testMut.error)}
                            </p>
                          )}

                          {/* Simulation launcher */}
                          {selectedTenantId && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full h-8 text-xs"
                              onClick={() => setSimOpen(true)}
                            >
                              <Zap className="mr-1.5 h-3.5 w-3.5 text-yellow-500" />
                              Full Billing Simulation
                            </Button>
                          )}

                          {testOpen &&
                            testResult &&
                            (() => {
                              const meta =
                                overallBanner[testResult.overallStatus] ??
                                overallBanner.NO_VPS_CONFIGS;
                              const BannerIcon = meta.icon;
                              const tenantName = testResult.tenants[0]?.tenantName;
                              const bannerLabel =
                                testResult.overallStatus === "OK" && tenantName
                                  ? `${tenantName} is ready for recurring billing`
                                  : meta.label;
                              return (
                                <div className="space-y-3">
                                  {/* Banner */}
                                  <div
                                    className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 ${meta.bg}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <BannerIcon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                                      <div>
                                        <p className={`text-xs font-semibold ${meta.text}`}>
                                          {bannerLabel}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          Tested at{" "}
                                          {new Date(testResult.testedAt).toLocaleTimeString()} ·{" "}
                                          {testResult.totalVpsConfigs} config
                                          {testResult.totalVpsConfigs !== 1 ? "s" : ""} checked
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setTestOpen(false)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      Dismiss
                                    </button>
                                  </div>

                                  {/* Per-tenant result */}
                                  {testResult.tenants.map((t) => {
                                    const allOk =
                                      t.checks.connectivity !== false &&
                                      t.checks.profileStorage !== false &&
                                      t.checks.migrationApplied !== false;
                                    return (
                                      <div
                                        key={t.tenantId}
                                        className={`rounded-lg border px-3 py-2.5 space-y-2 ${
                                          allOk
                                            ? "border-green-200 bg-green-50/40"
                                            : "border-red-200 bg-red-50/40"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-semibold flex items-center gap-1">
                                            <Users className="h-3 w-3 text-muted-foreground" />
                                            {t.tenantName}
                                          </span>
                                          <Badge
                                            variant={allOk ? "default" : "destructive"}
                                            className="text-[10px] h-4 px-1.5"
                                          >
                                            {allOk ? "READY" : "ISSUES"}
                                          </Badge>
                                        </div>
                                        <ul className="space-y-1">
                                          <CheckItem
                                            ok={t.checks.connectivity}
                                            label={
                                              t.checks.connectivity
                                                ? `VPS API reachable (${t.latencyMs} ms)`
                                                : `VPS API unreachable${t.vpsError ? `: ${t.vpsError}` : ""}`
                                            }
                                          />
                                          <CheckItem
                                            ok={t.checks.profileStorage}
                                            label="Payment profile storage enabled (showPaymentProfiles)"
                                          />
                                          <CheckItem
                                            ok={t.checks.migrationApplied !== false}
                                            label={
                                              t.checks.migrationApplied !== false
                                                ? "Subscriptions DB migration applied"
                                                : (t.dbError ?? "Migration not applied")
                                            }
                                          />
                                          <CheckItem
                                            ok={t.checks.hasActiveSubscriptions}
                                            labelOk={`${t.subscriptionStats.active} active subscription${t.subscriptionStats.active !== 1 ? "s" : ""}`}
                                            label="No active subscriptions yet"
                                            neutral={!t.checks.hasActiveSubscriptions}
                                          />
                                        </ul>
                                        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-inherit">
                                          <StatCell
                                            label="Active"
                                            value={t.subscriptionStats.active}
                                          />
                                          <StatCell
                                            label="Past due"
                                            value={t.subscriptionStats.pastDue}
                                            color={
                                              t.subscriptionStats.pastDue > 0
                                                ? "text-orange-600"
                                                : undefined
                                            }
                                          />
                                          <StatCell
                                            label="Due today"
                                            value={t.dueTodayCount}
                                            color={t.dueTodayCount > 0 ? "text-primary" : undefined}
                                          />
                                          <StatCell
                                            label="Events"
                                            value={t.subscriptionStats.billingEventsTotal}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AdminLayout>

      {/* Simulation modal — rendered outside card so it overlays the full page */}
      {simOpen && selectedTenantId && (
        <SimulationModal
          tenantId={selectedTenantId}
          tenantName={vpsTenants.find((t) => t.id === selectedTenantId)?.name ?? selectedTenantId}
          onClose={() => setSimOpen(false)}
        />
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckItem({
  ok,
  label,
  labelOk,
  neutral,
}: {
  ok: boolean;
  label: string;
  labelOk?: string;
  neutral?: boolean;
}) {
  const icon = neutral ? (
    <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  ) : ok ? (
    <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
  );

  return (
    <li className="flex items-start gap-1.5">
      {icon}
      <span className={`text-xs ${neutral ? "text-muted-foreground" : ok ? "" : "text-red-700"}`}>
        {ok && labelOk ? labelOk : label}
      </span>
    </li>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums leading-none ${color ?? ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
