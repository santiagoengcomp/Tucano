import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { api } from "../api/client";
import type { Product } from "../types";
import ProductCard from "../components/ProductCard";
import { SkeletonGrid, Ticker } from "../components/ui";
import { useCategories } from "../api/useCategories";

function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    api.listProducts().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);
  return products;
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

const BANNERS = [
  {
    chip: "Semana Tech · até domingo",
    title: "Eletrônicos com até 30% OFF",
    sub: "Fones, smartwatches e caixas de som com Entrega Turbo.",
    cta: "Aproveitar ofertas",
    to: "/busca?cat=eletronicos&oferta=1",
    image: "/images/p1.jpg",
    tone: "from-ink-900 via-ink-800 to-turbo-700",
  },
  {
    chip: "Casa & Cozinha",
    title: "Sua cozinha nível cafeteria",
    sub: "Espresso 20 bar, air fryer e mais com frete grátis acima de R$ 149.",
    cta: "Ver seleção",
    to: "/busca?cat=casa",
    image: "/images/p4.jpg",
    tone: "from-ink-900 via-ink-800 to-accent-600",
  },
  {
    chip: "Entrega Turbo",
    title: "Chega hoje, em até 2h",
    sub: "Nas capitais, itens Turbo chegam antes do seu café esfriar.",
    cta: "Quero Turbo",
    to: "/busca?oferta=1",
    image: "/images/p8.jpg",
    tone: "from-ink-900 via-ink-800 to-danger-700",
  },
];

function Banner() {
  const [i, setI] = useState(0);
  const hover = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      if (!hover.current) setI((v) => (v + 1) % BANNERS.length);
    }, 5600);
    return () => clearInterval(t);
  }, []);
  const b = BANNERS[i];
  return (
    <section
      className="relative overflow-hidden rounded-2xl text-white shadow-lift"
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
    >
      <div className={`bg-gradient-to-r ${b.tone} transition-all duration-700`}>
        <div className="grid items-center gap-4 px-6 py-8 md:grid-cols-2 md:px-10 md:py-10">
          <div key={i} className="animate-rise">
            <span className="inline-block rounded-full bg-white/12 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-accent-400 ring-1 ring-white/15">
              {b.chip}
            </span>
            <h1 className="mt-3 font-display text-[28px] font-extrabold leading-[1.05] md:text-[40px]">{b.title}</h1>
            <p className="mt-2 max-w-md text-[14px] text-ink-100 md:text-[15px]">{b.sub}</p>
            <Link to={b.to} className="btn-accent mt-5 !px-6">
              {b.cta} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative hidden justify-center md:flex">
            <div className="absolute inset-0 m-auto h-52 w-52 rounded-full bg-accent-500/20 blur-2xl" />
            <img
              key={b.image}
              src={b.image}
              alt=""
              className="relative h-52 w-52 animate-fadein rounded-2xl border-4 border-white/15 object-cover shadow-lift lg:h-60 lg:w-60"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => setI((i - 1 + BANNERS.length) % BANNERS.length)}
        className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white transition hover:bg-black/45 md:flex"
        aria-label="Banner anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => setI((i + 1) % BANNERS.length)}
        className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white transition hover:bg-black/45 md:flex"
        aria-label="Próximo banner"
      >
        <ChevronRight size={18} />
      </button>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, d) => (
          <button
            key={d}
            onClick={() => setI(d)}
            aria-label={`Ir para banner ${d + 1}`}
            className={`h-1.5 rounded-full transition-all ${d === i ? "w-6 bg-accent-500" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </section>
  );
}

function SectionHead({ icon, title, right }: { icon?: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-[21px] font-extrabold text-ink-900 md:text-[24px]">
        {icon}
        {title}
      </h2>
      {right}
    </div>
  );
}

export default function Home() {
  const products = useProducts();
  const now = useNow();

  const endOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);
  const left = Math.max(0, endOfDay - now);
  const h = Math.floor(left / 3600000);
  const mm = Math.floor((left % 3600000) / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  const deals = useMemo(() => (products ?? []).filter((p) => p.oldPrice && p.oldPrice > p.price), [products]);
  const best = useMemo(() => [...(products ?? [])].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 8), [products]);
  const recs = useMemo(() => [...(products ?? [])].sort((a, b) => b.rating - a.rating), [products]);
  const cats = useCategories();

  return (
    <div className="animate-fadein">
      <Ticker />

      <div className="mx-auto max-w-7xl space-y-10 px-3 py-5 md:px-6 md:py-8">
        <Banner />

        {/* categorias */}
        <section>
          <SectionHead title="Comprar por categoria" />
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar md:grid md:grid-cols-5">
            {cats.map((c) => {
              const sample = (products ?? []).find((p) => p.category === c.id);
              const count = (products ?? []).filter((p) => p.category === c.id).length;
              return (
                <Link
                  key={c.id}
                  to={`/busca?cat=${c.id}`}
                  className="group flex min-w-[108px] shrink-0 flex-col items-center gap-2 rounded-xl border border-ink-100 bg-card p-3 transition hover:-translate-y-1 hover:border-accent-400 hover:shadow-lift"
                >
                  <span className="flex h-16 w-16 overflow-hidden rounded-full bg-ink-50 ring-2 ring-ink-100 transition group-hover:ring-accent-400">
                    {sample ? (
                      <img src={sample.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <span className="skeleton h-full w-full rounded-none" />
                    )}
                  </span>
                  <span className="text-center text-[12.5px] font-bold leading-tight text-ink-700 group-hover:text-ink-900">
                    {c.label}
                    <span className="block text-[10.5px] font-medium text-ink-400">{count ? `${count} itens` : "carregando…"}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ofertas relâmpago */}
        <section>
          <SectionHead
            icon={<Flame size={22} className="text-danger-600" />}
            title="Ofertas relâmpago"
            right={
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ink-900 px-2 py-1 font-mono text-[13px] font-bold tabular-nums text-accent-400">
                  {String(h).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
                <Link to="/busca?oferta=1" className="hidden text-[13px] font-bold text-turbo-700 hover:underline sm:block">
                  ver todas
                </Link>
              </div>
            }
          />
          {products ? (
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar">
              {deals.map((p) => (
                <div key={p.id} className="w-44 shrink-0 snap-start sm:w-56">
                  <ProductCard product={p} />
                </div>
              ))}
              <Link
                to="/busca?oferta=1"
                className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 text-ink-400 transition hover:border-accent-400 hover:text-accent-600"
              >
                <ArrowRight size={22} />
                <span className="text-[12.5px] font-bold">Ver todas</span>
              </Link>
            </div>
          ) : (
            <SkeletonGrid n={4} />
          )}
        </section>

        {/* mais vendidos */}
        <section>
          <SectionHead
            icon={<Trophy size={22} className="text-accent-500" />}
            title="Mais vendidos"
            right={
              <span className="hidden text-[12.5px] font-semibold text-ink-400 sm:block">ranking por vendas</span>
            }
          />
          {products ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {best.map((p, i) => (
                <ProductCard key={p.id} product={p} rank={i + 1} />
              ))}
            </div>
          ) : (
            <SkeletonGrid />
          )}
        </section>

        {/* recomendados */}
        <section>
          <SectionHead title="Recomendados para você" />
          {products ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recs.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <SkeletonGrid />
          )}
        </section>
      </div>
    </div>
  );
}
