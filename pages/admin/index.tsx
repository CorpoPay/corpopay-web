import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function AdminIndex() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      // Not loaded yet
      return;
    }
    if (!user) {
      router.replace("/login");
    } else if (isAdmin) {
      router.replace("/admin/tenants");
    } else {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  return null;
}
