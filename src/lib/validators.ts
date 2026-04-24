// Validadores e formatadores de campos comuns

// Placa formato Mercosul (AAA1A23) ou antigo (AAA-1234 / AAA1234)
const PLACA_RE = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/;
export const validarPlaca = (v: string): string | null => {
  const clean = v.toUpperCase().trim();
  if (!clean) return "Placa é obrigatória";
  if (!PLACA_RE.test(clean)) return "Formato inválido (AAA-0000 ou AAA0A00)";
  return null;
};
export const formatarPlaca = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);

// CNH: 11 dígitos
export const validarCNH = (v: string): string | null => {
  const clean = v.replace(/\D/g, "");
  if (!clean) return "CNH é obrigatória";
  if (clean.length !== 11) return "CNH deve ter 11 dígitos";
  return null;
};
export const formatarCNH = (v: string) => v.replace(/\D/g, "").slice(0, 11);

// Email simples
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validarEmail = (v: string): string | null => {
  if (!v) return null; // opcional na maioria dos formulários
  if (!EMAIL_RE.test(v)) return "E-mail inválido";
  return null;
};

// Telefone (10 ou 11 dígitos)
export const validarTelefone = (v: string): string | null => {
  if (!v) return null;
  const clean = v.replace(/\D/g, "");
  if (clean.length < 10 || clean.length > 11) return "Telefone inválido";
  return null;
};
export const formatarTelefone = (v: string) => {
  const c = v.replace(/\D/g, "").slice(0, 11);
  if (c.length <= 10) return c.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  return c.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
};

// Ano de veículo
export const validarAno = (v: number | string): string | null => {
  const n = Number(v);
  const cur = new Date().getFullYear();
  if (!n) return "Ano é obrigatório";
  if (n < 1950 || n > cur + 1) return `Ano deve estar entre 1950 e ${cur + 1}`;
  return null;
};
