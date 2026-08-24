"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, dismissToast, type ToastVariant } from "@/lib/use-toast";

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-card border-border text-foreground",
  success: "bg-card border-l-4 border-l-primary border-border text-foreground",
  error: "bg-card border-l-4 border-l-destructive border-border text-foreground",
  warning: "bg-card border-l-4 border-l-warning border-border text-foreground",
  info: "bg-card border-l-4 border-l-blue-500 border-border text-foreground",
};

const variantIcons: Record<ToastVariant, React.ElementType | null> = {
  default: null,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const iconColors: Record<ToastVariant, string> = {
  default: "",
  success: "text-primary",
  error: "text-destructive",
  warning: "text-warning",
  info: "text-blue-500",
};

export function Toaster() {
  const { toasts } = useToastStore();

  // Auto-dismiss
  React.useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => dismissToast(t.id), t.duration ?? 4000);
      return () => clearTimeout(timer);
    });
  }, [toasts]);

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] flex max-w-sm flex-col gap-2 w-full px-4 sm:px-0"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false} mode="sync">
        {toasts.map((t) => {
          const Icon = variantIcons[t.variant ?? "default"];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-xl border shadow-lg px-4 py-3",
                variantStyles[t.variant ?? "default"],
              )}
              role="alert"
            >
              {Icon && (
                <Icon
                  className={cn("h-5 w-5 mt-0.5 shrink-0", iconColors[t.variant ?? "default"])}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 rounded-md p-0.5 hover:bg-muted transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
