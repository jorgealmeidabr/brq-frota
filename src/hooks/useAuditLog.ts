// Log de auditoria — registra alterações em tabelas sensíveis.
// Uso: const { logAction } = useAuditLog();
//      await logAction("veiculos", id, "update", dadosAntes, dadosDepois);
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export type AuditAcao = "insert" | "update" | "delete";

export interface AuditEntry {
  id: string;
  user_id: string | null;
  tabela: string;
  registro_id: string;
  acao: AuditAcao;
  dados_antes: any;
  dados_depois: any;
  created_at: string;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (
      tabela: string,
      registro_id: string,
      acao: AuditAcao,
      dados_antes?: any,
      dados_depois?: any,
    ) => {
      if (!user?.id) return;
      await (supabase as any).from("audit_log").insert({
        user_id: user.id,
        tabela,
        registro_id,
        acao,
        dados_antes: dados_antes ?? null,
        dados_depois: dados_depois ?? null,
      });
    },
    [user?.id],
  );

  return { logAction };
}
