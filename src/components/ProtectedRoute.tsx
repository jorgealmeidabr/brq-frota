import { cloneElement, isValidElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useModulosBloqueados } from "@/hooks/useModulosBloqueados";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ModuloPermissao } from "@/lib/types";
import PendingApproval from "@/pages/PendingApproval";
import { BlockedModuleScreen } from "@/components/BlockedModuleScreen";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePerm?: ModuloPermissao;
}

export function ProtectedRoute({ children, requireAdmin, requirePerm }: Props) {
  const { user, loading, isAdmin, mustChangePassword, profileStatus } = useAuth();
  const { canSee } = usePermissions();
  const { isBlocked } = useModulosBloqueados();
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

  // Módulo bloqueado globalmente: admin vê tela de bloqueio com opção de reativar;
  // usuários comuns são redirecionados (o item nem aparece no menu).
  if (requirePerm && isBlocked(requirePerm)) {
    if (isAdmin) return <>{wrapBlocked(children, requirePerm)}</>;
    return <Navigate to="/agendamentos" replace />;
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/agendamentos" replace />;
  if (requirePerm && !canSee(requirePerm)) return <Navigate to="/agendamentos" replace />;

  return <>{children}</>;
}

// Mantém o AppLayout em volta do BlockedModuleScreen (o children já vem envolto pelo Protected wrapper)
function wrapBlocked(children: React.ReactNode, modulo: ModuloPermissao) {
  if (isValidElement(children)) {
    return cloneElement(children as React.ReactElement<any>, undefined, <BlockedModuleScreen modulo={modulo} />);
  }
  return <BlockedModuleScreen modulo={modulo} />;
}
