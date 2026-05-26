import { useAuth } from "./useAuth";
import { useModulosBloqueados } from "./useModulosBloqueados";
import type { ModuloPermissao, Permissoes } from "@/lib/types";

/**
 * Hook global de permissões granulares.
 * - Admin sempre vê tudo (permissoes vem como PERMISSOES_TUDO em useAuth).
 * - Para usuários comuns, lê o jsonb permissoes definido pelo admin.
 * - Módulos bloqueados globalmente (admin) somem para usuários comuns;
 *   para o admin continuam visíveis (marcados como bloqueados).
 * - Fallback legado: se não há `usuarios_perfis`, comporta como antes
 *   (admin → tudo; motorista → apenas agendamentos+checklists).
 */
export function usePermissions() {
  const { permissoes, isAdmin, role, perfil } = useAuth();
  const { isBlocked } = useModulosBloqueados();

  const fallback: Permissoes = isAdmin
    ? {
        dashboard: true, veiculos: true, motoristas: true, manutencao: true,
        abastecimento: true, agendamentos: true, checklists: true, multas: true,
        alertas: true, historico: true, usuarios: true, financeiro: true,
        solicitacoes: true, acidentes: true,
      }
    : {
        dashboard: false, veiculos: false, motoristas: false, manutencao: false,
        abastecimento: false, agendamentos: true, checklists: true, multas: false,
        alertas: false, historico: false, usuarios: false, financeiro: false,
        solicitacoes: true, acidentes: true,
      };

  const baseDefaults: Partial<Permissoes> = {
    acidentes: true,
    solicitacoes: true,
    agendamentos: true,
    checklists: true,
  };
  const p: Permissoes = permissoes
    ? { ...baseDefaults, ...permissoes } as Permissoes
    : fallback;

  const canSee = (modulo: ModuloPermissao): boolean => {
    // Módulo desativado globalmente: usuários comuns não enxergam.
    // Admin continua vendo (com indicação de bloqueado).
    if (isBlocked(modulo) && !isAdmin) return false;
    if (isAdmin) return true;
    if (permissoes && permissoes[modulo] === undefined && baseDefaults[modulo]) return true;
    return !!p[modulo];
  };
  const canSeeFinancial = (): boolean => {
    if (isBlocked("financeiro") && !isAdmin) return false;
    return isAdmin || !!p.financeiro;
  };

  return {
    permissoes: p,
    canSee,
    canSeeFinancial,
    isBlocked,
    isAdmin,
    isManagedUser: !!perfil,
    role,
  };
}
