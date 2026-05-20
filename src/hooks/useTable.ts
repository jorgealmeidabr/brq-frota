import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface AuditOptions {
  audit?: boolean;
}

async function logAudit(
  tabela: string,
  registro_id: string,
  acao: "insert" | "update" | "delete",
  dados_antes?: any,
  dados_depois?: any,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("audit_log").insert({
      user_id: user.id, tabela, registro_id, acao,
      dados_antes: dados_antes ?? null,
      dados_depois: dados_depois ?? null,
    });
  } catch { /* ignora — auditoria não deve quebrar a operação */ }
}

export function useTable<T extends { id: string }>(table: string, opts: AuditOptions = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table as any).select("*").order("created_at", { ascending: false });
    if (error) toast({ title: `Erro ao carregar ${table}`, description: error.message, variant: "destructive" });
    setRows((data ?? []) as T[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const id = setInterval(reload, 10_000);
    return () => clearInterval(id);
    /* eslint-disable-next-line */
  }, [table]);

  const insert = async (values: Partial<T>) => {
    const { data, error } = await (supabase.from(table as any) as any).insert(values).select().single();
    if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); throw error; }
    if (opts.audit && data?.id) await logAudit(table, data.id, "insert", null, data);
    toast({ title: "Registro criado" }); await reload();
  };
  const update = async (id: string, values: Partial<T>) => {
    const antes = opts.audit ? rows.find(r => r.id === id) : null;
    const { error } = await (supabase.from(table as any) as any).update(values).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); throw error; }
    if (opts.audit) await logAudit(table, id, "update", antes, { ...(antes ?? {}), ...values });
    toast({ title: "Atualizado" }); await reload();
  };
  const remove = async (id: string) => {
    const antes = opts.audit ? rows.find(r => r.id === id) : null;
    const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    if (opts.audit) await logAudit(table, id, "delete", antes, null);
    toast({ title: "Removido" }); await reload();
  };

  return { rows, loading, reload, insert, update, remove };
}
