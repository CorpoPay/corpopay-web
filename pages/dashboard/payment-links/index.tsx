import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ExternalLink, Link2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { components } from "@/lib/api-types";
import { client } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatAmount, formatDate } from "@/lib/utils";

type PaymentLink = components["schemas"]["PaymentLinkListItem"];

type LinksResponse = {
  data: PaymentLink[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 20;

async function fetchLinks(offset: number): Promise<LinksResponse> {
  const { data, error } = await client.GET("/payment-links", {
    params: { query: { limit: String(PAGE_SIZE), offset: String(offset) } },
  });
  if (error) throw error;
  return data ?? { data: [], total: 0, page: 1, limit: PAGE_SIZE };
}

async function cancelLink(id: string) {
  const { error } = await client.PATCH("/payment-links/{id}/cancel", {
    params: { path: { id } },
  });
  if (error) throw error;
}

export default function PaymentLinksPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payment-links", page],
    queryFn: () => fetchLinks(page * PAGE_SIZE),
  });

  const mutation = useMutation({
    mutationFn: () => cancelLink(targetId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links"] });
      setTargetId(null);
      toast.success("Link canceled", "The link will no longer accept payments.");
    },
    onError: () => toast.error("Action failed", "Please try again."),
  });

  function copyUrl(slug: string) {
    const url = `${window.location.origin}/checkout/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  const filtered = (data?.data ?? []).filter(
    (l) =>
      (l.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.reference ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.slug ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Links</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Shareable links that let customers pay you instantly.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/payment-links/new">
              <Plus className="mr-2 h-4 w-4" />
              New Link
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <SearchInput
              placeholder="Search by title or slug…"
              value={search}
              onChange={(v) => setSearch(v)}
            />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>
            ) : isError ? (
              <p className="text-sm text-destructive py-10 text-center">Failed to load links.</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No payment links"
                description="Create a shareable link to start accepting payments."
                action={
                  <Button asChild size="sm">
                    <Link href="/dashboard/payment-links/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Link
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="divide-y">
                {filtered.map((link) => {
                  const checkoutUrl = `${
                    typeof window !== "undefined" ? window.location.origin : ""
                  }/checkout/${link.slug}`;
                  return (
                    <div key={link.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{link.description}</span>
                          <StatusBadge status={link.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatAmount(link.amount, link.currency)} · {link.attemptCount}/
                          {link.maxAttempts ?? "∞"} uses ·{" "}
                          {link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "No expiry"} ·
                          Created {formatDate(link.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Copy link"
                          onClick={() => copyUrl(link.slug)}
                        >
                          <RefreshCw className="h-4 w-4 rotate-0" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Open checkout"
                          asChild
                        >
                          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>

                        {link.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Cancel link"
                            onClick={() => setTargetId(link.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!targetId}
        onOpenChange={(open) => {
          if (!open) setTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel link?</AlertDialogTitle>
            <AlertDialogDescription>
              The link will stop accepting new payments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep link</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending ? "Canceling…" : "Cancel link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
