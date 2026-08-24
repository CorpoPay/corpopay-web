import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { client } from "@/lib/client";
import { formatAmount, formatDate } from "@/lib/utils";
import { toMoney } from "@/lib/money";
import type { components } from "@/lib/api-types";
import Link from "next/link";
import {
  ArrowUpRight,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Plus,
  Link2,
} from "lucide-react";

interface StatsResponse {
  total: number;
  succeeded: number;
  failed: number;
  refunded: number;
  totalAmount: number;
  succeededAmount: number;
}

type Transaction = Omit<components["schemas"]["Transaction"], "amount"> & {
  amount: number | string | null;
};

interface TransactionsResponse {
  data: Transaction[];
  total: number;
}

async function fetchStats(): Promise<StatsResponse> {
  // Aggregate from transactions endpoint
  const { data, error } = await client.GET("/transactions", {
    params: { query: { limit: "500", offset: "0" } },
  });
  if (error) throw error;
  const txs = data?.data ?? [];
  const stats: StatsResponse = {
    total: data?.total ?? 0,
    succeeded: 0,
    failed: 0,
    refunded: 0,
    totalAmount: 0,
    succeededAmount: 0,
  };
  for (const tx of txs) {
    const amount = Number(toMoney(tx.amount) ?? 0);
    if (tx.status === "SUCCEEDED") {
      stats.succeeded++;
      stats.succeededAmount += amount;
    } else if (tx.status === "FAILED" || tx.status === "CANCELED") {
      stats.failed++;
    } else if (tx.status === "REFUNDED") {
      stats.refunded++;
    }
    stats.totalAmount += amount;
  }
  return stats;
}

async function fetchRecentTransactions(): Promise<Transaction[]> {
  const { data, error } = await client.GET("/transactions", {
    params: { query: { limit: "5", offset: "0" } },
  });
  if (error) throw error;
  return (data?.data ?? []).map((tx) => ({ ...tx, amount: toMoney(tx.amount) }));
}

export default function DashboardHome() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const { data: recent, isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: fetchRecentTransactions,
  });

  const statCards = [
    {
      title: "Total Transactions",
      value: loadingStats ? "—" : String(stats?.total ?? 0),
      sub: "all time",
      icon: CreditCard,
      color: "text-primary",
    },
    {
      title: "Succeeded",
      value: loadingStats ? "—" : String(stats?.succeeded ?? 0),
      sub: stats ? formatAmount(stats.succeededAmount, "MAD") : "—",
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      title: "Failed / Canceled",
      value: loadingStats ? "—" : String(stats?.failed ?? 0),
      sub: "declined or canceled",
      icon: XCircle,
      color: "text-red-500",
    },
    {
      title: "Refunded",
      value: loadingStats ? "—" : String(stats?.refunded ?? 0),
      sub: "fully refunded",
      icon: RefreshCcw,
      color: "text-yellow-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">Your payment activity at a glance</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/payment-links">
                <Link2 className="mr-2 h-4 w-4" />
                Payment Links
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/payment-links/new">
                <Plus className="mr-2 h-4 w-4" />
                New Link
              </Link>
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        {loadingStats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {statCards.map((card) => (
              <motion.div
                key={card.title}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Recent transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/transactions">
                View all
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
            ) : !recent || recent.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No transactions yet"
                description="Create a payment link to start accepting payments."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/payment-links/new">Create a payment link</Link>
                  </Button>
                }
              />
            ) : (
              <div className="divide-y">
                {recent.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {tx.paymentLink?.title ?? "Direct Payment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)} · {tx.provider}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={tx.status} />
                      <span className="text-sm font-semibold tabular-nums">
                        {tx.amount != null ? formatAmount(tx.amount, tx.currency ?? "MAD") : "—"}
                      </span>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link href={`/dashboard/transactions/${tx.id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick-start checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "Configure a payment provider",
                href: "/dashboard/settings",
                desc: "Connect NAPS or VPS to start accepting payments",
              },
              {
                label: "Create your first payment link",
                href: "/dashboard/payment-links/new",
                desc: "Generate a shareable link in seconds",
              },
              {
                label: "Generate an API key",
                href: "/dashboard/api-keys",
                desc: "Integrate CorpoPay directly into your system",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
