// Busca global (Ctrl+K) — pesquisa veículos e motoristas
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, User, Search } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Veiculo, Motorista } from "@/lib/types";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!open || veiculos.length || motoristas.length) return;
    supabase.from("veiculos").select("id, placa, modelo, marca").then(({ data }) =>
      setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("id, nome, cnh_numero").then(({ data }) =>
      setMotoristas((data ?? []) as Motorista[]));
  }, [open, veiculos.length, motoristas.length]);

  const go = (path: string) => { setOpen(false); nav(path); };

  return (
    <>
      <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}>
        <Search className="h-3.5 w-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Buscar">
        <Search className="h-4 w-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Pesquisar placa, modelo ou motorista..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {veiculos.length > 0 && (
            <CommandGroup heading="Veículos">
              {veiculos.map(v => (
                <CommandItem key={v.id} value={`${v.placa} ${v.modelo} ${v.marca}`}
                  onSelect={() => go(`/veiculos/${v.id}`)}>
                  <Car className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{v.placa}</span>
                  <span className="ml-2 text-muted-foreground">{v.marca} {v.modelo}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {motoristas.length > 0 && (
            <CommandGroup heading="Motoristas">
              {motoristas.map(m => (
                <CommandItem key={m.id} value={`${m.nome} ${m.cnh_numero}`}
                  onSelect={() => go(`/motoristas/${m.id}`)}>
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{m.nome}</span>
                  <span className="ml-2 text-muted-foreground">CNH {m.cnh_numero}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
