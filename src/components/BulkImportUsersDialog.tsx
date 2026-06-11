import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { validarEmail } from "@/lib/validators";
import { PERMISSOES_DEFAULT } from "@/lib/types";
import { Download, Upload, Eye, EyeOff, FileSpreadsheet, Check, X, AlertTriangle, SkipForward } from "lucide-react";

interface ParsedRow {
  nome: string;
  email: string;
}

interface ResultItem {
  nome: string;
  email: string;
  status: "criado" | "ignorado" | "erro";
  motivo?: string;
}

const norm = (s: any) => String(s ?? "").trim();

function pickColumns(raw: Record<string, any>[]): ParsedRow[] {
  return raw.map((r) => {
    const keys = Object.keys(r);
    const nomeKey = keys.find((k) => /^(nome|name)$/i.test(k.trim()));
    const emailKey = keys.find((k) => /^(e-?mail|email)$/i.test(k.trim()));
    return {
      nome: norm(nomeKey ? r[nomeKey] : ""),
      email: norm(emailKey ? r[emailKey] : "").toLowerCase(),
    };
  });
}

export function BulkImportUsersDialog({
  open, onOpenChange, existingEmails, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingEmails: string[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultItem[] | null>(null);

  const reset = () => {
    setFileName(""); setRows([]); setSenha(""); setResults(null);
    setProgress(0); setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "E-mail"],
      ["João da Silva", "joao.silva@empresa.com"],
      ["Maria Souza", "maria.souza@empresa.com"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "modelo_importacao_usuarios.xlsx");
  };

  const handleFile = async (file: File | null) => {
    setResults(null);
    if (!file) { setRows([]); setFileName(""); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const parsed = pickColumns(raw).filter((r) => r.nome || r.email);
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length === 0) toast({ title: "Nenhum registro encontrado na planilha", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: e.message, variant: "destructive" });
    }
  };

  const importar = async () => {
    if (rows.length === 0) return toast({ title: "Selecione uma planilha", variant: "destructive" });
    if (senha.length < 8) return toast({ title: "A senha padrão deve ter ao menos 8 caracteres", variant: "destructive" });

    setImporting(true);
    setProgress(0);
    const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
    const seen = new Set<string>();
    const out: ResultItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.nome || r.nome.length < 2) {
          out.push({ nome: r.nome, email: r.email, status: "erro", motivo: "Nome inválido" });
        } else if (!r.email || validarEmail(r.email)) {
          out.push({ nome: r.nome, email: r.email, status: "erro", motivo: "E-mail inválido" });
        } else if (existing.has(r.email) || seen.has(r.email)) {
          out.push({ nome: r.nome, email: r.email, status: "ignorado", motivo: "E-mail já existente" });
        } else {
          const { error } = await (supabase as any).functions.invoke("admin-create-user", {
            body: {
              email: r.email,
              senha,
              nome: r.nome,
              cargo: "Colaborador",
              tipo_conta: "usuario",
              permissoes: PERMISSOES_DEFAULT,
            },
          });
          if (error) {
            out.push({ nome: r.nome, email: r.email, status: "erro", motivo: error.message });
          } else {
            seen.add(r.email);
            out.push({ nome: r.nome, email: r.email, status: "criado" });
          }
        }
      } catch (e: any) {
        out.push({ nome: r.nome, email: r.email, status: "erro", motivo: e.message });
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResults(out);
    setImporting(false);
    onDone();
  };

  const criados = results?.filter((r) => r.status === "criado").length ?? 0;
  const ignorados = results?.filter((r) => r.status === "ignorado").length ?? 0;
  const erros = results?.filter((r) => r.status === "erro").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importação em massa de usuários</DialogTitle>
          <DialogDescription>
            Importe uma planilha (Excel ou CSV) com as colunas <strong>Nome</strong> e <strong>E-mail</strong>.
            Todos os usuários serão criados com a senha padrão informada.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={baixarModelo} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Baixar modelo de planilha
            </Button>

            <div className="space-y-1.5">
              <Label className="text-xs">Planilha (.xlsx, .xls ou .csv)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={importing}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {fileName && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> {fileName} — <strong>{rows.length}</strong> registro(s)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Senha padrão (mínimo 8 caracteres) *</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={senha}
                  disabled={importing}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pr-10"
                  placeholder="Será usada por todos os usuários importados"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Os usuários deverão trocar a senha no primeiro acesso.</p>
            </div>

            {importing && (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-center text-xs text-muted-foreground">Importando... {progress}%</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Processados" value={results.length} icon={FileSpreadsheet} />
              <SummaryCard label="Criados" value={criados} icon={Check} tone="success" />
              <SummaryCard label="Ignorados" value={ignorados} icon={SkipForward} tone="warning" />
              <SummaryCard label="Erros" value={erros} icon={AlertTriangle} tone="destructive" />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">E-mail</th>
                    <th className="px-3 py-2 text-left">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{r.nome || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-3 py-2">
                        {r.status === "criado" ? (
                          <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/15"><Check className="mr-1 h-3 w-3" />Criado</Badge>
                        ) : r.status === "ignorado" ? (
                          <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/15"><SkipForward className="mr-1 h-3 w-3" />{r.motivo}</Badge>
                        ) : (
                          <Badge className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/15"><X className="mr-1 h-3 w-3" />{r.motivo}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!results ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
              <Button variant="brand" onClick={importar} disabled={importing || rows.length === 0}>
                <Upload className="mr-1 h-4 w-4" />
                {importing ? "Importando..." : `Importar ${rows.length || ""} usuário(s)`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>Importar outra planilha</Button>
              <Button variant="brand" onClick={() => onOpenChange(false)}>Concluir</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone?: "success" | "warning" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
