export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const brlCompact = (n: number) =>
  n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(n);

export const installments = (price: number) => {
  const n = price >= 300 ? 10 : price >= 150 ? 6 : 3;
  return { n, value: price / n };
};

export const discountPct = (price: number, old?: number) =>
  old && old > price ? Math.round((1 - price / old) * 100) : 0;

export const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(ts).toLocaleDateString("pt-BR");
};

export const fullDate = (ts: number) =>
  new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export const fmtMs = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export const maskCEP = (v: string) =>
  v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

export const maskCard = (v: string) =>
  v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

export const maskExpiry = (v: string) =>
  v.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2");

export const validCard = (v: string) => v.replace(/\D/g, "").length === 16;

export const validExpiry = (v: string) => {
  const m = v.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 0) >= new Date();
};

export const validCEP = (v: string) => /^\d{5}-\d{3}$/.test(v);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
