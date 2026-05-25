import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useBlockedModules } from "@/hooks/useBlockedModules";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ModuloPermissao } from "@/lib/types";
import PendingApproval from "@/pages/PendingApproval";
import { ModuloBloqueadoPage } from "@/pages/ModuloBloqueado";
import { AppLayout } from "@/components/AppLayout";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePerm?: ModuloPermissao;
}

export function ProtectedRoute({ children, requireAdmin, requirePerm }: Props) {
  const { user, loading, isAdmin, mustChangePassword, profileStatus } = useAuth();
  const { canSee } = usePermissions();
  const { isBlocked, loading: blockedLoading } = useBlockedModules();
  const location = useLocation();

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (profileStatus === "pendente" || profileStatus === "rejeitado") {
    return <PendingApproval status={profileStatus} />;
  }

  if (mustChangePassword && location.pathname !== "/setup-senha") {
    return <Navigate to="/setup-senha" replace />;
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/agendamentos" replace />;
  if (requirePerm && !canSee(requirePerm)) return <Navigate to="/agendamentos" replace />;

  // Kill-switch global: módulo bloqueado
  if (requirePerm && !blockedLoading && isBlocked(requirePerm)) {
    if (!isAdmin) return <Navigate to="/agendamentos" replace />;
    return <AppLayout><ModuloBloqueadoPage modulo={requirePerm} /></AppLayout>;
  }

  return <>{children}</>;
}
