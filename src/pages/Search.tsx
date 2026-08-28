import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterX, SearchX, SlidersHorizontal, Star, X } from "lucide-react";
import { api } from "../api/client";
import type { Product } from "../types";
import ProductCard from "../components/ProductCard";
import { EmptyState, SkeletonGrid, Stars } from "../components/ui";
import seed from "../data/catalog.json";

const CATS = seed.categories as { id: string; label: string }[];

function FilterPanel({
  params,
  setParam,
  min,
  max,
  setMin,
  setMax,
  minRating,
  setMinRating,
  inStock,
  setInStock,
  clearAll,
}: {
  params: URLSearchParams;
  setParam: (k: string, v: string | null) => void;
  min: string;
  max: string;
  setMin: (v: string) => void;
  setMax: (v: string) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  inStock: boolean;
  setInStock: (v: boolean) => void;
  clearAll: () => void;
}) {
  const cat = params.get("cat");
  const oferta = params.get("oferta") === "1";
  const section = "mb-5";
  const label = "mb-2 block text-[11.5px] font-extrabold uppercase tracking-wider text-ink-400";
  const radio = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition ${
      active ? "bg-accent-50 font-bold text-ink-900 ring-1 ring-accent-400" : "text-ink-600 hover:bg-ink-50"
    }`;

  return (
    <div className="space-y-0">
      <div className={section}>
        <span className={label}>Categoria</span>
        <button className={radio(!cat)} onClick={() => setParam("cat", null)}>
          Todas as categorias
        </button>
        {CATS.map((c) => (
          <button key={c.id} className={radio(cat === c.id)} onClick={() => setParam("cat", cat === c.id ? null : c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className={section}>
        <span className={label}>Preço (R$)</span>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder="mín" className="field !py-2 text-[13.5px]" aria-label="Preço mínimo" />
          <span className="text-ink-300">—</span>
          <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} placeholder="máx" className="field !py-2 text-[13.5px]" aria-label="Preço máximo" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[[0, 150], [150, 300], [300, 500]].map(([a, b]) => (
            <button
              key={a}
              onClick={() => {
                setMin(a ? String(a) : "");
                setMax(String(b));
              }}
              className="rounded-full border border-ink-200 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 transition hover:border-accent-400 hover:text-ink-800"
            >
              {a === 0 ? `até ${b}` : `${a}–${b}`}
            </button>
          ))}
        </div>
      </div>

      <div className={section}>
        <span className={label}>Avaliação mínima</span>
        {[4.5, 4, 3].map((r) => (
          <button key={r} className={radio(minRating === r)} onClick={() => setMinRating(minRating === r ? 0 : r)}>
            <Stars value={r} size={13} /> <span>{r}+ estrelas</span>
          </button>
        ))}
      </div>

      <div className={section}>
        <span className={label}>Disponibilidade & ofertas</span>
        <label className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-600 transition hover:bg-ink-50">
          Somente em estoque
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-4 w-4 accent-[#ff9e1b]" />
        </label>
        <button className={radio(oferta)} onClick={() => setParam("oferta", oferta ? null : "1")}>
          <Star size={14} className="text-accent-500" fill="currentColor" strokeWidth={0} /> Com desconto
        </button>
      </div>

      <button onClick={clearAll} className="btn-ghost w-full !py-2 !text-[13px]">
        <FilterX size={15} /> Limpar filtros
      </button>
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const [minRating, setMinRating] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    let alive = true;
    api.listProducts().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);

  const setParam = (k: string, v: string | null) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
        return p;
      },
      { replace: false },
    );
  };

  // aplica preço na URL com debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (min) p.set("min", min);
          else p.delete("min");
          if (max) p.set("max", max);
          else p.delete("max");
          return p;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  const q = (params.get("q") ?? "").trim();
  const cat = params.get("cat");
  const oferta = params.get("oferta") === "1";
  const ordem = params.get("ordem") ?? "relevancia";

  const filtered = useMemo(() => {
    if (!products) return null;
    const ql = q.toLowerCase();
    let list = products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (oferta && !(p.oldPrice && p.oldPrice > p.price)) return false;
      if (min && p.price < Number(min)) return false;
      if (max && p.price > Number(max)) return false;
      if (minRating && p.rating < minRating) return false;
      if (inStock && p.stock < 1) return false;
      if (ql) {
        const hay = [p.name, p.brand, p.category, p.short, ...p.tags].join(" ").toLowerCase();
        if (!ql.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const byOrdem: Record<string, (a: Product, b: Product) => number> = {
      relevancia: (a, b) => b.rating * Math.log10(b.ratingCount + 1) - a.rating * Math.log10(a.ratingCount + 1),
      "preco-asc": (a, b) => a.price - b.price,
      "preco-desc": (a, b) => b.price - a.price,
      avaliacao: (a, b) => b.ratingCount - a.ratingCount,
      recentes: (a, b) => b.createdAt - a.createdAt,
    };
    list = [...list].sort(byOrdem[ordem] ?? byOrdem.relevancia);
    return list;
  }, [products, q, cat, oferta, min, max, minRating, inStock, ordem]);

  const activeChips: { label: string; clear: () => void }[] = [];
  if (q) activeChips.push({ label: `“${q}”`, clear: () => setParam("q", null) });
  if (cat) activeChips.push({ label: CATS.find((c) => c.id === cat)?.label ?? cat, clear: () => setParam("cat", null) });
  if (oferta) activeChips.push({ label: "Com desconto", clear: () => setParam("oferta", null) });
  if (min || max) activeChips.push({ label: `R$ ${min || "0"} – ${max || "∞"}`, clear: () => { setMin(""); setMax(""); } });
  if (minRating) activeChips.push({ label: `${minRating}+ estrelas`, clear: () => setMinRating(0) });
  if (inStock) activeChips.push({ label: "Em estoque", clear: () => setInStock(false) });

  const clearAll = () => {
    setMin("");
    setMax("");
    setMinRating(0);
    setInStock(false);
    setParams(new URLSearchParams(), { replace: false });
  };

  const catLabel = cat ? CATS.find((c) => c.id === cat)?.label : null;
  const title = q ? `Resultados para “${q}”` : catLabel ?? (oferta ? "Ofertas do dia" : "Todo o catálogo");

  const filterPanelProps = {
    params, setParam, min, max, setMin, setMax, minRating, setMinRating, inStock, setInStock, clearAll,
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold text-ink-900 md:text-[28px]">{title}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-ink-400">
            {filtered ? `${filtered.length} produto${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}` : "buscando produtos…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDrawer(true)} className="btn-ghost !py-2 !text-[13px] lg:hidden">
            <SlidersHorizontal size={15} /> Filtrar{activeChips.length > 0 && ` (${activeChips.length})`}
          </button>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
            <span className="hidden sm:block">Ordenar:</span>
            <select
              value={ordem}
              onChange={(e) => setParam("ordem", e.target.value === "relevancia" ? null : e.target.value)}
              className="field w-auto !py-2 !text-[13px] font-semibold"
            >
              <option value="relevancia">Relevância</option>
              <option value="preco-asc">Menor preço</option>
              <option value="preco-desc">Maior preço</option>
              <option value="avaliacao">Mais avaliados</option>
              <option value="recentes">Novidades</option>
            </select>
          </label>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {activeChips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="group flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-danger-600"
            >
              {c.label} <X size={12} className="opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          <button onClick={clearAll} className="rounded-full px-3 py-1.5 text-[12px] font-bold text-turbo-700 transition hover:underline">
            limpar tudo
          </button>
        </div>
      )}

      <div className="flex gap-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-32 rounded-xl border border-ink-100 bg-card p-4">
            <FilterPanel {...filterPanelProps} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {filtered === null ? (
            <SkeletonGrid n={8} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX size={28} />}
              title="Nenhum produto encontrado"
              desc={q ? `Não achamos nada para “${q}” com esses filtros. Tente outra palavra ou limpe os filtros.` : "Nenhum item corresponde aos filtros escolhidos."}
            >
              <button onClick={clearAll} className="btn-accent">Limpar filtros</button>
              <Link to="/" className="btn-ghost">Voltar ao início</Link>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* drawer de filtros (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button className="absolute inset-0 bg-ink-950/60 animate-fadein" onClick={() => setDrawer(false)} aria-label="Fechar filtros" />
          <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto bg-card p-5 shadow-lift animate-drawer">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Filtros</h2>
              <button onClick={() => setDrawer(false)} className="rounded-full p-1.5 text-ink-400 hover:bg-ink-50" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <FilterPanel {...filterPanelProps} />
            <button onClick={() => setDrawer(false)} className="btn-accent mt-4 w-full">
              Ver {filtered?.length ?? 0} resultado{(filtered?.length ?? 0) === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
