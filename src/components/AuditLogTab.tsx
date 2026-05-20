// Aba reutilizável para exibir o histórico de auditoria de um registro.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";
import type { AuditEntry } from "@/hooks/useAuditLog";
import { History } from "lucide-react";

interface Props {
  tabela: string;
  registroId: string;
}

const ACAO_VARIANT: Record<string, string> = {
  insert: "bg-success/15 text-success border-success/30",
  update: "bg-info/15 text-info border-info/30",
  delete: "bg-destructive/15 text-destructive border-destructive/30",
};

function diff(antes: any, depois: any): { campo: string; de: any; para: any }[] {
  const out: { campo: string; de: any; para: any }[] = [];
  if (!antes && depois) {
    return Object.entries(depois).map(([k, v]) => ({ campo: k, de: null, para: v }));
  }
  if (antes && !depois) {
    return Object.entries(antes).map(([k, v]) => ({ campo: k, de: v, para: null }));
  }
  if (!antes && !depois) return out;
  const keys = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  keys.forEach((k) => {
    const a = antes?.[k];
    const b = depois?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ campo: k, de: a, para: b });
    }
  });
  return out;
}

function fmtValor(v: any): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AuditLogTab({ tabela, registroId }: Props) {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("audit_log")
        .select("*")
        .eq("tabela", tabela)
        .eq("registro_id", registroId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancel) return;
      const entries = (data ?? []) as AuditEntry[];
      setRows(entries);
      const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.nome || p.email || p.id.slice(0, 8); });
        setUsers(map);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [tabela, registroId]);

  const ordered = useMemo(() => rows, [rows]);

  if (loading) {
    return <p className="p-6 text-center text-muted-foreground">Carregando histórico...</p>;
  }
  if (ordered.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
          <History className="h-8 w-8" />
          <p>Nenhuma alteração registrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {ordered.map((r) => {
        const mudancas = diff(r.dados_antes, r.dados_depois);
        return (
          <li key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className={ACAO_VARIANT[r.acao] ?? ""}>{r.acao}</Badge>
              <span className="font-medium">{users[r.user_id ?? ""] ?? "Sistema"}</span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
            </div>
            {mudancas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium">Campo</th>
                      <th className="text-left font-medium">De</th>
                      <th className="text-left font-medium">Para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mudancas.slice(0, 25).map((m) => (
                      <tr key={m.campo} className="border-t border-border/60">
                        <td className="py-1 pr-2 font-mono">{m.campo}</td>
                        <td className="py-1 pr-2 text-muted-foreground line-through">{fmtValor(m.de)}</td>
                        <td className="py-1 pr-2">{fmtValor(m.para)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem alterações de campo detectadas.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
