import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { api } from "../api/client";
import { useStore } from "../context/Store";
import type { Product } from "../types";
import { Logo } from "./ui";
import { brl } from "../utils";
import seed from "../data/catalog.json";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  (seed.categories as { id: string; label: string }[]).map((c) => [c.id, c.label]),
);

let cache: Product[] | null = null;

function useCatalog() {
  const [products, setProducts] = useState<Product[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    if (cache) return;
    api.listProducts().then((p) => {
      cache = p;
      if (alive) setProducts(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return products;
}

export function invalidateCatalog() {
  cache = null;
}

function SearchBox({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const products = useCatalog();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const query = q.trim().toLowerCase();
  const suggestions =
    query.length >= 2
      ? products
          .filter((p) =>
            [p.name, p.brand, p.category, ...p.tags].join(" ").toLowerCase().includes(query),
          )
          .slice(0, 6)
      : [];

  const go = (e?: FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    nav(`/busca?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
    setQ("");
    onDone?.();
  };

  return (
    <div ref={wrap} className="relative w-full">
      <form onSubmit={go} className="flex h-10 overflow-hidden rounded-lg bg-white shadow-inner ring-1 ring-black/10">
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar no Tucano…"
          className="min-w-0 flex-1 bg-transparent px-3.5 text-[14.5px] text-ink-900 outline-none placeholder:text-ink-400"
          aria-label="Buscar produtos"
        />
        <button type="submit" className="flex w-12 items-center justify-center bg-accent-500 text-ink-900 transition hover:bg-accent-400 active:scale-95" aria-label="Buscar">
          <Search size={18} strokeWidth={2.5} />
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-xl border border-ink-100 bg-card text-ink-800 shadow-lift animate-fadein">
          {suggestions.map((p) => (
            <Link
              key={p.id}
              to={`/produto/${p.id}`}
              onClick={() => {
                setOpen(false);
                setQ("");
                onDone?.();
              }}
              className="flex items-center gap-3 px-3 py-2 transition hover:bg-accent-50"
            >
              <img src={p.image} alt="" className="h-9 w-9 rounded-md bg-ink-50 object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                <span className="block text-[11.5px] text-ink-400">
                  {CAT_LABEL[p.category] ?? p.category} · {p.brand}
                </span>
              </span>
              <span className="text-[13px] font-bold">{brl(p.price)}</span>
            </Link>
          ))}
          <button
            onClick={() => go()}
            className="flex w-full items-center justify-center gap-1.5 border-t border-ink-100 bg-ink-50 py-2 text-[12.5px] font-bold text-turbo-700 transition hover:bg-ink-100"
          >
            <Search size={13} /> Ver todos os resultados para “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, cartCount, cartPulse, wish, logout, toast } = useStore();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const cats = seed.categories as { id: string; label: string }[];
  const first = user?.name.split(" ")[0];

  const itemCls =
    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-ink-700 transition hover:bg-accent-50 hover:text-ink-900";

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-ink-900 pt-safe text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 md:h-16 md:px-6">
          <Link to="/" className="shrink-0 rounded-md ring-accent-500 transition hover:opacity-90" aria-label="Tucano — início">
            <Logo small />
          </Link>

          <button
            onClick={() => nav(user ? "/conta" : "/entrar")}
            className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-ink-700 lg:flex"
          >
            <MapPin size={17} className="text-accent-400" />
            <span className="leading-tight">
              <span className="block text-[10.5px] text-ink-300">Entregar para {first ?? "você"}</span>
              <span className="block text-[12.5px] font-bold">São Paulo 01310-100</span>
            </span>
          </button>

          <div className="hidden flex-1 justify-center px-2 md:flex">
            <div className="w-full max-w-2xl">
              <SearchBox />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-0.5 md:gap-1">
            <button
              onClick={() => setMobileSearch((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-200 transition hover:bg-ink-700 hover:text-white md:hidden"
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>

            {/* conta */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenu((v) => !v)}
                className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 transition hover:bg-ink-700 md:flex"
              >
                <span className="leading-tight text-left">
                  <span className="block text-[10.5px] text-ink-300">Olá, {first ?? "visitante"}</span>
                  <span className="flex items-center gap-0.5 text-[12.5px] font-bold">
                    Conta <ChevronDown size={12} className={`transition-transform ${menu ? "rotate-180" : ""}`} />
                  </span>
                </span>
              </button>
              <button
                onClick={() => setMenu((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-200 transition hover:bg-ink-700 hover:text-white md:hidden"
                aria-label="Conta"
              >
                <UserRound size={20} />
              </button>

              {menu && (
                <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-xl border border-ink-100 bg-card py-1.5 text-ink-800 shadow-lift animate-fadein">
                  <div className="border-b border-ink-100 px-4 py-2.5">
                    <p className="font-display text-[14px] font-bold">Olá, {first ?? "visitante"}</p>
                    {!user && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => { setMenu(false); nav("/entrar"); }} className="btn-accent flex-1 !py-1.5 !text-[12.5px]">
                          Entrar
                        </button>
                        <button onClick={() => { setMenu(false); nav("/entrar?modo=criar"); }} className="btn-ghost flex-1 !py-1.5 !text-[12.5px]">
                          Criar conta
                        </button>
                      </div>
                    )}
                  </div>
                  {user && (
                    <>
                      <button className={itemCls} onClick={() => { setMenu(false); nav("/pedidos"); }}>
                        <Package size={16} className="text-ink-400" /> Meus pedidos
                      </button>
                      <button className={itemCls} onClick={() => { setMenu(false); nav("/conta"); }}>
                        <UserRound size={16} className="text-ink-400" /> Minha conta
                      </button>
                      {user.role === "admin" && (
                        <button className={itemCls} onClick={() => { setMenu(false); nav("/admin"); }}>
                          <LayoutDashboard size={16} className="text-ink-400" /> Painel admin
                        </button>
                      )}
                      <button
                        className={`${itemCls} border-t border-ink-100 !text-danger-600`}
                        onClick={() => {
                          setMenu(false);
                          logout();
                          toast("Você saiu da conta.", "info");
                          nav("/");
                        }}
                      >
                        <LogOut size={16} /> Sair
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/favoritos"
              className="relative hidden h-10 w-10 items-center justify-center rounded-lg text-ink-200 transition hover:bg-ink-700 hover:text-white md:flex"
              aria-label="Favoritos"
            >
              <Heart size={20} />
              {wish.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger-600 px-1 text-[10.5px] font-extrabold text-white">
                  {wish.length}
                </span>
              )}
            </Link>

            <Link
              to="/carrinho"
              className="relative flex h-10 items-center gap-1.5 rounded-lg px-2 text-ink-100 transition hover:bg-ink-700"
              aria-label="Carrinho"
            >
              <span className="relative">
                <ShoppingCart size={21} />
                <span
                  key={cartPulse}
                  className="absolute -right-2 -top-1.5 flex h-[17px] min-w-[17px] animate-pop items-center justify-center rounded-full bg-accent-500 px-1 text-[10.5px] font-extrabold text-ink-900"
                >
                  {cartCount}
                </span>
              </span>
              <span className="hidden text-[12.5px] font-bold lg:block">Carrinho</span>
            </Link>
          </div>
        </div>

        {mobileSearch && (
          <div className="px-3 pb-2.5 md:hidden animate-fadein">
            <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
          </div>
        )}
      </div>

      {/* navegação de categorias (desktop) */}
      <nav className="hidden bg-ink-800 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6 py-1.5 no-scrollbar">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                isActive ? "bg-ink-700 text-white" : "text-ink-200 hover:bg-ink-700 hover:text-white"
              }`
            }
          >
            Início
          </NavLink>
          {cats.map((c) => (
            <NavLink
              key={c.id}
              to={`/busca?cat=${c.id}`}
              className="shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold text-ink-200 transition hover:bg-ink-700 hover:text-white"
            >
              {c.label}
            </NavLink>
          ))}
          <NavLink
            to="/busca?oferta=1"
            className="shrink-0 rounded-md px-3 py-1.5 text-[13px] font-extrabold text-accent-400 transition hover:bg-ink-700"
          >
            Ofertas do dia
          </NavLink>
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-[13px] font-bold text-turbo-500 transition hover:bg-ink-700"
            >
              Painel admin
            </NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}

export function BottomNav() {
  const { cartCount, cartPulse, wish, user } = useStore();
  const tabs = [
    { to: "/", icon: <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>, label: "Início", end: true },
    { to: "/busca", icon: <Search size={21} />, label: "Buscar" },
    { to: "/favoritos", icon: <Heart size={21} />, label: "Favoritos", badge: wish.length },
    { to: "/carrinho", icon: <ShoppingCart size={21} />, label: "Carrinho", badge: cartCount, pulse: cartPulse },
    { to: user ? "/conta" : "/entrar", icon: <UserRound size={21} />, label: "Conta" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-700 bg-ink-900 pb-safe md:hidden">
      <div className="grid grid-cols-5">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold transition ${
                isActive ? "text-accent-400" : "text-ink-300 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-accent-500 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                <span className="relative">
                  {t.icon}
                  {!!t.badge && (
                    <span
                      key={t.pulse ?? 0}
                      className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-accent-500 px-1 text-[9.5px] font-extrabold text-ink-900"
                    >
                      {t.badge}
                    </span>
                  )}
                </span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
