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

type FeeSchedule = components["schemas"]["FeeSchedule"];
type FeeType = "FLAT" | "PERCENTAGE" | "PER_METHOD" | "TIERED";

const FEE_TYPES: FeeType[] = ["FLAT", "PERCENTAGE", "PER_METHOD", "TIERED"];

async function fetchFeeSchedules(): Promise<FeeSchedule[]> {
  const { data, error } = await client.GET("/fee-schedules");
  if (error || !data) throw error;
  return data;
}

async function fetchActiveFeeSchedule(): Promise<FeeSchedule | null> {
  const { data, error } = await client.GET("/fee-schedules/active");
  if (error) return null;
  return data ?? null;
}

function parseCentsMap(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [method, cents] = line.split(",").map((s) => s.trim());
    if (!method || cents == null || Number.isNaN(Number(cents))) continue;
    out[method] = Number(cents);
  }
  return out;
}

function parseTiers(text: string): { upToCents: number; percentageBps: number }[] {
  const out: { upToCents: number; percentageBps: number }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [upTo, bps] = line.split(",").map((s) => s.trim());
    if (upTo == null || bps == null || Number.isNaN(Number(upTo)) || Number.isNaN(Number(bps))) {
      continue;
    }
    out.push({ upToCents: Number(upTo), percentageBps: Number(bps) });
  }
  return out;
}

export default function FeeSchedulesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [feeType, setFeeType] = useState<FeeType>("FLAT");
  const [flatCents, setFlatCents] = useState("");
  const [percentageBps, setPercentageBps] = useState("");
  const [perMethodText, setPerMethodText] = useState("");
  const [tiersText, setTiersText] = useState("");

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["fee-schedules"],
    queryFn: fetchFeeSchedules,
  });

  const { data: active } = useQuery({
    queryKey: ["fee-schedules", "active"],
    queryFn: fetchActiveFeeSchedule,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: {
        name?: string | null;
        feeType: FeeType;
        flatCents?: number | null;
        percentageBps?: number | null;
        perMethodCents?: Record<string, number> | null;
        tiersCents?: { upToCents: number; percentageBps: number }[] | null;
        currency?: string | null;
      } = { feeType, ...(name ? { name } : {}) };

      if (feeType === "FLAT" && flatCents !== "") body.flatCents = Number(flatCents);
      if (feeType === "PERCENTAGE" && percentageBps !== "") {
        body.percentageBps = Number(percentageBps);
      }
      if (feeType === "PER_METHOD" && perMethodText.trim()) {
        body.perMethodCents = parseCentsMap(perMethodText);
      }
      if (feeType === "TIERED" && tiersText.trim()) {
        body.tiersCents = parseTiers(tiersText);
      }

      const { error } = await client.POST("/fee-schedules", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-schedules"] });
      toast.success("Fee schedule created", "The new fee schedule has been saved.");
      setName("");
      setFlatCents("");
      setPercentageBps("");
      setPerMethodText("");
      setTiersText("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Schedules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define pricing rules applied to settlements.
          </p>
        </div>

        {/* Active schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Fee Schedule</CardTitle>
            <CardDescription>The schedule currently applied to new settlements.</CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{active.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Version:</span>{" "}
                  <span className="font-medium">{active.version}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="font-medium">{active.feeType}</span>
                </div>
                <StatusBadge status={active.isActive ? "ACTIVE" : "INACTIVE"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active fee schedule.</p>
            )}
          </CardContent>
        </Card>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Fee Schedule</CardTitle>
            <CardDescription>
              Create a new schedule version. Only one can be active at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard 2.9% + 2 MAD"
                />
              </FormField>
              <FormField label="Fee Type">
                <Select value={feeType} onValueChange={(v) => setFeeType(v as FeeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {feeType === "FLAT" && (
                <FormField label="Flat Fee (centimes)">
                  <Input
                    type="number"
                    value={flatCents}
                    onChange={(e) => setFlatCents(e.target.value)}
                    placeholder="e.g. 200"
                  />
                </FormField>
              )}
              {feeType === "PERCENTAGE" && (
                <FormField label="Percentage (bps)">
                  <Input
                    type="number"
                    value={percentageBps}
                    onChange={(e) => setPercentageBps(e.target.value)}
                    placeholder="e.g. 290 (2.90%)"
                  />
                </FormField>
              )}
              {feeType === "PER_METHOD" && (
                <FormField
                  label="Per-Method Fees"
                  hint="One per line: method,centimes (e.g. CARD,300)"
                  className="sm:col-span-2"
                >
                  <textarea
                    className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={perMethodText}
                    onChange={(e) => setPerMethodText(e.target.value)}
                    placeholder={"CARD,300\nBANK_TRANSFER,0"}
                  />
                </FormField>
              )}
              {feeType === "TIERED" && (
                <FormField
                  label="Tiers"
                  hint="One per line: upToCents,percentageBps (e.g. 100000,300)"
                  className="sm:col-span-2"
                >
                  <textarea
                    className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={tiersText}
                    onChange={(e) => setTiersText(e.target.value)}
                    placeholder={"100000,300\n500000,250"}
                  />
                </FormField>
              )}
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Schedule"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="All Schedules">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-0 px-6">
                      <SkeletonRow />
                    </TableCell>
                  </TableRow>
                ))
              ) : !schedules?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No fee schedules yet.
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">v{s.version}</TableCell>
                    <TableCell className="text-sm">{s.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.feeType}</TableCell>
                    <TableCell className="text-sm">{s.currency}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.isActive ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(s.updatedAt)}
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
