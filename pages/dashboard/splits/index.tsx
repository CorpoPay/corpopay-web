import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCcw } from "lucide-react";
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
import { formatAmount, formatDate } from "@/lib/utils";

type SplitParty = components["schemas"]["SplitParty"];
type SplitRule = components["schemas"]["SplitRule"];
type Split = components["schemas"]["Split"];
type PartyType = "PLATFORM" | "SUB_MERCHANT" | "VENDOR" | "AFFILIATE" | "ESCROW";
type Trigger = "AT_CAPTURE" | "ON_USAGE" | "MANUAL";

const PARTY_TYPES: PartyType[] = ["PLATFORM", "SUB_MERCHANT", "VENDOR", "AFFILIATE", "ESCROW"];
const TRIGGERS: Trigger[] = ["AT_CAPTURE", "ON_USAGE", "MANUAL"];

async function fetchSplitParties(): Promise<SplitParty[]> {
  const { data, error } = await client.GET("/split-parties");
  if (error || !data) throw error;
  return data;
}

async function fetchSplitRules(): Promise<SplitRule[]> {
  const { data, error } = await client.GET("/split-rules");
  if (error || !data) throw error;
  return data;
}

async function fetchSplits(): Promise<Split[]> {
  const { data, error } = await client.GET("/splits");
  if (error || !data) throw error;
  return data;
}

function parseShares(text: string): { partyId: string; shareBps: number }[] {
  const out: { partyId: string; shareBps: number }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [partyId, bps] = line.split(",").map((s) => s.trim());
    if (!partyId || bps == null || Number.isNaN(Number(bps))) continue;
    out.push({ partyId, shareBps: Number(bps) });
  }
  return out;
}

export default function SplitsPage() {
  const qc = useQueryClient();

  // Parties form state
  const [partySlug, setPartySlug] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState("");

  // Rules form state
  const [ruleName, setRuleName] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("");
  const [sharesText, setSharesText] = useState("");

  const { data: parties, isLoading: partiesLoading } = useQuery({
    queryKey: ["split-parties"],
    queryFn: fetchSplitParties,
  });
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["split-rules"],
    queryFn: fetchSplitRules,
  });
  const { data: splits, isLoading: splitsLoading } = useQuery({
    queryKey: ["splits"],
    queryFn: fetchSplits,
  });

  const createPartyMutation = useMutation({
    mutationFn: async () => {
      const body: {
        slug: string;
        name: string;
        type?: PartyType | null;
      } = { slug: partySlug, name: partyName };
      if (partyType) body.type = partyType as PartyType;
      const { error } = await client.POST("/split-parties", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-parties"] });
      toast.success("Party created", "The split party has been added.");
      setPartySlug("");
      setPartyName("");
      setPartyType("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  const deactivatePartyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/split-parties/{id}/deactivate", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-parties"] });
      toast.success("Party deactivated", "The split party is now inactive.");
    },
    onError: (e) => toast.error("Deactivate failed", getErrorMessage(e) || "Please try again."),
  });

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const body: {
        name: string;
        trigger?: Trigger | null;
        shares: { partyId: string; shareBps: number }[];
      } = { name: ruleName, shares: parseShares(sharesText) };
      if (ruleTrigger) body.trigger = ruleTrigger as Trigger;
      const { error } = await client.POST("/split-rules", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-rules"] });
      toast.success("Rule created", "The split rule has been added.");
      setRuleName("");
      setRuleTrigger("");
      setSharesText("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  const deactivateRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/split-rules/{id}/deactivate", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-rules"] });
      toast.success("Rule deactivated", "The split rule is now inactive.");
    },
    onError: (e) => toast.error("Deactivate failed", getErrorMessage(e) || "Please try again."),
  });

  const releaseSplitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/splits/{id}/release", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splits"] });
      toast.success("Split released", "Held funds have been released.");
    },
    onError: (e) => toast.error("Release failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Splits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage beneficiaries, split rules, and held splits.
          </p>
        </div>

        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Split Parties</CardTitle>
            <CardDescription>Beneficiaries that receive a share of funds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Slug">
                <Input
                  value={partySlug}
                  onChange={(e) => setPartySlug(e.target.value)}
                  placeholder="e.g. platform"
                />
              </FormField>
              <FormField label="Name">
                <Input
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Platform"
                />
              </FormField>
              <FormField label="Type">
                <Select value={partyType} onValueChange={setPartyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <Button
              onClick={() => createPartyMutation.mutate()}
              disabled={createPartyMutation.isPending || !partySlug || !partyName}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createPartyMutation.isPending ? "Creating…" : "Add Party"}
            </Button>

            <TableCard title="Parties">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partiesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-0 px-6">
                        <SkeletonRow />
                      </TableCell>
                    </TableRow>
                  ) : !parties?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No parties yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-mono">{p.slug}</TableCell>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-sm">{p.type}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                        </TableCell>
                        <TableCell className="text-right">
                          {p.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deactivatePartyMutation.mutate(p.id)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableCard>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Split Rules</CardTitle>
            <CardDescription>Reusable share templates triggered on capture/usage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name">
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. 80/20 split"
                />
              </FormField>
              <FormField label="Trigger">
                <Select value={ruleTrigger} onValueChange={setRuleTrigger}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Shares"
                hint="One per line: partyId,shareBps (e.g. party_abc,8000)"
                className="sm:col-span-2"
              >
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sharesText}
                  onChange={(e) => setSharesText(e.target.value)}
                  placeholder={"party_abc,8000\nparty_def,2000"}
                />
              </FormField>
            </div>
            <Button
              onClick={() => createRuleMutation.mutate()}
              disabled={createRuleMutation.isPending || !ruleName || !sharesText.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createRuleMutation.isPending ? "Creating…" : "Add Rule"}
            </Button>

            <TableCard title="Rules">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-0 px-6">
                        <SkeletonRow />
                      </TableCell>
                    </TableRow>
                  ) : !rules?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No rules yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.name}</TableCell>
                        <TableCell className="text-sm">{r.trigger}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {Object.keys(r.shares ?? {}).length} share(s)
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} />
                        </TableCell>
                        <TableCell className="text-right">
                          {r.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deactivateRuleMutation.mutate(r.id)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableCard>
          </CardContent>
        </Card>

        {/* Splits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Splits</CardTitle>
            <CardDescription>Individual split allocations (held and released).</CardDescription>
          </CardHeader>
          <CardContent>
            <TableCard title="All Splits">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splitsLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="py-0 px-6">
                          <SkeletonRow />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !splits?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No splits yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    splits.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">
                          <span className="text-muted-foreground">{s.sourceType}</span>{" "}
                          <span className="font-mono text-xs">{s.sourceId.slice(0, 12)}…</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.partyId.slice(0, 12)}…
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-sm">
                          {formatAmount(s.amountCents / 100, s.currency ?? "MAD")}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(s.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.status !== "RELEASED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => releaseSplitMutation.mutate(s.id)}
                              disabled={releaseSplitMutation.isPending}
                            >
                              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                              Release
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableCard>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
