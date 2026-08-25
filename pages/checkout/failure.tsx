import { XCircle } from "lucide-react";
import { motion } from "motion/react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutFailurePage() {
  const router = useRouter();
  const { slug, reason } = router.query;

  return (
    <>
      <Head>
        <title>Payment Failed — CorpoPay</title>
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
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
              >
                <XCircle className="h-8 w-8 text-destructive" />
              </motion.div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold">Payment Failed</h1>
                <p className="text-sm text-muted-foreground">
                  {reason
                    ? decodeURIComponent(reason as string)
                    : "Your payment could not be processed. Please try again."}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                {slug ? (
                  <Button asChild className="w-full">
                    <Link href={`/checkout/${slug}`}>Try Again</Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => router.back()}>
                    Go Back
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Need help?{" "}
                <a href="mailto:support@example.com" className="underline">
                  Contact support
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
