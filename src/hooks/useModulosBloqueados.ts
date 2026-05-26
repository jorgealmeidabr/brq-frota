import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import type { ModuloPermissao } from "@/lib/types";

/**
 * Hook global para módulos desativados pelo admin.
 * Quando um módulo está em `modulos_bloqueados`, ele é totalmente
 * removido para usuários comuns. Para o admin, continua visível,
 * porém marcado como bloqueado (cadeado) e com opção de reativar.
 */
export function useModulosBloqueados() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Set<ModuloPermissao>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setBlocked(new Set()); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("modulos_bloqueados").select("modulo");
    const set = new Set<ModuloPermissao>(
      ((data ?? []) as Array<{ modulo: string }>).map(r => r.modulo as ModuloPermissao)
    );
    setBlocked(set);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = (supabase as any)
      .channel("modulos_bloqueados_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "modulos_bloqueados" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user, load]);

  const block = useCallback(async (modulo: ModuloPermissao) => {
    if (!user) return;
    await (supabase as any)
      .from("modulos_bloqueados")
      .upsert({ modulo, bloqueado_por: user.id, bloqueado_em: new Date().toISOString() });
    await load();
  }, [user, load]);

  const unblock = useCallback(async (modulo: ModuloPermissao) => {
    await (supabase as any).from("modulos_bloqueados").delete().eq("modulo", modulo);
    await load();
  }, [load]);

  const isBlocked = (m: ModuloPermissao) => blocked.has(m);

  return { blocked, isBlocked, block, unblock, loading, refresh: load };
}
