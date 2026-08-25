import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const { ref } = router.query;

  return (
    <>
      <Head>
        <title>Payment Successful — CorpoPay</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardContent className="pt-10 pb-8 text-center space-y-5">
              <motion.div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
              >
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </motion.div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold">Payment Successful</h1>
                <p className="text-sm text-muted-foreground">
                  Your payment has been processed. You will receive a confirmation email shortly.
                </p>
              </div>
              {ref && (
                <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1">
                  Reference: {ref}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Secured by <span className="font-semibold text-foreground">CorpoPay</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
