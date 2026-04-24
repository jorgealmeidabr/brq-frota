import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin }: Props) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return <Navigate to="/setup" replace />;
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/agendamentos" replace />;
  }
  return <>{children}</>;
}
