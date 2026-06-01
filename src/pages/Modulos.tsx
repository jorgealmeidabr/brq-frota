import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useModuleLocks } from "@/hooks/useModuleLocks";
import type { ModuloPermissao } from "@/lib/types";
import {
  LayoutDashboard, Car, Users as UsersIcon, Wrench, Fuel, CalendarRange,
  ClipboardCheck, AlertTriangle, Bell, History, DollarSign, FileText,
  AlertOctagon, Lock, LockOpen,
} from "lucide-react";

const MODULES: Array<{ key: ModuloPermissao; label: string; icon: any }> = [
  { key: "dashboard",     label: "Dashboard",            icon: LayoutDashboard },
  { key: "veiculos",      label: "Veículos",             icon: Car },
  { key: "motoristas",    label: "Pessoas / Motoristas", icon: UsersIcon },
  { key: "manutencao",    label: "Manutenção",           icon: Wrench },
  { key: "abastecimento", label: "Abastecimento",        icon: Fuel },
  { key: "agendamentos",  label: "Agendamentos",         icon: CalendarRange },
  { key: "checklists",    label: "Checklists",           icon: ClipboardCheck },
  { key: "solicitacoes",  label: "Solicitações",         icon: FileText },
  { key: "acidentes",     label: "Acidentes",            icon: AlertOctagon },
  { key: "multas",        label: "Multas",               icon: AlertTriangle },
  { key: "financeiro",    label: "Financeiro",           icon: DollarSign },
  { key: "alertas",       label: "Alertas",              icon: Bell },
  { key: "historico",     label: "Histórico / Logs",     icon: History },
];

export default function Modulos() {
  const { isLocked, setLock } = useModuleLocks();
  const { toast } = useToast();

  const handleToggle = async (modulo: ModuloPermissao, nowLocked: boolean) => {
    const { error } = await setLock(modulo, nowLocked);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error, variant: "destructive" });
      return;
    }
    toast({ title: nowLocked ? "Módulo bloqueado" : "Módulo liberado" });
  };

  return (
    <>
      <PageHeader
        title="Módulos"
        subtitle="Bloqueie módulos em implantação — eles ficam ocultos para os usuários e aparecem com cadeado para administradores."
      />
      <Card className="shadow-card">
        <CardContent className="divide-y divide-border p-0">
          {MODULES.map(m => {
            const locked = isLocked(m.key);
            return (
              <div key={m.key} className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <m.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {locked ? "Bloqueado — oculto para usuários" : "Liberado — visível conforme permissões"}
                  </p>
                </div>
                {locked ? (
                  <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Bloqueado</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><LockOpen className="h-3 w-3" /> Liberado</Badge>
                )}
                <Switch checked={locked} onCheckedChange={(v) => handleToggle(m.key, v)} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
