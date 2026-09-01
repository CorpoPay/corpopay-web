import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Pagination } from "@/components/shared/Pagination";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/lib/use-toast";
import { formatDate } from "@/lib/utils";

interface AdminOnboardingItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  legalName: string | null;
  entityType: string | null;
  registrationNumber: string | null;
  country: string | null;
  businessAddress: string | null;
  website: string | null;
  contactEmail: string | null;
  industry: string | null;
  mcc: string | null;
  riskTier: string;
  submittedAt: string | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OnboardingResponse {
  data: AdminOnboardingItem[];
  total: number;
  page: number;
  limit: number;
}

type OnboardingAction = "approve" | "reject" | "request-info";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "NEEDS_INFO"];

async function fetchOnboarding(page: number, status: string): Promise<OnboardingResponse> {
  const { data, error } = await client.GET("/admin/onboarding", {
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

async function performOnboardingAction(tenantId: string, action: OnboardingAction, input: string) {
  if (action === "approve") {
    const { error } = await client.POST("/admin/onboarding/{tenantId}/approve", {
      params: { path: { tenantId } },
    });
    if (error) throw error;
  } else if (action === "reject") {
    const { error } = await client.POST("/admin/onboarding/{tenantId}/reject", {
      params: { path: { tenantId } },
      body: { reason: input },
    });
    if (error) throw error;
  } else {
    const { error } = await client.POST("/admin/onboarding/{tenantId}/request-info", {
      params: { path: { tenantId } },
      body: { notes: input },
    });
    if (error) throw error;
  }
}

export default function AdminOnboardingPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [target, setTarget] = useState<AdminOnboardingItem | null>(null);
  const [action, setAction] = useState<OnboardingAction | null>(null);
  const [input, setInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-onboarding", page, status],
    queryFn: () => fetchOnboarding(page, status),
  });

  const actionMutation = useMutation({
    mutationFn: (vars: { tenantId: string; action: OnboardingAction; input: string }) =>
      performOnboardingAction(vars.tenantId, vars.action, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-onboarding"] });
      const label =
        vars.action === "approve" ? "approved" : vars.action === "reject" ? "rejected" : "updated";
      toast.success(`Onboarding ${label}`);
      setTarget(null);
      setAction(null);
    },
    onError: () => toast.error("Action failed"),
  });

  const onboardings = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const dialogOpen = target !== null && action !== null;

  function openDialog(item: AdminOnboardingItem, nextAction: OnboardingAction) {
    setTarget(item);
    setAction(nextAction);
    setInput("");
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total !== undefined ? `${data.total} total` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
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

        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Legal Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Risk Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={7} rows={5} />
              ) : onboardings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No onboarding applications found.
                  </TableCell>
                </TableRow>
              ) : (
                onboardings.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.tenantName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {item.tenantSlug}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.legalName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{item.industry ?? "—"}</TableCell>
                    <TableCell className="text-sm">{item.riskTier}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {item.submittedAt ? formatDate(item.submittedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {item.status === "SUBMITTED" ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => openDialog(item, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => openDialog(item, "reject")}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => openDialog(item, "request-info")}
                          >
                            Request info
                          </Button>
                        </div>
                      ) : null}
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

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "approve"
                ? "Approve onboarding"
                : action === "reject"
                  ? "Reject onboarding"
                  : "Request information"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "approve"
                ? `Approve ${target?.tenantName ?? "this tenant"} and resolve its policy preset.`
                : action === "reject"
                  ? `Reject the onboarding application for ${target?.tenantName ?? "this tenant"}.`
                  : `Request more information from ${target?.tenantName ?? "this tenant"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {action !== "approve" ? (
            <div className="space-y-2">
              <Label htmlFor="actionInput">{action === "reject" ? "Reason" : "Notes"}</Label>
              <Input
                id="actionInput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  action === "reject" ? "Reason for rejection" : "What information is needed"
                }
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => {
                if (target && action) {
                  actionMutation.mutate({
                    tenantId: target.tenantId,
                    action,
                    input: input.trim(),
                  });
                }
              }}
              disabled={actionMutation.isPending || (action !== "approve" && !input.trim())}
            >
              {action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Request info"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
