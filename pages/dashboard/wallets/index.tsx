import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
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

type Wallet = components["schemas"]["Wallet"];
type WalletOwnerType = "TENANT" | "CUSTOMER";

const OWNER_TYPES: WalletOwnerType[] = ["CUSTOMER", "TENANT"];

async function fetchWallets(): Promise<Wallet[]> {
  const { data, error } = await client.GET("/wallets");
  if (error || !data) throw error;
  return data;
}

export default function WalletsPage() {
  const qc = useQueryClient();
  const [ownerType, setOwnerType] = useState<WalletOwnerType>("CUSTOMER");
  const [ownerId, setOwnerId] = useState("");
  const [currency, setCurrency] = useState("");

  const { data: wallets, isLoading } = useQuery({
    queryKey: ["wallets"],
    queryFn: fetchWallets,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: { ownerType: WalletOwnerType; ownerId: string; currency?: string } = {
        ownerType,
        ownerId,
      };
      if (currency.trim()) body.currency = currency.trim().toUpperCase();
      const { error } = await client.POST("/wallets", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Wallet created", "The stored-value wallet is ready.");
      setOwnerId("");
      setCurrency("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stored-value accounts your customers top up and draw down.
          </p>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Wallet</CardTitle>
            <CardDescription>
              One wallet per owner. A customer wallet is topped up ahead of use, then drawn down
              with no per-transaction provider call.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Owner Type">
                <Select value={ownerType} onValueChange={(v) => setOwnerType(v as WalletOwnerType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "CUSTOMER" ? "Customer" : "Tenant"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Owner ID">
                <Input
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  placeholder={ownerType === "CUSTOMER" ? "e.g. cust_123" : "tenant slug"}
                />
              </FormField>
              <FormField label="Currency" hint="Optional, defaults to MAD">
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="MAD"
                />
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !ownerId.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Wallet"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="Wallets">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Open</TableHead>
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
              ) : !wallets?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No wallets yet.
                  </TableCell>
                </TableRow>
              ) : (
                wallets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {w.ownerType === "CUSTOMER" ? "Customer" : "Tenant"}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{w.ownerId}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(w.balanceCents / 100, w.currency)}
                    </TableCell>
                    <TableCell className="text-sm">{w.currency}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(w.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link href={`/dashboard/wallets/${w.id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
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
