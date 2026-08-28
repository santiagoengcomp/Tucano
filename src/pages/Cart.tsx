import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, HeartCrack, ShoppingCart, Trash2, Truck, Zap } from "lucide-react";
import { api, FREE_SHIPPING_MIN, SHIPPING_FEE } from "../api/client";
import { useStore } from "../context/Store";
import type { Product } from "../types";
import ProductCard from "../components/ProductCard";
import { EmptyState, QtyStepper } from "../components/ui";
import { brl } from "../utils";

function useAllProducts() {
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

export function CartPage() {
  const { cart, setQty, removeFromCart, saveForLater, user, wish, toggleWish, addToCart } = useStore();
  const products = useAllProducts();
  const nav = useNavigate();

  const rows = useMemo(() => {
    if (!products) return null;
    return cart
      .map((i) => ({ item: i, product: products.find((p) => p.id === i.productId) }))
      .filter((r): r is { item: { productId: string; qty: number }; product: Product } => !!r.product);
  }, [cart, products]);

  const subtotal = rows?.reduce((s, r) => s + r.product.price * r.item.qty, 0) ?? 0;
  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
  const missing = Math.max(0, FREE_SHIPPING_MIN - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_MIN) * 100);

  const wishProducts = useMemo(
    () => (products ?? []).filter((p) => wish.includes(p.id)),
    [products, wish],
  );

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold text-ink-900 md:text-[28px]">
        Carrinho <span className="text-[16px] font-semibold text-ink-400">({cart.reduce((s, i) => s + i.qty, 0)} itens)</span>
      </h1>

      {rows === null ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<ShoppingCart size={28} />}
            title="Seu carrinho está vazio"
            desc="Explore o catálogo e adicione produtos — frete grátis em compras acima de R$ 149."
          >
            <Link to="/busca" className="btn-accent">Ver produtos</Link>
            <Link to="/busca?oferta=1" className="btn-ghost">Ofertas do dia</Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <div className="space-y-3">
            {/* barra de frete grátis */}
            <div className="rounded-xl border border-ink-100 bg-card p-4">
              {missing > 0 ? (
                <p className="text-[13.5px] font-semibold text-ink-600">
                  Faltam <span className="font-extrabold text-accent-600">{brl(missing)}</span> para ganhar <span className="font-extrabold text-turbo-700">frete grátis</span>
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ok-600">
                  <Truck size={15} /> Você ganhou frete grátis!
                </p>
              )}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${missing > 0 ? "bg-accent-500" : "bg-ok-600"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {rows.map(({ item, product }) => (
              <div key={product.id} className="flex gap-3 rounded-xl border border-ink-100 bg-card p-3 transition hover:border-ink-200 hover:shadow-card sm:gap-4 sm:p-4">
                <Link to={`/produto/${product.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-50 sm:h-28 sm:w-28">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/produto/${product.id}`} className="line-clamp-2 text-[13.5px] font-bold leading-snug text-ink-800 transition hover:text-turbo-700 sm:text-[14.5px]">
                      {product.name}
                    </Link>
                    <span className="shrink-0 font-display text-[16px] font-extrabold text-ink-900 sm:text-[18px]">
                      {brl(product.price * item.qty)}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">{product.brand}</span>
                  {product.turbo && (
                    <span className="mt-1 flex w-fit items-center gap-1 rounded bg-turbo-100 px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase text-turbo-700">
                      <Zap size={9} fill="currentColor" strokeWidth={0} /> Turbo
                    </span>
                  )}
                  {product.stock <= 5 && (
                    <span className="mt-1 w-fit rounded bg-warn-100 px-1.5 py-0.5 text-[10.5px] font-extrabold text-warn-700">
                      só {product.stock} em estoque
                    </span>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                    <QtyStepper small qty={item.qty} onChange={(q) => setQty(product.id, q)} max={product.stock} />
                    <button onClick={() => saveForLater(product.id)} className="text-[12px] font-bold text-turbo-700 transition hover:underline">
                      Salvar para depois
                    </button>
                    <button onClick={() => removeFromCart(product.id)} className="flex items-center gap-1 text-[12px] font-bold text-ink-400 transition hover:text-danger-600">
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* resumo */}
          <aside className="h-fit rounded-2xl border border-ink-100 bg-card p-5 shadow-card lg:sticky lg:top-32">
            <h2 className="font-display text-[17px] font-extrabold text-ink-900">Resumo da compra</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd className="font-bold text-ink-800">{brl(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-600">
                <dt>Frete</dt>
                <dd className={`font-bold ${shipping === 0 ? "text-ok-600" : "text-ink-800"}`}>
                  {shipping === 0 ? "Grátis" : brl(shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-ink-200 pt-2.5 text-[16px] font-extrabold text-ink-950">
                <dt>Total</dt>
                <dd>{brl(subtotal + shipping)}</dd>
              </div>
            </dl>
            <button onClick={() => nav(user ? "/checkout" : "/entrar?r=/checkout")} className="btn-accent mt-4 w-full !py-3">
              Finalizar compra <ArrowRight size={16} />
            </button>
            <Link to="/busca" className="mt-2 block text-center text-[12.5px] font-bold text-turbo-700 hover:underline">
              Continuar comprando
            </Link>
            <p className="mt-3 rounded-lg bg-ok-100 px-3 py-2 text-center text-[11.5px] font-bold text-ok-700">
              5% OFF extra pagando no Pix
            </p>
          </aside>
        </div>
      )}

      {/* salvos para depois */}
      {wishProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-[19px] font-extrabold text-ink-900">Salvos para depois ({wishProducts.length})</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wishProducts.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border border-ink-100 bg-card p-3">
                <Link to={`/produto/${p.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/produto/${p.id}`} className="line-clamp-2 text-[13px] font-bold text-ink-800 hover:text-turbo-700">{p.name}</Link>
                  <span className="mt-0.5 text-[14px] font-extrabold text-ink-900">{brl(p.price)}</span>
                  <div className="mt-auto flex gap-3 pt-1">
                    <button
                      onClick={() => {
                        if (addToCart(p, 1, { silent: true })) toggleWish(p);
                      }}
                      disabled={p.stock < 1}
                      className="text-[12px] font-bold text-turbo-700 hover:underline disabled:text-ink-300"
                    >
                      {p.stock < 1 ? "Esgotado" : "Mover ao carrinho"}
                    </button>
                    <button onClick={() => toggleWish(p)} className="text-[12px] font-bold text-ink-400 hover:text-danger-600">
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function WishlistPage() {
  const { wish } = useStore();
  const products = useAllProducts();
  const list = useMemo(() => (products ?? []).filter((p) => wish.includes(p.id)), [products, wish]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold text-ink-900 md:text-[28px]">
        Favoritos <span className="text-[16px] font-semibold text-ink-400">({list.length})</span>
      </h1>
      {products === null ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-72" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<HeartCrack size={28} />}
            title="Nada por aqui ainda"
            desc="Toque no coração de um produto para guardá-lo nesta lista e comparar depois."
          >
            <Link to="/busca" className="btn-accent">Descobrir produtos</Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
