import { useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Minus, Plus, Star, X } from "lucide-react";
import { useStore } from "../context/Store";
import { brl, installments } from "../utils";
import type { OrderStatus } from "../types";

/* ---------- logo ---------- */
export function Logo({ light = true, small = false }: { light?: boolean; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 select-none">
      <svg viewBox="0 0 34 32" className={small ? "h-6 w-6" : "h-7 w-7"} aria-hidden>
        <circle cx="13" cy="17" r="9.5" fill={light ? "#f4f7f9" : "#16222e"} />
        <path d="M19 6.5c7 .6 11.5 6.4 11.5 10.4 0 2.2-3.4 3.3-11.5 3.1V6.5Z" fill="#ff9e1b" />
        <path d="M19 6.5c7 .6 11.5 6.4 11.5 10.4H19V6.5Z" fill="#ffb84d" />
        <circle cx="13.5" cy="13.6" r="2" fill="#16222e" />
        <circle cx="14.2" cy="12.9" r="0.7" fill="#fff" />
      </svg>
      <span
        className={`font-display font-extrabold tracking-tight ${small ? "text-lg" : "text-[22px]"} ${
          light ? "text-white" : "text-ink-900"
        }`}
      >
        tucano
      </span>
    </span>
  );
}

/* ---------- estrelas ---------- */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (cls: string) => (
    <span className={`flex gap-[1.5px] ${cls}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className="shrink-0" fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
  return (
    <span className="relative inline-block leading-none" aria-label={`${value} de 5 estrelas`}>
      {row("text-ink-200")}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("text-accent-500")}
      </span>
    </span>
  );
}

export function RatingLine({ rating, count, size = 13 }: { rating: number; count: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
      <Stars value={rating} size={size} />
      <span className="font-semibold text-ink-700">{rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</span>
      <span>({count.toLocaleString("pt-BR")})</span>
    </span>
  );
}

/* ---------- preço ---------- */
export function Price({
  price,
  old,
  big = false,
}: {
  price: number;
  old?: number;
  big?: boolean;
}) {
  const inst = installments(price);
  return (
    <div>
      {old && old > price && (
        <div className="text-[12px] text-ink-400 line-through">{brl(old)}</div>
      )}
      <div className={`font-display font-extrabold text-ink-900 ${big ? "text-[32px] leading-tight" : "text-[19px]"}`}>
        {brl(price)}
      </div>
      <div className={`text-turbo-700 ${big ? "text-[13.5px]" : "text-[12px]"} font-medium`}>
        em {inst.n}x de {brl(inst.value)} sem juros
      </div>
    </div>
  );
}

/* ---------- status do pedido ---------- */
const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  confirmado: { label: "Confirmado", cls: "bg-turbo-100 text-turbo-700" },
  preparando: { label: "Em separação", cls: "bg-warn-100 text-warn-700" },
  enviado: { label: "Enviado", cls: "bg-accent-100 text-accent-600" },
  entregue: { label: "Entregue", cls: "bg-ok-100 text-ok-700" },
  cancelado: { label: "Cancelado", cls: "bg-danger-100 text-danger-700" },
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${m.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

/* ---------- seletor de quantidade ---------- */
export function QtyStepper({
  qty,
  onChange,
  max = 99,
  small = false,
}: {
  qty: number;
  onChange: (q: number) => void;
  max?: number;
  small?: boolean;
}) {
  const btn = `flex items-center justify-center rounded-md border border-ink-200 bg-card text-ink-700 transition hover:bg-ink-50 active:scale-90 disabled:opacity-35 ${
    small ? "h-7 w-7" : "h-9 w-9"
  }`;
  return (
    <div className="inline-flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(qty - 1)} aria-label="Diminuir quantidade">
        <Minus size={small ? 13 : 15} />
      </button>
      <span className={`text-center font-bold tabular-nums ${small ? "w-6 text-[13px]" : "w-8 text-[15px]"}`}>{qty}</span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, qty + 1))}
        disabled={qty >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus size={small ? 13 : 15} />
      </button>
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button className="absolute inset-0 bg-ink-950/60 animate-fadein" onClick={onClose} aria-label="Fechar" />
      <div
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[88vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lift animate-rise sm:rounded-2xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- estado vazio ---------- */
export function EmptyState({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-card px-6 py-14 text-center animate-fadein">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-ink-400">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink-800">{title}</h3>
      <p className="mt-1 max-w-sm text-[14px] text-ink-500">{desc}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------- skeleton ---------- */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-card">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-6 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ---------- toasts ---------- */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const icons = {
    ok: <CheckCircle2 size={17} className="text-ok-100" />,
    err: <AlertCircle size={17} className="text-danger-100" />,
    info: <Info size={17} className="text-accent-100" />,
  };
  const bars = { ok: "bg-ok-600", err: "bg-danger-600", info: "bg-accent-500" };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-xl bg-ink-900 py-3 pl-3 pr-4 text-left text-[13.5px] font-medium text-ink-50 shadow-lift animate-rise"
        >
          <span className={`h-8 w-1 shrink-0 rounded-full ${bars[t.kind]}`} />
          {icons[t.kind]}
          <span className="leading-snug">{t.msg}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- letreiro de benefícios ---------- */
const TICKER_ITEMS = [
  "Frete grátis acima de R$ 149",
  "Até 10x sem juros",
  "Entrega Turbo em até 2h nas capitais",
  "Troca grátis em 30 dias",
  "5% de desconto no Pix",
  "Compra 100% protegida",
];

export function Ticker() {
  return (
    <div className="overflow-hidden bg-accent-500 py-1.5" aria-hidden>
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
        {[0, 1].map((dup) => (
          <span key={dup} className="flex gap-8">
            {TICKER_ITEMS.map((t, i) => (
              <span key={i} className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-wide text-ink-900">
                <svg viewBox="0 0 8 8" className="h-2 w-2 fill-ink-900">
                  <path d="M4 0l1.2 2.8L8 4 5.2 5.2 4 8 2.8 5.2 0 4l2.8-1.2z" />
                </svg>
                {t}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
