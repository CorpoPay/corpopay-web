import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import {
  Building2,
  CreditCard,
  Webhook,
  Activity,
  LogOut,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/payments", label: "Payment Search", icon: CreditCard },
  { href: "/admin/webhooks", label: "Webhook Logs", icon: Webhook },
  { href: "/admin/providers", label: "Provider Health", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Redirect non-admins away
    if (user && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  if (!user || !isAdmin) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="admin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 flex-col flex border-r bg-card transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b px-4 gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 shrink-0">
            <ShieldAlert className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">CorpoPay Admin</span>
          <button
            className="ml-auto rounded-md p-1 hover:bg-muted transition-colors lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = router.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 overflow-hidden ${
                  active
                    ? "text-orange-700"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="admin-active-nav"
                    className="absolute inset-0 rounded-lg bg-orange-100"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className="relative h-4 w-4 shrink-0" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <Separator />
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 space-y-0.5">
            <p className="text-xs font-medium truncate">{user.email}</p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {user.role?.toLowerCase().replace(/_/g, " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8"
            onClick={logout}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile topbar */}
        <header className="flex h-14 shrink-0 items-center border-b px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-2 text-sm font-semibold">Admin</span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
