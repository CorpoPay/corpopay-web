/**
 * Dashboard — Installment Plans
 *
 * Lists the tenant's active BNPL installment plans and allows the merchant to
 * create, activate/deactivate, and delete plans.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { toast } from "@/lib/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type InstallmentPlan = components["schemas"]["InstallmentPlanListItem"];

interface PlansResponse {
  data: InstallmentPlan[];
}

// ─── Blank form ───────────────────────────────────────────────────────────────

const BLANK = {
  name: "",
  durationMonths: "3",
  annualInterestRate: "0",
  minAmount: "",
  maxAmount: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstallmentPlansPage() {
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>(BLANK);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Fetch plans ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<PlansResponse>({
    queryKey: ["installment-plans"],
    queryFn: async () => {
      const { data, error } = await client.GET("/installment-plans");
      if (error) throw error;
      return data ?? { data: [] };
    },
  });

  // ── Create / update ────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        durationMonths: parseInt(form.durationMonths, 10),
        annualInterestRate: parseFloat(form.annualInterestRate),
        minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined,
        maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
      };
      if (editing) {
        const { error } = await client.PATCH("/installment-plans/{id}", {
          params: { path: { id: editing } },
          body: payload,
        });
        if (error) throw error;
        return;
      }
      const { error } = await client.POST("/installment-plans", { body: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      setShowForm(false);
      setEditing(null);
      setForm(BLANK);
      setFormError("");
      toast.success(editing ? "Plan updated" : "Plan created");
    },
    onError: (e) => {
      const msg = getErrorMessage(e);
      setFormError(msg);
      toast.error("Failed to save plan", msg);
    },
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.DELETE("/installment-plans/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      setDeleteId(null);
      toast.success("Plan deleted");
    },
    onError: (e) => {
      toast.error("Failed to delete", getErrorMessage(e) || "Plan may have active agreements.");
      setDeleteId(null);
    },
  });

  // ── Toggle active ─────────────────────────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await client.PATCH("/installment-plans/{id}", {
        params: { path: { id } },
        body: { isActive },
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      toast.success(vars.isActive ? "Plan activated" : "Plan deactivated");
    },
  });

  function startEdit(plan: InstallmentPlan) {
    setEditing(plan.id);
    setForm({
      name: plan.name,
      durationMonths: String(plan.durationMonths),
      annualInterestRate: String(plan.annualInterestRate),
      minAmount: plan.minAmount != null ? String(plan.minAmount) : "",
      maxAmount: plan.maxAmount != null ? String(plan.maxAmount) : "",
    });
    setShowForm(true);
    setFormError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(BLANK);
    setFormError("");
  }

  const plans = data?.data ?? [];

  return (
    <DashboardLayout title="Installment Plans">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Installment Plans</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure BNPL plans available to customers on installment payment links.
            </p>
          </div>
          {!showForm && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setShowForm(true);
                setEditing(null);
                setForm(BLANK);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Plan
            </Button>
          )}
        </div>

        {/* Create / edit form */}
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {editing ? "Edit Plan" : "New Installment Plan"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="plan-name" className="text-xs">
                    Plan Name
                  </Label>
                  <Input
                    id="plan-name"
                    placeholder="e.g. 3-Month 0% APR"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="duration" className="text-xs">
                    Duration (months)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="60"
                    value={form.durationMonths}
                    onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="apr" className="text-xs">
                    Annual Interest Rate (%)
                  </Label>
                  <Input
                    id="apr"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.annualInterestRate}
                    onChange={(e) => setForm({ ...form, annualInterestRate: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="min-amount" className="text-xs">
                    Min Amount (optional)
                  </Label>
                  <Input
                    id="min-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No minimum"
                    value={form.minAmount}
                    onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="max-amount" className="text-xs">
                    Max Amount (optional)
                  </Label>
                  <Input
                    id="max-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No maximum"
                    value={form.maxAmount}
                    onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={saveMut.isPending}
                  onClick={() => saveMut.mutate()}
                >
                  {saveMut.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Plan"
                  )}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No installment plans yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a plan and attach it to a BNPL payment link.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardContent className="pt-4 pb-4 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.durationMonths} months</p>
                    </div>
                    <Badge
                      variant={plan.isActive ? "default" : "secondary"}
                      className="shrink-0 text-[10px]"
                    >
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                    <span>
                      APR:{" "}
                      <strong className="text-foreground">
                        {Number(plan.annualInterestRate)}%
                      </strong>
                    </span>
                    {plan.minAmount != null && (
                      <span>
                        Min:{" "}
                        <strong className="text-foreground">
                          {Number(plan.minAmount).toFixed(2)}
                        </strong>
                      </span>
                    )}
                    {plan.maxAmount != null && (
                      <span>
                        Max:{" "}
                        <strong className="text-foreground">
                          {Number(plan.maxAmount).toFixed(2)}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => startEdit(plan)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => toggleMut.mutate({ id: plan.id, isActive: !plan.isActive })}
                    >
                      {plan.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(plan.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation */}
        <AlertDialog
          open={!!deleteId}
          onOpenChange={(o) => {
            if (!o) setDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Plans with active agreements cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && deleteMut.mutate(deleteId)}
              >
                {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete plan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
