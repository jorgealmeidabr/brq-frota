import { Lock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { fmtBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  value: number | null | undefined;
  className?: string;
  /** Quando false, ignora o cadeado e sempre exibe (use só quando o admin sabe que está OK). */
  enforce?: boolean;
  /** Texto custom; default formata em BRL. */
  format?: (n: number) => string;
}

/**
 * Renderiza um valor monetário respeitando a permissão `financeiro`.
 * Se o usuário não tem permissão, mostra "••••" com ícone de cadeado.
 * Nunca expõe o número no DOM neste caso.
 */
export function Money({ value, className, enforce = true, format = fmtBRL }: MoneyProps) {
  const { canSeeFinancial } = usePermissions();
  if (enforce && !canSeeFinancial()) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-mono text-muted-foreground", className)} title="Você não tem permissão para ver valores financeiros">
        <Lock className="h-3 w-3" />
        ••••
      </span>
    );
  }
  return <span className={className}>{format(value ?? 0)}</span>;
}

/**
 * Wrapper genérico: oculta qualquer conteúdo quando o usuário não pode ver financeiro.
 */
export function FinancialOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canSeeFinancial } = usePermissions();
  return <>{canSeeFinancial() ? children : fallback}</>;
}
