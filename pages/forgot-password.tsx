import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { client } from "@/lib/client";
import Link from "next/link";
import { ArrowLeft, Mail, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FormField } from "@/components/shared/FormField";
import { Spinner } from "@/components/shared/Spinner";
import { Toaster } from "@/components/ui/toaster";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

async function requestReset(email: string) {
  await client.POST("/auth/forgot-password", { body: { email } });
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: ({ email }: FormValues) => requestReset(email),
    onSuccess: () => setSent(true),
  });

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/60 via-background to-primary/5 px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-3">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CorpoPay</h1>
          </div>

          <Card className="shadow-xl border-border/50">
            <CardHeader className="pb-4">
              <CardTitle>Forgot password?</CardTitle>
              <CardDescription>
                Enter your email and we&apos;ll send you a reset link if an account exists.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              <AnimatePresence mode="wait" initial={false}>
                {sent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="text-center space-y-4 py-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
                    >
                      <Mail className="h-7 w-7 text-primary" />
                    </motion.div>
                    <div>
                      <p className="font-semibold">Check your inbox</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        If an account with that email exists, a reset link has been sent.
                      </p>
                    </div>
                    <Button asChild className="w-full" size="lg">
                      <Link href="/login">Back to login</Link>
                    </Button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSubmit((d) => mutation.mutate(d))}
                    className="space-y-4"
                  >
                    <FormField label="Email" htmlFor="email" error={errors.email?.message}>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.ma"
                        autoComplete="email"
                        {...register("email")}
                      />
                    </FormField>

                    {mutation.isError && (
                      <p className="text-xs text-destructive text-center">
                        Something went wrong. Please try again.
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Sending…
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>

                    <Button asChild variant="ghost" className="w-full" size="sm">
                      <Link href="/login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to login
                      </Link>
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <Toaster />
    </>
  );
}
