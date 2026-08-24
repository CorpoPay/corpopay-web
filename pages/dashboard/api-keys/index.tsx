import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SkeletonRow } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "@/lib/use-toast";
import { client } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";
import { Plus, ShieldOff, Eye, EyeOff, Key } from "lucide-react";

type ApiKey = components["schemas"]["ApiKeyListItem"];
type CreateKeyResponse = components["schemas"]["ApiKeyCreateResponse"];

async function fetchApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await client.GET("/api-keys");
  if (error) throw error;
  return data ?? [];
}

async function createApiKey(name: string): Promise<CreateKeyResponse> {
  const { data, error } = await client.POST("/api-keys", { body: { name } });
  if (error || !data) throw error;
  return data;
}

async function revokeApiKey(id: string) {
  const { error } = await client.DELETE("/api-keys/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
}

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [newKeyData, setNewKeyData] = useState<CreateKeyResponse | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: () => createApiKey(name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKeyData(data);
      setName("");
      toast.success("API key created", "Copy it now — it will never be shown again.");
    },
    onError: () => toast.error("Failed to create key"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeApiKey(revokeTarget!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setRevokeTarget(null);
      toast.success("Key revoked", "The API key can no longer authenticate requests.");
    },
    onError: () => toast.error("Failed to revoke key"),
  });

  function handleCreate() {
    if (!name.trim()) {
      setNameError("Key name is required");
      return;
    }
    setNameError("");
    createMutation.mutate();
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use API keys to authenticate requests from your backend.
          </p>
        </div>

        {/* Create new key */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="keyname">Key Name</Label>
                <Input
                  id="keyname"
                  placeholder="e.g. Production Server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={createMutation.isPending} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New key reveal */}
        <AnimatePresence>
          {newKeyData && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", duration: 0.4 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm text-primary">
                    ✓ API key created — save it now!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    This key will only be shown once. Copy it and store it securely.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={showKey ? newKeyData.rawKey : "•".repeat(48)}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowKey((v) => !v)}
                      title={showKey ? "Hide" : "Show"}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <CopyButton
                      value={newKeyData.rawKey}
                      variant="outline"
                      successMessage="API key copied to clipboard!"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewKeyData(null);
                      setShowKey(false);
                    }}
                    className="text-muted-foreground"
                  >
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Keys</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y">
                {[...Array(3)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : keys.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={Key}
                  title="No active API keys"
                  description="Create a key above to authenticate your API requests."
                />
              </div>
            ) : (
              <div className="divide-y">
                {keys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}••••••••
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(key.createdAt)}
                        {key.lastUsedAt
                          ? ` · Last used ${formatDate(key.lastUsedAt)}`
                          : " · Never used"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setRevokeTarget(key.id)}
                    >
                      <ShieldOff className="mr-1.5 h-4 w-4" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revoke confirm dialog */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => {
          if (!o) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any requests using this key will immediately start failing. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeMutation.mutate()}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke Key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
