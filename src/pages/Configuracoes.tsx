import { useState } from "react";
import { Lock, Unlock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { useModulosBloqueados } from "@/hooks/useModulosBloqueados";
import { useToast } from "@/hooks/use-toast";
import type { ModuloPermissao } from "@/lib/types";

const MODULOS: Array<{ key: ModuloPermissao; titulo: string; descricao: string }> = [
  { key: "dashboard",    titulo: "Dashboard",     descricao: "Painel principal com indicadores." },
  { key: "veiculos",     titulo: "Veículos",      descricao: "Cadastro e gestão da frota." },
  { key: "motoristas",   titulo: "Pessoas",       descricao: "Cadastro de motoristas/pessoas." },
  { key: "manutencao",   titulo: "Manutenção",    descricao: "Ordens e histórico de manutenção." },
  { key: "abastecimento",titulo: "Abastecimento", descricao: "Registros de abastecimento." },
  { key: "agendamentos", titulo: "Agendamentos",  descricao: "Reservas de veículos." },
  { key: "checklists",   titulo: "Checklists",    descricao: "Checklists de veículos." },
  { key: "multas",       titulo: "Multas",        descricao: "Multas de trânsito." },
  { key: "alertas",      titulo: "Alertas",       descricao: "Alertas do sistema." },
  { key: "historico",    titulo: "Histórico",     descricao: "Linha do tempo de eventos." },
  { key: "financeiro",   titulo: "Financeiro",    descricao: "Valores e custos." },
  { key: "solicitacoes", titulo: "Solicitações",  descricao: "Pedidos dos usuários." },
  { key: "acidentes",    titulo: "Acidentes",     descricao: "Registro de ocorrências." },
  { key: "usuarios",     titulo: "Usuários",      descricao: "Gestão de contas de acesso." },
];

export default function Configuracoes() {
  const { isBlocked, block, unblock, loading } = useModulosBloqueados();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (m: ModuloPermissao, titulo: string) => {
    setPending(m);
    try {
      if (isBlocked(m)) {
        await unblock(m);
        toast({ title: "Módulo reativado", description: `${titulo} está disponível novamente.` });
      } else {
        await block(m);
        toast({ title: "Módulo bloqueado", description: `${titulo} foi desativado para todos.` });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao alterar.", variant: "destructive" });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configurações"
        description="Ative ou desative módulos do sistema. Os módulos desativados deixam de existir para os demais usuários."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Módulos do sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {MODULOS.map(m => {
            const blocked = isBlocked(m.key);
            return (
              <div key={m.key} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {blocked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-success" />}
                    <span className="font-medium">{m.titulo}</span>
                    {blocked && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.descricao}</p>
                </div>
                <Switch
                  checked={!blocked}
                  disabled={pending === m.key}
                  onCheckedChange={() => toggle(m.key, m.titulo)}
                  aria-label={`Ativar ou desativar ${m.titulo}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
