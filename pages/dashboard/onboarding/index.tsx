import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { toast } from "@/lib/use-toast";

type MerchantOnboarding = components["schemas"]["MerchantOnboarding"];

interface OnboardingForm {
  legalName: string;
  entityType: string;
  registrationNumber: string;
  country: string;
  businessAddress: string;
  website: string;
  contactEmail: string;
  industry: string;
  mcc: string;
}

const EMPTY_FORM: OnboardingForm = {
  legalName: "",
  entityType: "",
  registrationNumber: "",
  country: "",
  businessAddress: "",
  website: "",
  contactEmail: "",
  industry: "",
  mcc: "",
};

async function fetchOnboarding(): Promise<MerchantOnboarding | null> {
  const { data, error } = await client.GET("/onboarding");
  if (error) return null;
  return data ?? null;
}

export default function OnboardingPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<OnboardingForm>(EMPTY_FORM);

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: fetchOnboarding,
  });

  useEffect(() => {
    if (onboarding) {
      setForm({
        legalName: onboarding.legalName ?? "",
        entityType: onboarding.entityType ?? "",
        registrationNumber: onboarding.registrationNumber ?? "",
        country: onboarding.country ?? "",
        businessAddress: onboarding.businessAddress ?? "",
        website: onboarding.website ?? "",
        contactEmail: onboarding.contactEmail ?? "",
        industry: onboarding.industry ?? "",
        mcc: onboarding.mcc ?? "",
      });
    }
  }, [onboarding]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await client.PUT("/onboarding", { body: form });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Draft saved", "Your onboarding information has been saved.");
    },
    onError: (e) => toast.error("Save failed", getErrorMessage(e) || "Please try again."),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/onboarding/submit");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Submitted", "Your application has been submitted for review.");
    },
    onError: (e) => toast.error("Submit failed", getErrorMessage(e) || "Please try again."),
  });

  function setField(key: keyof OnboardingForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isDraft = onboarding?.status === "DRAFT";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Merchant Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your merchant profile to enable settlement.
          </p>
        </div>

        {/* Status banner */}
        {!isLoading && (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <StatusBadge
                  status={onboarding?.status ?? "NOT_STARTED"}
                  className="text-sm px-3 py-1"
                />
              </div>
              {onboarding?.status === "REJECTED" && onboarding.rejectionReason && (
                <p className="text-sm text-destructive">
                  Rejection reason: {onboarding.rejectionReason}
                </p>
              )}
              {onboarding?.status === "NEEDS_INFO" && onboarding.reviewNotes && (
                <p className="text-sm text-amber-600">Reviewer notes: {onboarding.reviewNotes}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Editable form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merchant Profile</CardTitle>
            <CardDescription>Business and contact details used for underwriting.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Legal Name">
                <Input
                  value={form.legalName}
                  onChange={(e) => setField("legalName", e.target.value)}
                  placeholder="Acme SARL"
                />
              </FormField>
              <FormField label="Entity Type">
                <Input
                  value={form.entityType}
                  onChange={(e) => setField("entityType", e.target.value)}
                  placeholder="SARL"
                />
              </FormField>
              <FormField label="Registration Number">
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => setField("registrationNumber", e.target.value)}
                  placeholder="e.g. 123456"
                />
              </FormField>
              <FormField label="Country">
                <Input
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  placeholder="MA"
                />
              </FormField>
              <FormField label="Business Address" className="sm:col-span-2">
                <Input
                  value={form.businessAddress}
                  onChange={(e) => setField("businessAddress", e.target.value)}
                  placeholder="123 Main Street"
                />
              </FormField>
              <FormField label="Website">
                <Input
                  value={form.website}
                  onChange={(e) => setField("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </FormField>
              <FormField label="Contact Email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                  placeholder="finance@example.com"
                />
              </FormField>
              <FormField label="Industry">
                <Input
                  value={form.industry}
                  onChange={(e) => setField("industry", e.target.value)}
                  placeholder="Retail"
                />
              </FormField>
              <FormField label="MCC">
                <Input
                  value={form.mcc}
                  onChange={(e) => setField("mcc", e.target.value)}
                  placeholder="5411"
                />
              </FormField>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => upsertMutation.mutate()}
                disabled={upsertMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {upsertMutation.isPending ? "Saving…" : "Save Draft"}
              </Button>
              {isDraft && (
                <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit for Review"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
