import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonRow } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatDate } from "@/lib/utils";

type SettlementPolicy = components["schemas"]["SettlementPolicy"];

const AVAILABILITY_MODES = ["IMMEDIATE", "DELAY", "ON_FULFILLMENT", "ON_COLLECTION"];
const RESERVE_TYPES = ["NONE", "FIXED", "ROLLING"];
const PAYOUT_SCHEDULES = [
  "MANUAL",
  "AUTO_DAILY",
  "AUTO_WEEKLY",
  "AUTO_MONTHLY",
  "THRESHOLD",
  "INSTANT",
];
const REVERSAL_FUNDING = [
  "NET_FROM_AVAILABLE",
  "DEBIT_RESERVE",
  "INVOICE_TENANT",
  "ALLOW_NEGATIVE",
];

async function fetchSettlementPolicies(): Promise<SettlementPolicy[]> {
  const { data, error } = await client.GET("/settlement-policies");
  if (error || !data) throw error;
  return data;
}

export default function SettlementPoliciesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [mcc, setMcc] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState("");
  const [reserveType, setReserveType] = useState("");
  const [payoutSchedule, setPayoutSchedule] = useState("");
  const [reversalFunding, setReversalFunding] = useState("");
  const [splittingEnabled, setSplittingEnabled] = useState(false);
  const [allowNegative, setAllowNegative] = useState(false);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["settlement-policies"],
    queryFn: fetchSettlementPolicies,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: {
        name?: string | null;
        industry?: string | null;
        mcc?: string | null;
        availabilityMode?: "IMMEDIATE" | "DELAY" | "ON_FULFILLMENT" | "ON_COLLECTION" | null;
        reserveType?: "NONE" | "FIXED" | "ROLLING" | null;
        payoutSchedule?:
          | "MANUAL"
          | "AUTO_DAILY"
          | "AUTO_WEEKLY"
          | "AUTO_MONTHLY"
          | "THRESHOLD"
          | "INSTANT"
          | null;
        reversalFunding?:
          | "NET_FROM_AVAILABLE"
          | "DEBIT_RESERVE"
          | "INVOICE_TENANT"
          | "ALLOW_NEGATIVE"
          | null;
        splittingEnabled?: boolean;
        allowNegative?: boolean;
      } = {
        splittingEnabled,
        allowNegative,
      };

      if (name) body.name = name;
      if (industry) body.industry = industry;
      if (mcc) body.mcc = mcc;
      if (availabilityMode) {
        body.availabilityMode = availabilityMode as NonNullable<typeof body.availabilityMode>;
      }
      if (reserveType) body.reserveType = reserveType as NonNullable<typeof body.reserveType>;
      if (payoutSchedule) {
        body.payoutSchedule = payoutSchedule as NonNullable<typeof body.payoutSchedule>;
      }
      if (reversalFunding) {
        body.reversalFunding = reversalFunding as NonNullable<typeof body.reversalFunding>;
      }

      const { error } = await client.POST("/settlement-policies", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlement-policies"] });
      toast.success("Policy created", "The settlement policy has been saved.");
      setName("");
      setIndustry("");
      setMcc("");
      setAvailabilityMode("");
      setReserveType("");
      setPayoutSchedule("");
      setReversalFunding("");
      setSplittingEnabled(false);
      setAllowNegative(false);
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlement Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure availability, reserves, and payout schedules.
          </p>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Settlement Policy</CardTitle>
            <CardDescription>
              Create a policy version. Only one can be active at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard merchants"
                />
              </FormField>
              <FormField label="Industry">
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Retail"
                />
              </FormField>
              <FormField label="MCC">
                <Input
                  value={mcc}
                  onChange={(e) => setMcc(e.target.value)}
                  placeholder="e.g. 5411"
                />
              </FormField>

              <FormField label="Availability Mode">
                <Select value={availabilityMode} onValueChange={setAvailabilityMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Reserve Type">
                <Select value={reserveType} onValueChange={setReserveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVE_TYPES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Payout Schedule">
                <Select value={payoutSchedule} onValueChange={setPayoutSchedule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_SCHEDULES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Reversal Funding">
                <Select value={reversalFunding} onValueChange={setReversalFunding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVERSAL_FUNDING.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Options" className="sm:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={splittingEnabled}
                      onChange={(e) => setSplittingEnabled(e.target.checked)}
                    />
                    Splitting enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowNegative}
                      onChange={(e) => setAllowNegative(e.target.checked)}
                    />
                    Allow negative balance
                  </label>
                </div>
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Policy"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="All Policies">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Reserve</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-0 px-6">
                      <SkeletonRow />
                    </TableCell>
                  </TableRow>
                ))
              ) : !policies?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No settlement policies yet.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">v{p.version}</TableCell>
                    <TableCell className="text-sm">{p.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.industry ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.availabilityMode}</TableCell>
                    <TableCell className="text-sm">{p.reserveType}</TableCell>
                    <TableCell className="text-sm">{p.payoutSchedule}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(p.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </DashboardLayout>
  );
}
