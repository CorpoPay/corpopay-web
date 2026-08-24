import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type UserRole = "OWNER" | "STAFF" | "SUPPORT_ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  environment: string;
}

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser, tenant: AuthTenant) => void;
  logout: () => void;
  isAdmin: boolean;
  isMerchant: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    token: null,
    isLoading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem("cp_token");
    const userRaw = localStorage.getItem("cp_user");
    const tenantRaw = localStorage.getItem("cp_tenant");
    if (token && userRaw && tenantRaw) {
      setState({
        token,
        user: JSON.parse(userRaw) as AuthUser,
        tenant: JSON.parse(tenantRaw) as AuthTenant,
        isLoading: false,
      });
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  function login(token: string, user: AuthUser, tenant: AuthTenant) {
    localStorage.setItem("cp_token", token);
    localStorage.setItem("cp_user", JSON.stringify(user));
    localStorage.setItem("cp_tenant", JSON.stringify(tenant));
    setState({ token, user, tenant, isLoading: false });
  }

  function logout() {
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_user");
    localStorage.removeItem("cp_tenant");
    setState({ token: null, user: null, tenant: null, isLoading: false });
  }

  const isAdmin = state.user?.role === "SUPPORT_ADMIN" || state.user?.role === "SUPER_ADMIN";
  const isMerchant = state.user?.role === "OWNER" || state.user?.role === "STAFF";

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAdmin, isMerchant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
