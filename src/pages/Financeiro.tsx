import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { downloadCSV } from "@/lib/csv";
import { fmtBRL, fmtDate, fmtNumber, nowSP } from "@/lib/format";
import type { Veiculo, Manutencao, Abastecimento, Multa, Motorista, Agendamento } from "@/lib/types";
import { DollarSign, Car, Users, Gauge, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Categoria = "manutencao" | "abastecimento" | "multa";
interface Linha {
  id: string;
  data: string;
  veiculo_id: string;
  categoria: Categoria;
  descricao: string;
  valor: number;
  motorista_id?: string | null;
}

const CAT_LABEL: Record<Categoria, string> = {
  manutencao: "Manutenção",
  abastecimento: "Abastecimento",
  multa: "Multa",
};

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export default function Financeiro() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [de, setDe] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState(today());
  const [fVeic, setFVeic] = useState("todos");
  const [fCat, setFCat] = useState<"todos" | Categoria>("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, mt, m, a, mu, ag] = await Promise.all([
        supabase.from("veiculos").select("*").order("placa"),
        supabase.from("motoristas").select("*").order("nome"),
        supabase.from("manutencoes").select("*"),
        supabase.from("abastecimentos").select("*"),
        supabase.from("multas").select("*"),
        supabase.from("agendamentos").select("*"),
      ]);
      setVeiculos((v.data ?? []) as Veiculo[]);
      setMotoristas((mt.data ?? []) as Motorista[]);
      setAgendamentos((ag.data ?? []) as Agendamento[]);
      const todasLinhas: Linha[] = [
        ...((m.data ?? []) as Manutencao[]).map((x): Linha => ({
          id: `m-${x.id}`, data: x.data, veiculo_id: x.veiculo_id,
          categoria: "manutencao",
          descricao: `${x.tipo} • ${x.oficina ?? "—"}`,
          valor: Number(x.custo_total ?? 0),
        })),
        ...((a.data ?? []) as Abastecimento[]).map((x): Linha => ({
          id: `a-${x.id}`, data: x.data, veiculo_id: x.veiculo_id,
          categoria: "abastecimento",
          descricao: `${fmtNumber(x.litros)} L • ${x.posto ?? "—"}`,
          valor: Number(x.valor_total ?? 0),
          motorista_id: x.motorista_id,
        })),
        ...((mu.data ?? []) as Multa[]).map((x): Linha => ({
          id: `mu-${x.id}`, data: x.data_infracao, veiculo_id: x.veiculo_id,
          categoria: "multa",
          descricao: x.tipo_infracao,
          valor: Number(x.valor ?? 0),
          motorista_id: x.motorista_id,
        })),
      ];
      setLinhas(todasLinhas);
      setLoading(false);
    })();
  }, []);

  const veicMap = useMemo(() => Object.fromEntries(veiculos.map(v => [v.id, v])), [veiculos]);
  const motMap = useMemo(() => Object.fromEntries(motoristas.map(m => [m.id, m.nome])), [motoristas]);

  // Inferir motorista (quando ausente) via agendamento ativo na data
  const motoristaInferido = (l: Linha): string | null => {
    if (l.motorista_id) return motMap[l.motorista_id] ?? null;
    const a = agendamentos.find(a =>
      a.veiculo_id === l.veiculo_id &&
      a.data_saida.slice(0, 10) <= l.data &&
      (a.data_retorno_real ?? a.data_retorno_prevista).slice(0, 10) >= l.data,
    );
    return a ? (motMap[a.motorista_id] ?? null) : null;
  };

  const filtradas = useMemo(() => linhas.filter(l => {
    if (de && l.data < de) return false;
    if (ate && l.data > ate) return false;
    if (fVeic !== "todos" && l.veiculo_id !== fVeic) return false;
    if (fCat !== "todos" && l.categoria !== fCat) return false;
    return true;
  }), [linhas, de, ate, fVeic, fCat]);

  // KPIs (mês corrente)
  const kpis = useMemo(() => {
    const n = nowSP();
    const ym = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    const doMes = linhas.filter(l => l.data.startsWith(ym));
    const total = doMes.reduce((s, l) => s + l.valor, 0);
    const porVeic = new Map<string, number>();
    const porMot = new Map<string, number>();
    let kmTotal = 0;
    doMes.forEach(l => porVeic.set(l.veiculo_id, (porVeic.get(l.veiculo_id) ?? 0) + l.valor));
    doMes.forEach(l => {
      const mot = l.motorista_id ?? "";
      if (mot) porMot.set(mot, (porMot.get(mot) ?? 0) + l.valor);
    });
    agendamentos.filter(a => a.km_retorno && a.km_saida && a.data_saida.startsWith(ym))
      .forEach(a => { kmTotal += (a.km_retorno! - a.km_saida!); });
    const veicMaior = [...porVeic.entries()].sort((a, b) => b[1] - a[1])[0];
    const motMaior = [...porMot.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total,
      porVeiculo: veicMaior ? { placa: veicMap[veicMaior[0]]?.placa ?? "—", valor: veicMaior[1] } : null,
      porMotorista: motMaior ? { nome: motMap[motMaior[0]] ?? "—", valor: motMaior[1] } : null,
      kmPorReal: total > 0 ? kmTotal / total : 0,
    };
  }, [linhas, agendamentos, veicMap, motMap]);

  // Gráfico: últimos 6 meses por categoria
  const chartData = useMemo(() => {
    const out: { mes: string; manutencao: number; abastecimento: number; multa: number }[] = [];
    const base = new Date(); base.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(base, -i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const slice = linhas.filter(l => l.data.startsWith(ym));
      out.push({
        mes: label,
        manutencao: slice.filter(l => l.categoria === "manutencao").reduce((s, l) => s + l.valor, 0),
        abastecimento: slice.filter(l => l.categoria === "abastecimento").reduce((s, l) => s + l.valor, 0),
        multa: slice.filter(l => l.categoria === "multa").reduce((s, l) => s + l.valor, 0),
      });
    }
    return out;
  }, [linhas]);

  const exportar = () => downloadCSV(
    `financeiro_${today()}.csv`,
    ["Data", "Veículo", "Categoria", "Descrição", "Motorista", "Valor (R$)"],
    filtradas.map(l => [
      l.data,
      veicMap[l.veiculo_id]?.placa ?? "—",
      CAT_LABEL[l.categoria],
      l.descricao,
      motoristaInferido(l) ?? "—",
      l.valor.toFixed(2).replace(".", ","),
    ]),
  );

  const totalFiltrado = filtradas.reduce((s, l) => s + l.valor, 0);

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Custos consolidados de manutenção, abastecimento e multas" />

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Custo total do mês" value={fmtBRL(kpis.total)} icon={DollarSign} tone="brand" />
        <KpiCard label="Veículo mais caro" value={kpis.porVeiculo ? `${kpis.porVeiculo.placa} — ${fmtBRL(kpis.porVeiculo.valor)}` : "—"} icon={Car} tone="warning" />
        <KpiCard label="Motorista (gasto)" value={kpis.porMotorista ? `${kpis.porMotorista.nome} — ${fmtBRL(kpis.porMotorista.valor)}` : "—"} icon={Users} tone="info" />
        <KpiCard label="Eficiência (km/R$)" value={kpis.kmPorReal > 0 ? `${fmtNumber(kpis.kmPorReal, { maximumFractionDigits: 2 })} km/R$` : "—"} icon={Gauge} tone="success" />
      </div>

      <Card className="mb-4 shadow-card">
        <CardHeader><CardTitle className="text-base">Custo mensal por categoria (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmtBRL(Number(v))} />
              <Legend />
              <Bar dataKey="manutencao" stackId="a" fill="hsl(var(--warning))" name="Manutenção" />
              <Bar dataKey="abastecimento" stackId="a" fill="hsl(var(--info))" name="Abastecimento" />
              <Bar dataKey="multa" stackId="a" fill="hsl(var(--destructive))" name="Multa" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-base">Lançamentos</CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-[150px]" /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-[150px]" /></div>
              <div>
                <Label className="text-xs">Veículo</Label>
                <Select value={fVeic} onValueChange={setFVeic}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos veículos</SelectItem>
                    {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={fCat} onValueChange={(v: any) => setFCat(v)}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="abastecimento">Abastecimento</SelectItem>
                    <SelectItem value="multa">Multa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={exportar} disabled={filtradas.length === 0}>
                <Download className="mr-1 h-4 w-4" />Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="p-10 text-center text-muted-foreground">Carregando...</p>
          : filtradas.length === 0 ? <p className="p-10 text-center text-muted-foreground">Nenhum lançamento no período.</p>
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{fmtDate(l.data)}</TableCell>
                      <TableCell className="font-mono">{veicMap[l.veiculo_id]?.placa ?? "—"}</TableCell>
                      <TableCell>{CAT_LABEL[l.categoria]}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{l.descricao}</TableCell>
                      <TableCell>{motoristaInferido(l) ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(l.valor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell colSpan={5} className="text-right">Total</TableCell>
                    <TableCell className="text-right">{fmtBRL(totalFiltrado)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
