import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle, Banknote, Download, FolderTree, ImagePlus, LayoutDashboard, Package, PackageX,
  Pencil, Percent, Plus, RotateCcw, Settings as SettingsIcon, ShoppingBag, Tag, Trash2, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, orderStatus } from "../api/client";
import { invalidateCatalog } from "../components/Header";
import { categoryLabel, invalidateCategories, useCategories } from "../api/useCategories";
import ImageUpload from "../components/ImageUpload";
import { useStore } from "../context/Store";
import type { Order, OrderStatus, Product, Promo, PromoType, Settings } from "../types";
import { EmptyState, Modal, StatusChip } from "../components/ui";
import { brl, fullDate, shortDate, uid } from "../utils";

const STOCK_IMAGES = Array.from({ length: 10 }, (_, i) => `/images/p${i + 1}.jpg`);
const PIE_COLORS = ["#ff9e1b", "#0e7c86", "#16222e", "#c23b3b", "#177a45", "#b26a00", "#6d8296", "#9fb0bf"];

const emptyProduct = (firstCat: string): Product => ({
  id: "p" + uid(),
  name: "",
  brand: "",
  category: firstCat,
  price: 0,
  oldPrice: undefined,
  rating: 4.5,
  ratingCount: 0,
  stock: 10,
  image: STOCK_IMAGES[0],
  short: "",
  description: "",
  features: [],
  tags: [],
  turbo: false,
  createdAt: Date.now(),
});

const emptyPromo = (): Omit<Promo, "id" | "usedCount" | "createdAt"> => ({
  code: "",
  type: "percent",
  value: 10,
  active: true,
  minOrder: 0,
  expiresAt: null,
});

type Tab = "geral" | "produtos" | "categorias" | "promos" | "pedidos" | "config";

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const chartTip = {
  contentStyle: { borderRadius: 12, border: "1px solid #e7edf2", fontSize: 12, fontFamily: "inherit" },
  labelStyle: { fontWeight: 700, color: "#16222e" },
};

export default function Admin() {
  const { user, token, authReady, toast } = useStore();
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>("geral");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product>(emptyProduct(""));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // categorias
  const [catModal, setCatModal] = useState<{ open: boolean; id: string | null; label: string }>({ open: false, id: null, label: "" });
  const [delCat, setDelCat] = useState<string | null>(null);

  // promoções
  const [promoModal, setPromoModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [pform, setPform] = useState(emptyPromo());
  const [delPromo, setDelPromo] = useState<string | null>(null);
  const [bulk, setBulk] = useState({ categoryId: "", percent: 10 });

  const load = useCallback(() => {
    api.listProducts().then(setProducts);
    api.listOrders(token).then(setOrders).catch(() => {});
    api.listPromos(token).then(setPromos).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (authReady && user?.role === "admin") load();
  }, [authReady, user, load]);

  const stats = useMemo(() => {
    const valid = (orders ?? []).filter((o) => orderStatus(o) !== "cancelado");
    const revenue = valid.reduce((s, o) => s + o.total, 0);
    return {
      revenue,
      orders: (orders ?? []).length,
      ticket: valid.length ? revenue / valid.length : 0,
      products: (products ?? []).length,
      lowStock: (products ?? []).filter((p) => p.stock > 0 && p.stock <= 5).length,
      outStock: (products ?? []).filter((p) => p.stock === 0).length,
    };
  }, [orders, products]);

  const salesData = useMemo(() => {
    const out: { day: string; receita: number; pedidos: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = (orders ?? []).filter((o) => !o.cancelled && new Date(o.createdAt).toISOString().slice(0, 10) === key);
      out.push({
        day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        receita: Math.round(dayOrders.reduce((s, o) => s + o.total, 0)),
        pedidos: dayOrders.length,
      });
    }
    return out;
  }, [orders]);

  const topData = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    (orders ?? [])
      .filter((o) => !o.cancelled)
      .forEach((o) =>
        o.items.forEach((it) => {
          const cur = map.get(it.productId) ?? { name: it.name, qty: 0 };
          cur.qty += it.qty;
          map.set(it.productId, cur);
        }),
      );
    return [...map.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((x) => ({ name: x.name.length > 16 ? x.name.slice(0, 16) + "…" : x.name, vendas: x.qty }));
  }, [orders]);

  const catData = useMemo(
    () =>
      categories
        .map((c) => ({ name: c.label, value: (products ?? []).filter((p) => p.category === c.id).length }))
        .filter((x) => x.value > 0),
    [categories, products],
  );

  if (authReady && (!user || user.role !== "admin")) return <Navigate to="/entrar?r=/admin" replace />;
  if (!user) return null;

  const refreshCatalog = () => {
    invalidateCatalog();
    invalidateCategories();
  };

  /* ---------- produtos ---------- */
  const openProductForm = (p?: Product) => {
    setEditing(p ? JSON.parse(JSON.stringify(p)) : emptyProduct(categories[0]?.id ?? ""));
    setFormOpen(true);
  };

  const saveProduct = async () => {
    if (!editing.name.trim() || editing.price <= 0) return toast("Preencha nome e preço válido.", "err");
    if (!editing.image?.trim()) return toast("Adicione uma foto ao produto.", "err");
    setSaving(true);
    try {
      const clean: Product = {
        ...editing,
        price: Math.round(editing.price * 100) / 100,
        oldPrice: editing.oldPrice && editing.oldPrice > editing.price ? Math.round(editing.oldPrice * 100) / 100 : undefined,
        features: typeof editing.features === "string" ? (editing.features as unknown as string).split("\n").map((f) => f.trim()).filter(Boolean) : editing.features,
        tags: typeof editing.tags === "string" ? (editing.tags as unknown as string).split(",").map((t) => t.trim()).filter(Boolean) : editing.tags,
      };
      await api.adminUpsertProduct(token, clean);
      refreshCatalog();
      toast("Produto salvo no catálogo!");
      setFormOpen(false);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!deleteId) return;
    try {
      await api.adminDeleteProduct(token, deleteId);
      refreshCatalog();
      toast("Produto removido.", "info");
      setDeleteId(null);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const adjustStock = async (p: Product, delta: number) => {
    const stock = Math.max(0, p.stock + delta);
    try {
      await api.adminUpsertProduct(token, { ...p, stock });
      setProducts((list) => (list ? list.map((x) => (x.id === p.id ? { ...x, stock } : x)) : list));
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  /* ---------- categorias ---------- */
  const saveCategory = async () => {
    try {
      if (catModal.id) await api.updateCategory(token, catModal.id, catModal.label);
      else await api.createCategory(token, catModal.label);
      refreshCatalog();
      toast(catModal.id ? "Categoria renomeada!" : "Categoria criada!");
      setCatModal({ open: false, id: null, label: "" });
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const removeCategory = async () => {
    if (!delCat) return;
    try {
      await api.deleteCategory(token, delCat);
      refreshCatalog();
      toast("Categoria excluída.", "info");
      setDelCat(null);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  /* ---------- promoções ---------- */
  const openPromoForm = (p?: Promo) => {
    setPform(p ? { code: p.code, type: p.type, value: p.value, active: p.active, minOrder: p.minOrder, expiresAt: p.expiresAt } : emptyPromo());
    setPromoModal({ open: true, id: p?.id ?? null });
  };

  const savePromo = async () => {
    try {
      if (promoModal.id) await api.updatePromo(token, promoModal.id, pform);
      else await api.createPromo(token, pform);
      toast(promoModal.id ? "Cupom atualizado!" : "Cupom criado!");
      setPromoModal({ open: false, id: null });
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const togglePromo = async (p: Promo) => {
    try {
      await api.updatePromo(token, p.id, { active: !p.active });
      toast(p.active ? "Cupom desativado." : "Cupom ativado!", "info");
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const removePromo = async () => {
    if (!delPromo) return;
    try {
      await api.deletePromo(token, delPromo);
      toast("Cupom excluído.", "info");
      setDelPromo(null);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const applyBulk = async () => {
    try {
      const count = await api.bulkDiscount(token, { categoryId: bulk.categoryId || undefined, percent: bulk.percent });
      refreshCatalog();
      toast(`Desconto de ${bulk.percent}% aplicado em ${count} produto(s)!`);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  /* ---------- configurações ---------- */
  const saveSettings = async () => {
    if (!settings) return;
    try {
      await api.updateSettings(token, settings);
      toast("Configurações salvas!");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const setStatus = async (o: Order, status: OrderStatus) => {
    try {
      await api.adminSetOrderStatus(token, o.id, status);
      toast(`Pedido ${o.id} → ${status}.`);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const doReset = async () => {
    await api.resetDemo();
    window.location.hash = "#/";
    window.location.reload();
  };

  const exportProducts = () =>
    downloadCSV("produtos.csv", [
      ["id", "nome", "marca", "categoria", "preco", "preco_antigo", "estoque", "avaliacao", "avaliacoes"],
      ...(products ?? []).map((p) => [p.id, p.name, p.brand, categoryLabel(categories, p.category), p.price, p.oldPrice ?? "", p.stock, p.rating, p.ratingCount]),
    ]);

  const exportOrders = () =>
    downloadCSV("pedidos.csv", [
      ["id", "cliente", "data", "itens", "subtotal", "frete", "desconto", "cupom", "total", "status"],
      ...(orders ?? []).map((o) => [o.id, o.customer, fullDate(o.createdAt), o.items.reduce((s, i) => s + i.qty, 0), o.subtotal, o.shipping, o.discount ?? 0, o.couponCode ?? "", o.total, orderStatus(o)]),
    ]);

  const tiles = [
    { icon: <Banknote size={17} />, label: "Receita", value: brl(stats.revenue), tone: "bg-ok-100 text-ok-700" },
    { icon: <ShoppingBag size={17} />, label: "Pedidos", value: String(stats.orders), tone: "bg-turbo-100 text-turbo-700" },
    { icon: <TrendingUp size={17} />, label: "Ticket médio", value: brl(stats.ticket), tone: "bg-accent-100 text-accent-600" },
    { icon: <Package size={17} />, label: "Produtos", value: String(stats.products), tone: "bg-ink-100 text-ink-600" },
    { icon: <AlertTriangle size={17} />, label: "Estoque baixo", value: String(stats.lowStock), tone: "bg-warn-100 text-warn-700" },
    { icon: <PackageX size={17} />, label: "Esgotados", value: String(stats.outStock), tone: "bg-danger-100 text-danger-700" },
  ];

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-extrabold transition ${
        tab === t ? "bg-ink-900 text-white shadow" : "bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-800"
      }`}
    >
      {icon} {label}
    </button>
  );

  const card = "rounded-2xl border border-ink-100 bg-card p-5 shadow-card";

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[24px] font-extrabold text-ink-950 md:text-[28px]">
            <LayoutDashboard size={24} className="text-accent-500" /> Painel admin
          </h1>
          <p className="text-[13px] font-medium text-ink-400">Catálogo, promoções, pedidos e configurações em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setResetOpen(true)} className="btn-ghost !py-2 !text-[12.5px]">
            <RotateCcw size={14} /> Resetar demo
          </button>
          <button onClick={() => openProductForm()} className="btn-accent !py-2 !text-[13px]">
            <Plus size={15} /> Novo produto
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabBtn("geral", "Visão geral", <TrendingUp size={15} />)}
        {tabBtn("produtos", "Produtos", <Package size={15} />)}
        {tabBtn("categorias", "Categorias", <FolderTree size={15} />)}
        {tabBtn("promos", "Promoções", <Tag size={15} />)}
        {tabBtn("pedidos", "Pedidos", <ShoppingBag size={15} />)}
        {tabBtn("config", "Configurações", <SettingsIcon size={15} />)}
      </div>

      {/* ================= VISÃO GERAL ================= */}
      {tab === "geral" && (
        <div className="mt-5 space-y-5 animate-fadein">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-ink-100 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.tone}`}>{t.icon}</span>
                <p className="mt-2.5 font-display text-[19px] font-extrabold leading-tight text-ink-950">{t.value}</p>
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">{t.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={exportProducts} className="btn-ghost !py-2 !text-[12.5px]">
              <Download size={14} /> Exportar produtos (CSV)
            </button>
            <button onClick={exportOrders} className="btn-ghost !py-2 !text-[12.5px]">
              <Download size={14} /> Exportar pedidos (CSV)
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={card}>
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Receita · últimos 14 dias</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff9e1b" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#ff9e1b" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6d8296" }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: "#6d8296" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip {...chartTip} formatter={(v: number) => [brl(v), "Receita"]} />
                    <Area type="monotone" dataKey="receita" stroke="#ff9e1b" strokeWidth={2.5} fill="url(#gRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={card}>
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Mais vendidos (unidades)</h2>
              {topData.length === 0 ? (
                <p className="mt-3 rounded-xl bg-ink-50 px-4 py-8 text-center text-[13px] font-medium text-ink-400">
                  Sem vendas ainda — o ranking aparece após o primeiro pedido.
                </p>
              ) : (
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#6d8296" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10.5, fill: "#2c4257" }} tickLine={false} axisLine={false} />
                      <Tooltip {...chartTip} formatter={(v: number) => [`${v} un.`, "Vendas"]} />
                      <Bar dataKey="vendas" fill="#0e7c86" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={card}>
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Produtos por categoria</h2>
              {catData.length === 0 ? (
                <p className="mt-3 rounded-xl bg-ink-50 px-4 py-8 text-center text-[13px] font-medium text-ink-400">Cadastre produtos para ver a distribuição.</p>
              ) : (
                <div className="mt-3 flex items-center gap-4">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={catData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                          {catData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...chartTip} formatter={(v: number, n: string) => [`${v} produto(s)`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1.5">
                    {catData.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.name} <span className="text-ink-400">({c.value})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={card}>
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Alertas de estoque</h2>
              {(products ?? []).filter((p) => p.stock <= 5).length === 0 ? (
                <p className="mt-3 rounded-xl bg-ink-50 px-4 py-8 text-center text-[13px] font-medium text-ink-400">Estoque saudável em todo o catálogo.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(products ?? [])
                    .filter((p) => p.stock <= 5)
                    .slice(0, 6)
                    .map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2">
                        <span className="truncate text-[13px] font-bold text-ink-700">{p.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${p.stock === 0 ? "bg-danger-100 text-danger-700" : "bg-warn-100 text-warn-700"}`}>
                          {p.stock === 0 ? "esgotado" : `${p.stock} un.`}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= PRODUTOS ================= */}
      {tab === "produtos" && (
        <div className="mt-5 animate-fadein">
          {products === null ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : products.length === 0 ? (
            <EmptyState icon={<Package size={26} />} title="Catálogo vazio" desc="Crie seu primeiro produto para começar a vender.">
              <button onClick={() => openProductForm()} className="btn-accent"><Plus size={15} /> Novo produto</button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-card shadow-card">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Avaliação</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-ink-50 transition last:border-0 hover:bg-ink-50/60">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          <img src={p.image} alt="" className="h-11 w-11 rounded-lg bg-ink-50 object-cover ring-1 ring-ink-100" />
                          <span className="min-w-0">
                            <span className="block max-w-[240px] truncate text-[13px] font-bold text-ink-800">{p.name}</span>
                            <span className="text-[11px] font-semibold uppercase text-ink-400">{p.brand}{p.turbo && " · turbo"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] font-semibold text-ink-500">{categoryLabel(categories, p.category)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[13.5px] font-extrabold text-ink-900">{brl(p.price)}</span>
                        {p.oldPrice && <span className="ml-1.5 text-[11px] text-ink-400 line-through">{brl(p.oldPrice)}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => adjustStock(p, -1)} className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50 active:scale-90" aria-label="Diminuir estoque">−</button>
                          <span className={`min-w-[42px] rounded-full px-2 py-0.5 text-center text-[11.5px] font-extrabold ${p.stock === 0 ? "bg-danger-100 text-danger-700" : p.stock <= 5 ? "bg-warn-100 text-warn-700" : "bg-ok-100 text-ok-700"}`}>
                            {p.stock}
                          </span>
                          <button onClick={() => adjustStock(p, 1)} className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50 active:scale-90" aria-label="Aumentar estoque">+</button>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] font-bold text-ink-600">
                        {p.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="font-medium text-ink-400">({p.ratingCount})</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex justify-end gap-1">
                          <button onClick={() => openProductForm(p)} className="rounded-lg p-2 text-ink-400 transition hover:bg-turbo-100 hover:text-turbo-700" aria-label="Editar">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-2 text-ink-400 transition hover:bg-danger-100 hover:text-danger-600" aria-label="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= CATEGORIAS ================= */}
      {tab === "categorias" && (
        <div className="mt-5 animate-fadein">
          <div className="mb-4 flex justify-end">
            <button onClick={() => setCatModal({ open: true, id: null, label: "" })} className="btn-accent !py-2 !text-[13px]">
              <Plus size={15} /> Nova categoria
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const count = (products ?? []).filter((p) => p.category === c.id).length;
              return (
                <div key={c.id} className="group flex items-center justify-between rounded-xl border border-ink-100 bg-card p-4 transition hover:border-accent-400 hover:shadow-card">
                  <div>
                    <p className="font-display text-[15px] font-extrabold text-ink-900">{c.label}</p>
                    <p className="text-[11.5px] font-semibold text-ink-400">
                      /{c.id} · {count} produto{count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setCatModal({ open: true, id: c.id, label: c.label })} className="rounded-lg p-2 text-ink-400 transition hover:bg-turbo-100 hover:text-turbo-700" aria-label="Renomear">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDelCat(c.id)} className="rounded-lg p-2 text-ink-400 transition hover:bg-danger-100 hover:text-danger-600" aria-label="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= PROMOÇÕES ================= */}
      {tab === "promos" && (
        <div className="mt-5 space-y-5 animate-fadein">
          <div className={card}>
            <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink-900">
              <Percent size={17} className="text-accent-500" /> Desconto em massa
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-400">Aplica desconto a todos os produtos de uma categoria (ou da loja inteira). O preço atual vira o "preço antigo".</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="field-label">Categoria</label>
                <select className="field w-52" value={bulk.categoryId} onChange={(e) => setBulk((b) => ({ ...b, categoryId: e.target.value }))}>
                  <option value="">Loja inteira</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Desconto (%)</label>
                <input type="number" min={1} max={90} className="field w-28" value={bulk.percent} onChange={(e) => setBulk((b) => ({ ...b, percent: Number(e.target.value) }))} />
              </div>
              <button onClick={applyBulk} className="btn-dark !py-2.5">Aplicar desconto</button>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink-900">
                <Tag size={17} className="text-accent-500" /> Cupons de desconto
              </h2>
              <button onClick={() => openPromoForm()} className="btn-accent !py-2 !text-[13px]">
                <Plus size={15} /> Novo cupom
              </button>
            </div>

            {promos === null ? (
              <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
            ) : promos.length === 0 ? (
              <EmptyState icon={<Tag size={26} />} title="Nenhum cupom ativo" desc="Crie cupons para seus clientes usarem no checkout." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {promos.map((p) => (
                  <div key={p.id} className={`flex items-center justify-between rounded-xl border bg-card p-4 transition ${p.active ? "border-ok-100" : "border-ink-100 opacity-70"}`}>
                    <div>
                      <p className="font-mono text-[16px] font-extrabold tracking-wider text-ink-950">{p.code}</p>
                      <p className="text-[12px] font-semibold text-ink-500">
                        {p.type === "percent" ? `${p.value}% de desconto` : `${brl(p.value)} de desconto`}
                        {p.minOrder > 0 && ` · mín. ${brl(p.minOrder)}`}
                        {p.expiresAt && ` · até ${shortDate(p.expiresAt)}`}
                      </p>
                      <p className="text-[11px] font-medium text-ink-400">usado {p.usedCount}x</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePromo(p)}
                        role="switch"
                        aria-checked={p.active}
                        className={`relative h-6 w-11 rounded-full transition ${p.active ? "bg-ok-600" : "bg-ink-200"}`}
                        aria-label={p.active ? "Desativar cupom" : "Ativar cupom"}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.active ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => openPromoForm(p)} className="rounded-lg p-2 text-ink-400 transition hover:bg-turbo-100 hover:text-turbo-700" aria-label="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDelPromo(p.id)} className="rounded-lg p-2 text-ink-400 transition hover:bg-danger-100 hover:text-danger-600" aria-label="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PEDIDOS ================= */}
      {tab === "pedidos" && (
        <div className="mt-5 animate-fadein">
          {orders === null ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={26} />} title="Nenhum pedido" desc="Os pedidos dos clientes aparecem aqui para gestão de status e envio." />
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const status = orderStatus(o);
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-card p-4 transition hover:border-ink-200 hover:shadow-card">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[14.5px] font-extrabold text-ink-950">
                        {o.id} <span className="ml-1 font-sans text-[12px] font-semibold text-ink-400">{fullDate(o.createdAt)}</span>
                      </p>
                      <p className="truncate text-[12.5px] font-semibold text-ink-500">
                        {o.customer} · {o.items.reduce((s, i) => s + i.qty, 0)} itens · {o.payment}
                        {o.couponCode && <span className="ml-1 rounded bg-accent-100 px-1.5 py-0.5 font-mono text-[10.5px] font-extrabold text-accent-600">{o.couponCode}</span>}
                      </p>
                    </div>
                    <span className="font-display text-[16px] font-extrabold text-ink-950">{brl(o.total)}</span>
                    <StatusChip status={status} />
                    <select value={status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} className="field w-auto !py-1.5 !text-[12.5px] font-bold" aria-label="Alterar status">
                      <option value="confirmado">Confirmado</option>
                      <option value="preparando">Em separação</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= CONFIGURAÇÕES ================= */}
      {tab === "config" && (
        <div className="mt-5 max-w-xl space-y-4 animate-fadein">
          {settings ? (
            <div className={card}>
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Loja</h2>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="field-label">Nome da loja</label>
                  <input className="field" value={settings.storeName} onChange={(e) => setSettings((s) => s && { ...s, storeName: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Aviso do topo (letreiro)</label>
                  <input className="field" value={settings.announcement} onChange={(e) => setSettings((s) => s && { ...s, announcement: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Frete grátis a partir de (R$)</label>
                    <input type="number" min={0} className="field" value={settings.freeShipMin} onChange={(e) => setSettings((s) => s && { ...s, freeShipMin: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="field-label">Valor do frete (R$)</label>
                    <input type="number" min={0} step="0.1" className="field" value={settings.shipFee} onChange={(e) => setSettings((s) => s && { ...s, shipFee: Number(e.target.value) })} />
                  </div>
                </div>
                <button onClick={saveSettings} className="btn-accent w-full">Salvar configurações</button>
                <p className="text-center text-[11.5px] font-medium text-ink-400">O checkout e o letreiro usam esses valores em tempo real.</p>
              </div>
            </div>
          ) : (
            <div className="skeleton h-40" />
          )}
        </div>
      )}

      {/* ---------- modal produto ---------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={products?.some((p) => p.id === editing.id) ? "Editar produto" : "Novo produto"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageUpload value={editing.image} onChange={(img) => setEditing((p) => ({ ...p, image: img }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Ou use uma URL / imagem do estoque</label>
            <input className="field" list="stock-images" value={editing.image.startsWith("data:") ? "" : editing.image} onChange={(e) => setEditing((p) => ({ ...p, image: e.target.value }))} placeholder="/images/p1.jpg ou https://…" />
            <datalist id="stock-images">
              {STOCK_IMAGES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Nome do produto</label>
            <input className="field" value={editing.name} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: Fone Bluetooth X9…" />
          </div>
          <div>
            <label className="field-label">Marca</label>
            <input className="field" value={editing.brand} onChange={(e) => setEditing((p) => ({ ...p, brand: e.target.value }))} placeholder="Marca" />
          </div>
          <div>
            <label className="field-label">Categoria</label>
            <select className="field" value={editing.category} onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value }))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Preço (R$)</label>
            <input type="number" min={0} step="0.01" className="field" value={editing.price || ""} onChange={(e) => setEditing((p) => ({ ...p, price: Number(e.target.value) }))} placeholder="199.90" />
          </div>
          <div>
            <label className="field-label">Preço antigo (opcional)</label>
            <input type="number" min={0} step="0.01" className="field" value={editing.oldPrice ?? ""} onChange={(e) => setEditing((p) => ({ ...p, oldPrice: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="249.90" />
          </div>
          <div>
            <label className="field-label">Estoque</label>
            <input type="number" min={0} className="field" value={editing.stock} onChange={(e) => setEditing((p) => ({ ...p, stock: Number(e.target.value) }))} placeholder="10" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Resumo (1 linha)</label>
            <input className="field" value={editing.short} onChange={(e) => setEditing((p) => ({ ...p, short: e.target.value }))} placeholder="Frase curta de venda" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Descrição</label>
            <textarea className="field min-h-20 resize-y" value={editing.description} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição completa" />
          </div>
          <div>
            <label className="field-label">Destaques (1 por linha)</label>
            <textarea className="field min-h-20 resize-y" value={Array.isArray(editing.features) ? editing.features.join("\n") : (editing.features as unknown as string)} onChange={(e) => setEditing((p) => ({ ...p, features: e.target.value as unknown as string[] }))} placeholder={"Recurso 1\nRecurso 2"} />
          </div>
          <div>
            <label className="field-label">Tags (separadas por vírgula)</label>
            <textarea className="field min-h-20 resize-y" value={Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags as unknown as string)} onChange={(e) => setEditing((p) => ({ ...p, tags: e.target.value as unknown as string[] }))} placeholder="fone, bluetooth, musica" />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink-700">
              <input type="checkbox" checked={!!editing.turbo} onChange={(e) => setEditing((p) => ({ ...p, turbo: e.target.checked }))} className="h-4 w-4 accent-[#0e7c86]" />
              Entrega Turbo (2h nas capitais)
            </label>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setFormOpen(false)} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={saveProduct} disabled={saving} className="btn-accent flex-1">
            {saving ? "Salvando…" : "Salvar produto"}
          </button>
        </div>
      </Modal>

      {/* ---------- modal categoria ---------- */}
      <Modal open={catModal.open} onClose={() => setCatModal({ open: false, id: null, label: "" })} title={catModal.id ? "Renomear categoria" : "Nova categoria"}>
        <label className="field-label">Nome da categoria</label>
        <input autoFocus className="field" value={catModal.label} onChange={(e) => setCatModal((c) => ({ ...c, label: e.target.value }))} placeholder="Ex.: Papelaria, Pets, Beleza…" />
        <div className="mt-5 flex gap-2">
          <button onClick={() => setCatModal({ open: false, id: null, label: "" })} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={saveCategory} className="btn-accent flex-1">{catModal.id ? "Salvar" : "Criar categoria"}</button>
        </div>
      </Modal>

      {/* ---------- modal cupom ---------- */}
      <Modal open={promoModal.open} onClose={() => setPromoModal({ open: false, id: null })} title={promoModal.id ? "Editar cupom" : "Novo cupom"}>
        <div className="space-y-3">
          <div>
            <label className="field-label">Código (3–20 letras/números)</label>
            <input className="field font-mono uppercase" value={pform.code} onChange={(e) => setPform((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="EX: PROMO10" disabled={!!promoModal.id} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tipo</label>
              <select className="field" value={pform.type} onChange={(e) => setPform((p) => ({ ...p, type: e.target.value as PromoType }))}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="field-label">{pform.type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</label>
              <input type="number" min={1} max={pform.type === "percent" ? 90 : undefined} className="field" value={pform.value} onChange={(e) => setPform((p) => ({ ...p, value: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Pedido mínimo (R$)</label>
              <input type="number" min={0} className="field" value={pform.minOrder} onChange={(e) => setPform((p) => ({ ...p, minOrder: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="field-label">Expira em (opcional)</label>
              <input
                type="date"
                className="field"
                value={pform.expiresAt ? new Date(pform.expiresAt).toISOString().slice(0, 10) : ""}
                onChange={(e) => setPform((p) => ({ ...p, expiresAt: e.target.value ? new Date(e.target.value + "T23:59:59").getTime() : null }))}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink-700">
            <input type="checkbox" checked={pform.active} onChange={(e) => setPform((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4 accent-[#177a45]" />
            Cupom ativo
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setPromoModal({ open: false, id: null })} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={savePromo} className="btn-accent flex-1">{promoModal.id ? "Salvar" : "Criar cupom"}</button>
        </div>
      </Modal>

      {/* ---------- modal excluir produto ---------- */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir produto?">
        <p className="text-[14px] text-ink-600">
          O produto <span className="font-bold text-ink-900">{products?.find((p) => p.id === deleteId)?.name}</span> será removido do catálogo junto com suas avaliações.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Manter</button>
          <button onClick={removeProduct} className="flex-1 rounded-full bg-danger-600 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-danger-700 active:scale-[0.97]">
            Excluir definitivamente
          </button>
        </div>
      </Modal>

      {/* ---------- modal excluir categoria ---------- */}
      <Modal open={!!delCat} onClose={() => setDelCat(null)} title="Excluir categoria?">
        <p className="text-[14px] text-ink-600">
          A categoria <span className="font-bold text-ink-900">{categories.find((c) => c.id === delCat)?.label}</span> será excluída. Categorias com produtos não podem ser removidas.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setDelCat(null)} className="btn-ghost flex-1">Manter</button>
          <button onClick={removeCategory} className="flex-1 rounded-full bg-danger-600 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-danger-700 active:scale-[0.97]">
            Excluir categoria
          </button>
        </div>
      </Modal>

      {/* ---------- modal excluir cupom ---------- */}
      <Modal open={!!delPromo} onClose={() => setDelPromo(null)} title="Excluir cupom?">
        <p className="text-[14px] text-ink-600">
          O cupom <span className="font-mono font-bold text-ink-900">{promos?.find((p) => p.id === delPromo)?.code}</span> deixará de funcionar no checkout.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setDelPromo(null)} className="btn-ghost flex-1">Manter</button>
          <button onClick={removePromo} className="flex-1 rounded-full bg-danger-600 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-danger-700 active:scale-[0.97]">
            Excluir cupom
          </button>
        </div>
      </Modal>

      {/* ---------- modal reset ---------- */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Resetar dados da demo?">
        <p className="text-[14px] text-ink-600">
          Catálogo, pedidos, avaliações, cupons e contas voltarão ao estado original. Sua sessão será encerrada.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setResetOpen(false)} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={doReset} className="flex-1 rounded-full bg-ink-900 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-ink-700 active:scale-[0.97]">
            Resetar agora
          </button>
        </div>
      </Modal>
    </div>
  );
}
