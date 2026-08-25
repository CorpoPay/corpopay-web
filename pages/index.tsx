import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        const isAdmin = user.role === "SUPPORT_ADMIN" || user.role === "SUPER_ADMIN";
        router.replace(isAdmin ? "/admin" : "/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
