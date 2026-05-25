import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { ModuloPermissao } from "@/lib/types";

/**
 * Lista global de módulos bloqueados (kill-switch).
 * Tabela: public.modulos_bloqueados (modulo, bloqueado).
 */
export function useBlockedModules() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Set<ModuloPermissao>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setBlocked(new Set()); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("modulos_bloqueados")
      .select("modulo, bloqueado");
    const s = new Set<ModuloPermissao>();
    (data ?? []).forEach((r: any) => { if (r.bloqueado) s.add(r.modulo as ModuloPermissao); });
    setBlocked(s);
    setLoading(false);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!user) return;
    const ch = (supabase as any)
      .channel("modulos_bloqueados_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "modulos_bloqueados" }, () => { void reload(); })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user, reload]);

  const isBlocked = (m: ModuloPermissao) => blocked.has(m);

  const setModuleBlocked = async (modulo: ModuloPermissao, value: boolean) => {
    if (!user) return { error: "Sem sessão" };
    const { error } = await (supabase as any)
      .from("modulos_bloqueados")
      .upsert({ modulo, bloqueado: value, updated_at: new Date().toISOString(), updated_by: user.id });
    if (!error) await reload();
    return { error: error?.message ?? null };
  };

  return { blocked, isBlocked, setModuleBlocked, loading, reload };
}
