import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { uploadFiles } from "@/lib/storage";
import { formatarTelefone, validarTelefone } from "@/lib/validators";
import type { Motorista, ModuloPermissao } from "@/lib/types";
import { Lock, Check, X, Camera } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

const MOD_LABELS: Record<ModuloPermissao, string> = {
  dashboard: "Dashboard", veiculos: "Veículos", motoristas: "Pessoas",
  manutencao: "Manutenção", abastecimento: "Abastecimento",
  agendamentos: "Agendamentos", checklists: "Checklists",
  multas: "Multas", alertas: "Alertas", historico: "Histórico",
  usuarios: "Usuários", financeiro: "Valores financeiros",
  solicitacoes: "Solicitações", acidentes: "Acidentes",
};

export default function MeuPerfil() {
  const { user, perfil, tipoConta, refreshPerfil } = useAuth();
  const { permissoes, canSee } = usePermissions();
  const { toast } = useToast();
  const [mot, setMot] = useState<Motorista | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ p1: "", p2: "" });

  useEffect(() => {
    (async () => {
      if (!user) return;
      let q = supabase.from("motoristas").select("*").eq("user_id", user.id).limit(1);
      const { data } = await q;
      let m = ((data ?? []) as Motorista[])[0];
      if (!m && perfil?.motorista_id) {
        const { data: d2 } = await supabase.from("motoristas").select("*").eq("id", perfil.motorista_id).maybeSingle();
        m = (d2 as Motorista) ?? null;
      }
      setMot(m ?? null);
      setLoading(false);
    })();
  }, [user, perfil]);

  const updateField = (k: keyof Motorista, v: any) => setMot(m => m ? { ...m, [k]: v } : m);

  const salvar = async () => {
    if (!mot) return;
    if (mot.telefone && validarTelefone(mot.telefone)) return toast({ title: "Telefone inválido", variant: "destructive" });
    setSaving(true);
    const { error } = await (supabase as any).from("motoristas").update({
      nome: mot.nome, telefone: mot.telefone, cargo: mot.cargo, foto_url: mot.foto_url,
    }).eq("id", mot.id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Perfil atualizado" });
  };

  const trocarFoto = async (file: File | null) => {
    if (!file) return;
    try {
      const [url] = await uploadFiles("motoristas", [file]);
      updateField("foto_url", url);
      toast({ title: "Foto enviada – clique em Salvar" });
    } catch (e: any) {
      toast({ title: "Erro upload", description: e.message, variant: "destructive" });
    }
  };

  const trocarSenha = async () => {
    if (pwd.p1.length < 8) return toast({ title: "Senha mínima 8 caracteres", variant: "destructive" });
    if (pwd.p1 !== pwd.p2) return toast({ title: "Senhas não conferem", variant: "destructive" });
    const { error } = await supabase.auth.updateUser({ password: pwd.p1 });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Senha alterada" }); setPwd({ p1: "", p2: "" }); }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados, senha e o que você pode acessar" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={mot?.foto_url ?? undefined} />
                <AvatarFallback className="text-xl">{(mot?.nome ?? user?.email ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <Label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={e => trocarFoto(e.target.files?.[0] ?? null)} />
                  <Button asChild variant="outline" size="sm"><span><Camera className="mr-1 h-4 w-4" />Trocar foto</span></Button>
                </Label>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={mot?.nome ?? ""} onChange={e => updateField("nome", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={mot?.telefone ?? ""} onChange={e => updateField("telefone", formatarTelefone(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={mot?.cargo ?? ""} onChange={e => updateField("cargo", e.target.value)} />
              </div>
            </div>
            <Button onClick={salvar} disabled={saving} variant="brand">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
