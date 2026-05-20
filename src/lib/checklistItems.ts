// Lista fixa de itens visuais do checklist pós-uso.
export type ChecklistItemStatus = "ok" | "problema" | "nao_verificado";

export interface ChecklistItem {
  nome: string;
  status: ChecklistItemStatus;
}

export const CHECKLIST_ITENS_PADRAO: string[] = [
  "Pneus",
  "Freios",
  "Lanternas",
  "Retrovisores",
  "Limpadores de parabrisa",
];

export const itensIniciais = (): ChecklistItem[] =>
  CHECKLIST_ITENS_PADRAO.map((nome) => ({ nome, status: "nao_verificado" }));

export const statusGeralDosItens = (
  itens: ChecklistItem[],
): "ok" | "problema" =>
  itens.some((i) => i.status === "problema") ? "problema" : "ok";

export const STATUS_LABEL: Record<ChecklistItemStatus, string> = {
  ok: "OK",
  problema: "Problema",
  nao_verificado: "Não verificado",
};
