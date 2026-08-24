import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { AnimatePresence, motion } from "framer-motion";
import DatadogInit from "@/components/datadog-init";
import "@/styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <DatadogInit />
      <AuthProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.route}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ minHeight: "100%" }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </AuthProvider>
    </QueryClientProvider>
  );
}
