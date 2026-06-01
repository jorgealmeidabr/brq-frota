import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ModuloPermissao } from "@/lib/types";

export const MODULE_LOCKS_EVENT = "module-locks-changed";

type LockMap = Partial<Record<ModuloPermissao, boolean>>;

let cache: LockMap = {};
let loaded = false;

async function fetchLocks(): Promise<LockMap> {
  const { data, error } = await (supabase as any)
    .from("modulos_bloqueados")
    .select("modulo,bloqueado");
  if (error) return cache; // tabela ainda não criada → assume nada bloqueado
  const map: LockMap = {};
  ((data ?? []) as Array<{ modulo: string; bloqueado: boolean }>).forEach(r => {
    map[r.modulo as ModuloPermissao] = !!r.bloqueado;
  });
  cache = map;
  loaded = true;
  return map;
}

export function useModuleLocks() {
  const [locks, setLocks] = useState<LockMap>(cache);
  const [ready, setReady] = useState(loaded);

  const refresh = useCallback(async () => {
    const map = await fetchLocks();
    setLocks({ ...map });
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(MODULE_LOCKS_EVENT, onChange);
    return () => window.removeEventListener(MODULE_LOCKS_EVENT, onChange);
  }, [refresh]);

  const isLocked = useCallback(
    (modulo?: ModuloPermissao | null) => (modulo ? !!locks[modulo] : false),
    [locks],
  );

  const setLock = useCallback(async (modulo: ModuloPermissao, bloqueado: boolean) => {
    const { data: au } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("modulos_bloqueados")
      .upsert({ modulo, bloqueado, updated_at: new Date().toISOString(), updated_by: au?.user?.id ?? null }, { onConflict: "modulo" });
    if (!error) {
      cache = { ...cache, [modulo]: bloqueado };
      window.dispatchEvent(new Event(MODULE_LOCKS_EVENT));
    }
    return { error: error?.message ?? null };
  }, []);

  return { locks, isLocked, setLock, refresh, ready };
}
