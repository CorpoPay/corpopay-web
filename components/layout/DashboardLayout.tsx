import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Building2,
  CreditCard,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  ListOrdered,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { type ReactNode, useEffect } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { AvatarInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/payment-links", label: "Payment Links", icon: Link2 },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { href: "/dashboard/installment-plans", label: "Installment Plans", icon: Layers },
  { href: "/dashboard/installments", label: "Installments", icon: ListOrdered },
  { href: "/dashboard/transactions", label: "Transactions", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/docs", label: "Documentation", icon: BookOpen },
];

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user, tenant, logout, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Building2 className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <span className="font-bold text-base tracking-tight">CorpoPay</span>
          <button
            className="ml-auto rounded-md p-1 hover:bg-muted transition-colors lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tenant */}
        <div className="border-b px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-0.5">
            Workspace
          </p>
          <p className="truncate font-semibold text-sm">{tenant?.name}</p>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider",
              tenant?.environment === "PRODUCTION" ? "text-primary" : "text-amber-600",
            )}
          >
            {tenant?.environment}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = router.pathname === href || router.pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 overflow-hidden",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="dashboard-active-nav"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative h-4 w-4 shrink-0" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 mb-1">
            <AvatarInitials name={user.email} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{tenant?.name ?? user.email}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {user.role?.toLowerCase().replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-8"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <button
            className="rounded-md p-1.5 hover:bg-muted transition-colors lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {title && <h1 className="text-sm font-semibold lg:hidden">{title}</h1>}
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* Snackbar portal */}
      <Toaster />
    </div>
  );
}
