import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth, type AuthUser } from "@/lib/auth";
import { client, getErrorMessage } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/FormField";
import { Spinner } from "@/components/shared/Spinner";
import { toast } from "@/lib/use-toast";
import { Toaster } from "@/components/ui/toaster";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    const { data, error } = await client.POST("/auth/login", { body: values });
    if (error || !data) {
      toast.error("Sign in failed", getErrorMessage(error));
      return;
    }
    login(data.token, data.user as AuthUser, data.tenant);
    toast.success("Welcome back!", "Redirecting to your dashboard…");
    const isAdmin = data.user.role === "SUPPORT_ADMIN" || data.user.role === "SUPER_ADMIN";
    router.push(isAdmin ? "/admin" : "/dashboard");
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted/60 via-background to-primary/5 p-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="w-full max-w-sm"
        >
          <Card className="shadow-xl border-border/50">
            <CardHeader className="space-y-1 text-center pt-8 pb-4">
              <div className="flex justify-center mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Sign in to CorpoPay</CardTitle>
              <CardDescription>Enter your email and password to continue</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField label="Email" htmlFor="email" error={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.ma"
                    autoComplete="email"
                    {...register("email")}
                  />
                </FormField>
                <FormField
                  htmlFor="password"
                  error={errors.password?.message}
                  label={
                    (
                      <span className="flex items-center justify-between w-full">
                        Password
                        <Link
                          href="/forgot-password"
                          className="text-xs font-normal text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </span>
                    ) as any
                  }
                >
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                </FormField>
                <Button type="submit" className="w-full mt-2" disabled={isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Create one
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <Toaster />
    </>
  );
}
