import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck,
  ChevronRight,
  Heart,
  PackageX,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { api } from "../api/client";
import { useStore } from "../context/Store";
import type { Product, Review } from "../types";
import ProductCard from "../components/ProductCard";
import { EmptyState, Modal, Price, QtyStepper, RatingLine, Stars } from "../components/ui";
import { brl, discountPct, timeAgo } from "../utils";
import seed from "../data/catalog.json";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  (seed.categories as { id: string; label: string }[]).map((c) => [c.id, c.label]),
);

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star size={26} className={(hover || value) >= n ? "text-accent-500" : "text-ink-200"} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ productId, onDone, onClose }: { productId: string; onDone: () => void; onClose: () => void }) {
  const { token, toast } = useStore();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.addReview(token, productId, { rating, title, text });
      toast("Avaliação publicada. Obrigado!");
      onDone();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="field-label">Sua nota</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="field-label" htmlFor="rv-title">Título</label>
        <input id="rv-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resuma sua experiência" maxLength={80} />
      </div>
      <div>
        <label className="field-label" htmlFor="rv-text">Comentário</label>
        <textarea id="rv-text" className="field min-h-24 resize-y" value={text} onChange={(e) => setText(e.target.value)} placeholder="O que achou da qualidade, entrega, custo-benefício…" maxLength={600} />
      </div>
      <button type="submit" disabled={saving} className="btn-accent w-full">
        {saving ? "Publicando…" : "Publicar avaliação"}
      </button>
    </form>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { addToCart, toggleWish, isWished, user, token, toast } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQtyLocal] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const load = () => {
    if (!id) return;
    setProduct(null);
    setReviews(null);
    setNotFound(false);
    api.getProduct(id).then(setProduct).catch(() => setNotFound(true));
    api.listReviews(id).then(setReviews);
  };

  useEffect(load, [id]);

  const related = useMemo(() => {
    if (!product) return null;
    return api.listProducts().then((all) => all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 6));
  }, [product]);
  const [relatedList, setRelatedList] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    setRelatedList(null);
    related?.then((r) => alive && setRelatedList(r));
    return () => {
      alive = false;
    };
  }, [related]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={<PackageX size={28} />} title="Produto não encontrado" desc="Este item pode ter sido removido do catálogo ou o link está incorreto.">
          <Link to="/busca" className="btn-accent">Explorar catálogo</Link>
        </EmptyState>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="skeleton aspect-square" />
          <div className="space-y-3">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-16 w-48" />
            <div className="skeleton h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const pct = discountPct(product.price, product.oldPrice);
  const out = product.stock < 1;
  const wished = isWished(product.id);
  const cat = CAT_LABEL[product.category] ?? product.category;

  const hist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: (reviews ?? []).filter((r) => r.rating === n).length,
  }));
  const histMax = Math.max(1, ...hist.map((h) => h.count));

  const onAdd = () => {
    if (addToCart(product, qty)) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    }
  };
  const buyNow = () => {
    addToCart(product, qty, { silent: true });
    nav("/checkout");
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      {/* breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-[12.5px] font-medium text-ink-400">
        <Link to="/" className="hover:text-turbo-700 hover:underline">Início</Link>
        <ChevronRight size={13} />
        <Link to={`/busca?cat=${product.category}`} className="hover:text-turbo-700 hover:underline">{cat}</Link>
        <ChevronRight size={13} />
        <span className="truncate text-ink-600">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* imagem */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-card shadow-card">
            <div className="aspect-square overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 ${out ? "opacity-50 saturate-0" : ""}`}
              />
            </div>
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {pct > 0 && <span className="rounded-lg bg-danger-600 px-2.5 py-1 text-[13px] font-extrabold text-white">-{pct}% OFF</span>}
              {product.turbo && (
                <span className="flex w-fit items-center gap-1 rounded-lg bg-turbo-600 px-2.5 py-1 text-[11.5px] font-extrabold uppercase text-white">
                  <Zap size={11} fill="currentColor" strokeWidth={0} /> Entrega Turbo
                </span>
              )}
            </div>
            <button
              onClick={() => toggleWish(product)}
              aria-label="Favoritar"
              className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition active:scale-90 ${
                wished ? "border-danger-600/30 bg-danger-100 text-danger-600" : "border-ink-100 bg-card text-ink-400 hover:text-danger-600"
              }`}
            >
              <Heart size={18} fill={wished ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: <Truck size={17} />, t: "Frete grátis", s: "acima de R$ 149" },
              { icon: <RotateCcw size={17} />, t: "Troca grátis", s: "em até 30 dias" },
              { icon: <ShieldCheck size={17} />, t: "Compra segura", s: "proteção Tucano" },
            ].map((b) => (
              <div key={b.t} className="rounded-xl border border-ink-100 bg-card px-2 py-3">
                <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-turbo-100 text-turbo-700">{b.icon}</span>
                <p className="mt-1.5 text-[11.5px] font-bold text-ink-700">{b.t}</p>
                <p className="text-[10.5px] text-ink-400">{b.s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* infos + buy box */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink-900 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-accent-400">{product.brand}</span>
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-bold text-ink-500">{cat}</span>
          </div>
          <h1 className="mt-2.5 font-display text-[24px] font-extrabold leading-tight text-ink-950 md:text-[30px]">{product.name}</h1>

          <button
            onClick={() => document.getElementById("avaliacoes")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-2 inline-block transition hover:opacity-75"
          >
            <RatingLine rating={product.rating} count={product.ratingCount} size={15} />
          </button>

          <div className="mt-4 rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Price price={product.price} old={product.oldPrice} big />
              <span className="rounded-lg bg-ok-100 px-2.5 py-1.5 text-[12.5px] font-extrabold text-ok-700">
                {brl(product.price * 0.95)} no Pix
              </span>
            </div>

            <div className="mt-3 border-t border-dashed border-ink-200 pt-3">
              {product.turbo && !out && (
                <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-turbo-700">
                  <Zap size={14} fill="currentColor" strokeWidth={0} /> Entrega Turbo: receba hoje em até 2h (capitais)
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500">
                <Truck size={15} /> Frete grátis para todo o Brasil
              </p>
              {out ? (
                <p className="mt-2 flex items-center gap-1.5 text-[14px] font-extrabold text-danger-600">
                  <PackageX size={15} /> Esgotado — avise-me quando voltar
                </p>
              ) : product.stock <= 5 ? (
                <p className="mt-2 flex items-center gap-1.5 text-[14px] font-extrabold text-warn-600">
                  <BadgeCheck size={15} /> Em estoque — restam só {product.stock} unidades!
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-[14px] font-extrabold text-ok-600">
                  <BadgeCheck size={15} /> Em estoque
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <QtyStepper qty={qty} onChange={(q) => setQtyLocal(Math.max(1, q))} max={Math.max(1, product.stock)} />
              <button onClick={onAdd} disabled={out} className={`btn-accent flex-1 !py-3 min-w-40 ${added ? "!bg-ok-600 !text-white" : ""}`}>
                {added ? "Adicionado!" : out ? "Indisponível" : "Adicionar ao carrinho"}
              </button>
            </div>
            <button onClick={buyNow} disabled={out} className="btn-dark mt-2.5 w-full !py-3">
              Comprar agora
            </button>
            {!user && (
              <button onClick={() => { addToCart(product, qty, { silent: true }); nav("/entrar?r=/checkout"); }} disabled={out} className="mt-2 w-full text-center text-[12.5px] font-semibold text-turbo-700 hover:underline">
                ou entre para finalizar em 1 clique →
              </button>
            )}
          </div>

          <div className="mt-6">
            <h2 className="font-display text-[18px] font-extrabold text-ink-900">Sobre este item</h2>
            <ul className="mt-2.5 space-y-2">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-ink-700">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-ink-50 p-4 text-[14px] leading-relaxed text-ink-600">{product.description}</p>
          </div>
        </div>
      </div>

      {/* avaliações */}
      <section id="avaliacoes" className="mt-12 grid gap-6 scroll-mt-36 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card lg:sticky lg:top-32 lg:self-start">
          <h2 className="font-display text-[18px] font-extrabold text-ink-900">Avaliações</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-[42px] font-extrabold leading-none text-ink-950">
              {product.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
            </span>
            <div>
              <Stars value={product.rating} size={17} />
              <p className="mt-0.5 text-[12.5px] font-medium text-ink-400">{product.ratingCount.toLocaleString("pt-BR")} avaliações globais</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {hist.map((h) => (
              <div key={h.n} className="flex items-center gap-2 text-[12px] font-semibold text-ink-500">
                <span className="w-3">{h.n}</span>
                <Star size={11} className="text-accent-500" fill="currentColor" strokeWidth={0} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-accent-500 transition-all duration-700" style={{ width: `${(h.count / histMax) * 100}%` }} />
                </div>
                <span className="w-5 text-right">{h.count}</span>
              </div>
            ))}
          </div>
          {user ? (
            <button onClick={() => setFormOpen(true)} className="btn-dark mt-5 w-full">
              Avaliar este produto
            </button>
          ) : (
            <button onClick={() => nav(`/entrar?r=/produto/${product.id}`)} className="btn-ghost mt-5 w-full">
              Entre para avaliar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {reviews === null ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)
          ) : reviews.length === 0 ? (
            <EmptyState icon={<Star size={26} />} title="Ainda sem avaliações" desc="Seja a primeira pessoa a contar como foi a experiência com este produto." />
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="rounded-xl border border-ink-100 bg-card p-4 transition hover:border-ink-200 hover:shadow-card animate-fadein">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 font-display text-[13px] font-extrabold text-accent-400">
                      {r.user.charAt(0)}
                    </span>
                    <span className="text-[13.5px] font-bold text-ink-800">{r.user}</span>
                    <BadgeCheck size={14} className="text-turbo-600" />
                  </span>
                  <span className="text-[11.5px] font-medium text-ink-400">{timeAgo(r.date)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Stars value={r.rating} size={13} />
                  <h3 className="text-[14px] font-bold text-ink-900">{r.title}</h3>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{r.text}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* relacionados */}
      <section className="mt-12">
        <h2 className="font-display text-[21px] font-extrabold text-ink-900">Quem viu este item também viu</h2>
        {relatedList === null ? (
          <div className="mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-72 w-44 shrink-0" />
            ))}
          </div>
        ) : relatedList.length === 0 ? null : (
          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar">
            {relatedList.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start sm:w-56">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Sua avaliação">
        <ReviewForm productId={product.id} onDone={load} onClose={() => setFormOpen(false)} />
      </Modal>
    </div>
  );
}
