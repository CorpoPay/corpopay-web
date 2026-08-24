import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "@/lib/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type TenantDetail = components["schemas"]["AdminTenantDetail"];

async function fetchTenantDetail(id: string): Promise<TenantDetail> {
  const { data, error } = await client.GET("/admin/tenants/{id}", {
    params: { path: { id } },
  });
  if (error || !data) throw error;
  return data;
}

async function updateStatus(id: string, status: "ACTIVE" | "DISABLED") {
  const { error } = await client.PATCH("/admin/tenants/{id}/status", {
    params: { path: { id } },
    body: { status },
  });
  if (error) throw error;
}

export default function AdminTenantDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const qc = useQueryClient();

  const {
    data: tenant,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-tenant", id],
    queryFn: () => fetchTenantDetail(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (status: "ACTIVE" | "DISABLED") => updateStatus(id, status),
    onSuccess: (_data, status) => {
      qc.invalidateQueries({ queryKey: ["admin-tenant", id] });
      toast.success(`Tenant ${status === "DISABLED" ? "disabled" : "enabled"}`);
    },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <p className="text-sm text-muted-foreground py-20 text-center">Loading…</p>
      </AdminLayout>
    );
  }

  if (isError || !tenant) {
    return (
      <AdminLayout>
        <p className="text-sm text-destructive py-20 text-center">Tenant not found.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/admin/tenants"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={tenant.status} />
            {tenant.status === "ACTIVE" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => mutation.mutate("DISABLED")}
                disabled={mutation.isPending}
              >
                Disable
              </Button>
            ) : tenant.status === "DISABLED" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutation.mutate("ACTIVE")}
                disabled={mutation.isPending}
              >
                Enable
              </Button>
            ) : null}
          </div>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="font-medium">{tenant.environment ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Notify Email</dt>
                <dd className="font-medium">{tenant.notifyEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(tenant.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ID</dt>
                <dd className="font-mono text-xs">{tenant.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Provider configs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider Configurations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.providerConfigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center py-4">
                      No provider configurations.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenant.providerConfigs.map((pc) => (
                    <TableRow key={pc.id}>
                      <TableCell className="font-medium">{pc.provider}</TableCell>
                      <TableCell>{pc.environment}</TableCell>
                      <TableCell>
                        <StatusBadge status={pc.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
