// Persistência DB dos alertas dispensados (tabela alerts_dismissed).
// Mantém a mesma interface anterior (isDismissed, dismiss, dismissMany,
// restore, clearAll) para compatibilidade com o código existente.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const EVENT_NAME = "brq:dismissed-alerts:changed";

export function useDismissedAlerts() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!user?.id) { setDismissed(new Set()); return; }
    const { data } = await (supabase as any)
      .from("alerts_dismissed")
      .select("alert_key")
      .eq("user_id", user.id);
    setDismissed(new Set((data ?? []).map((r: any) => r.alert_key)));
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const sync = () => reload();
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, [reload]);

  const dismiss = useCallback(async (id: string) => {
    if (!user?.id) return;
    setDismissed(prev => new Set(prev).add(id)); // otimista
    const { error } = await (supabase as any)
      .from("alerts_dismissed")
      .upsert({ user_id: user.id, alert_key: id }, { onConflict: "user_id,alert_key" });
    if (error) await reload();
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [user?.id, reload]);

  const dismissMany = useCallback(async (ids: string[]) => {
    if (!user?.id || ids.length === 0) return;
    setDismissed(prev => { const n = new Set(prev); ids.forEach(i => n.add(i)); return n; });
    const rows = ids.map(alert_key => ({ user_id: user.id, alert_key }));
    const { error } = await (supabase as any)
      .from("alerts_dismissed")
      .upsert(rows, { onConflict: "user_id,alert_key" });
    if (error) await reload();
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [user?.id, reload]);

  const restore = useCallback(async (id: string) => {
    if (!user?.id) return;
    setDismissed(prev => { const n = new Set(prev); n.delete(id); return n; });
    const { error } = await (supabase as any)
      .from("alerts_dismissed")
      .delete()
      .eq("user_id", user.id)
      .eq("alert_key", id);
    if (error) await reload();
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [user?.id, reload]);

  const clearAll = useCallback(async () => {
    if (!user?.id) return;
    setDismissed(new Set());
    const { error } = await (supabase as any)
      .from("alerts_dismissed")
      .delete()
      .eq("user_id", user.id);
    if (error) await reload();
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [user?.id, reload]);

  const isDismissed = useCallback(
    (id: string) => dismissed.has(id),
    [dismissed],
  );

  return { dismissed, isDismissed, dismiss, dismissMany, restore, clearAll };
}
