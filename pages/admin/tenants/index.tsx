import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
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
import type { components } from "@/lib/api-types";
import { client } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatDate } from "@/lib/utils";

type Tenant = components["schemas"]["AdminTenantListItem"];

interface TenantsResponse {
  data: Tenant[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["ALL", "ACTIVE", "DISABLED"];

async function fetchTenants(page: number, status: string): Promise<TenantsResponse> {
  const { data, error } = await client.GET("/admin/tenants", {
    params: {
      query: {
        limit: String(PAGE_SIZE),
        page: String(page + 1),
        ...(status !== "ALL" ? { status } : {}),
      },
    },
  });
  if (error) throw error;
  return data ?? { data: [], total: 0, page: 1, limit: PAGE_SIZE };
}

async function updateTenantStatus(id: string, status: "ACTIVE" | "DISABLED") {
  const { error } = await client.PATCH("/admin/tenants/{id}/status", {
    params: { path: { id } },
    body: { status },
  });
  if (error) throw error;
}

export default function AdminTenantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants", page, status],
    queryFn: () => fetchTenants(page, status),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "DISABLED" }) =>
      updateTenantStatus(id, status),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success(`Tenant ${vars.status === "DISABLED" ? "disabled" : "enabled"}`);
    },
    onError: () => toast.error("Failed to update tenant status"),
  });

  const tenants = (data?.data ?? []).filter(
    (t) =>
      (t.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.slug ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total !== undefined ? `${data.total} total` : ""}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <SearchInput
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder="Filter name or slug…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Providers</TableHead>
                <TableHead>Last Transaction</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={8} rows={5} />
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No tenants found.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tenant.slug}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tenant.status} />
                    </TableCell>
                    <TableCell className="text-sm">{tenant.environment}</TableCell>
                    <TableCell className="text-sm">{tenant.transactionCount}</TableCell>
                    <TableCell className="text-sm">
                      {tenant.providerConfigs.length
                        ? tenant.providerConfigs.map((p) => p.provider).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tenant.lastTransactionAt ? formatDate(tenant.lastTransactionAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tenant.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7"
                            onClick={() =>
                              statusMutation.mutate({ id: tenant.id, status: "DISABLED" })
                            }
                          >
                            Disable
                          </Button>
                        ) : tenant.status === "DISABLED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() =>
                              statusMutation.mutate({ id: tenant.id, status: "ACTIVE" })
                            }
                          >
                            Enable
                          </Button>
                        ) : null}
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                          <Link href={`/admin/tenants/${tenant.id}`}>
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>

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
