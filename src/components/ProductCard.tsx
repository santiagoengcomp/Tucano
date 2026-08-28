import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Zap } from "lucide-react";
import type { Product } from "../types";
import { useStore } from "../context/Store";
import { discountPct } from "../utils";
import { Price, RatingLine } from "./ui";

export default function ProductCard({ product, rank }: { product: Product; rank?: number }) {
  const { addToCart, toggleWish, isWished } = useStore();
  const [added, setAdded] = useState(false);
  const pct = discountPct(product.price, product.oldPrice);
  const out = product.stock < 1;
  const wished = isWished(product.id);

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (addToCart(product)) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    }
  };

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-ink-100 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-ink-200 hover:shadow-lift animate-fadein"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06] ${out ? "opacity-45 saturate-0" : ""}`}
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {pct > 0 && (
            <span className="rounded-md bg-danger-600 px-1.5 py-0.5 text-[11.5px] font-extrabold text-white">-{pct}%</span>
          )}
          {product.turbo && !out && (
            <span className="flex items-center gap-0.5 rounded-md bg-turbo-600 px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase text-white">
              <Zap size={10} fill="currentColor" strokeWidth={0} /> Turbo
            </span>
          )}
        </div>
        {rank !== undefined && (
          <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 font-display text-[13px] font-extrabold text-accent-400">
            {rank}
          </span>
        )}
        {out && (
          <span className="absolute bottom-2 left-2 rounded-md bg-ink-800/90 px-2 py-0.5 text-[11.5px] font-bold text-white">
            Esgotado
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWish(product);
          }}
          aria-label={wished ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition active:scale-90 ${
            wished ? "border-danger-600/30 bg-danger-100 text-danger-600" : "border-ink-100 bg-card/95 text-ink-400 hover:text-danger-600"
          }`}
        >
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{product.brand}</span>
          {!out && product.stock <= 5 && (
            <span className="text-[11px] font-bold text-warn-600">restam {product.stock}</span>
          )}
        </div>
        <h3 className="line-clamp-2 min-h-[38px] text-[13.5px] font-semibold leading-snug text-ink-800 group-hover:text-ink-950">
          {product.name}
        </h3>
        <RatingLine rating={product.rating} count={product.ratingCount} />
        <div className="mt-auto pt-1">
          <Price price={product.price} old={product.oldPrice} />
        </div>
        <button
          onClick={onAdd}
          disabled={out}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2 text-[13.5px] font-bold transition active:scale-[0.97] ${
            out
              ? "cursor-not-allowed bg-ink-100 text-ink-400"
              : added
                ? "bg-ok-600 text-white"
                : "bg-ink-900 text-white hover:bg-ink-700"
          }`}
        >
          <ShoppingCart size={15} />
          {out ? "Indisponível" : added ? "Adicionado!" : "Adicionar"}
        </button>
      </div>
    </Link>
  );
}
