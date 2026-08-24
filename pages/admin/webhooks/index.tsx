import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";

type WebhookEvent = components["schemas"]["AdminWebhookEvent"];

interface WebhookResponse {
  data: WebhookEvent[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 25;

async function fetchWebhooks(
  page: number,
  provider: string,
  processed: string,
): Promise<WebhookResponse> {
  const { data, error } = await client.GET("/admin/webhooks", {
    params: {
      query: {
        limit: String(PAGE_SIZE),
        page: String(page + 1),
        ...(provider !== "ALL" ? { provider } : {}),
        ...(processed !== "ALL" ? { processed } : {}),
      },
    },
  });
  if (error) throw error;
  return data ?? { data: [], total: 0, page: 1, limit: PAGE_SIZE };
}

export default function AdminWebhooksPage() {
  const [page, setPage] = useState(0);
  const [provider, setProvider] = useState("ALL");
  const [processed, setProcessed] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-webhooks", page, provider, processed],
    queryFn: () => fetchWebhooks(page, provider, processed),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhook Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming webhook events from NAPS and VPS.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["ALL", "NAPS", "VPS"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "ALL" ? "All providers" : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={processed}
            onValueChange={(v) => {
              setProcessed(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All events</SelectItem>
              <SelectItem value="true">Processed</SelectItem>
              <SelectItem value="false">Unprocessed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Mapped Status</TableHead>
                <TableHead>Idempotency Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Received</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={7} rows={6} />
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No webhook events found.
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{event.mappedStatus ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.idempotencyKey ? `${event.idempotencyKey.slice(0, 16)}…` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.processed ? "PROCESSED" : "PENDING"} />
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                      {event.processingError ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                      >
                        {expanded === event.id ? "Hide" : "Raw"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>

        {/* Expanded raw payload */}
        {expanded && data?.data?.some((e) => e.id === expanded) && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(data.data.find((e) => e.id === expanded)?.rawPayload ?? {}, null, 2)}
            </pre>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>
    </AdminLayout>
  );
}
