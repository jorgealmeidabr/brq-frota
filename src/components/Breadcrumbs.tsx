import { Link, useLocation } from "react-router-dom";
import { Fragment } from "react";
import { Home, ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  "": "Dashboard",
  veiculos: "Veículos",
  motoristas: "Motoristas",
  manutencoes: "Manutenções",
  abastecimentos: "Abastecimentos",
  agendamentos: "Agendamentos",
  checklists: "Checklists",
  multas: "Multas",
  historico: "Histórico",
  alertas: "Alertas",
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
        <span>Início</span>
      </Link>
      {parts.map((p, i) => {
        const path = "/" + parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        const label = LABELS[p] ?? decodeURIComponent(p);
        const isId = !LABELS[p] && p.length > 8; // IDs longos = "Detalhe"
        return (
          <Fragment key={path}>
            <ChevronRight className="h-3.5 w-3.5" />
            {isLast ? (
              <span className="font-medium text-foreground">{isId ? "Detalhe" : label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground">{isId ? "Detalhe" : label}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
