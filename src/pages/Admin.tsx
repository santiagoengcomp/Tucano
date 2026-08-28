import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle, Banknote, LayoutDashboard, Package, PackageX, Pencil, Plus, RotateCcw, ShoppingBag, Trash2, TrendingUp } from "lucide-react";
import { api, orderStatus } from "../api/client";
import { invalidateCatalog } from "../components/Header";
import { useStore } from "../context/Store";
import type { Order, OrderStatus, Product } from "../types";
import { EmptyState, Modal, StatusChip } from "../components/ui";
import { brl, fullDate, uid } from "../utils";
import seed from "../data/catalog.json";

const CATS = seed.categories as { id: string; label: string }[];
const STOCK_IMAGES = Array.from({ length: 10 }, (_, i) => `/images/p${i + 1}.jpg`);

const emptyProduct = (): Product => ({
  id: "p" + uid(),
  name: "",
  brand: "",
  category: CATS[0].id,
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

type Tab = "geral" | "produtos" | "pedidos";

export default function Admin() {
  const { user, token, authReady, toast } = useStore();
  const [tab, setTab] = useState<Tab>("geral");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product>(emptyProduct());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.listProducts().then(setProducts);
    api.listOrders(token).then(setOrders).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (authReady && user?.role === "admin") load();
  }, [authReady, user, load]);

  const stats = useMemo(() => {
    const valid = (orders ?? []).filter((o) => !orderStatus(o).includes("cancelado"));
    const revenue = valid.reduce((s, o) => s + o.total, 0);
    const soldByProduct = new Map<string, number>();
    valid.forEach((o) => o.items.forEach((it) => soldByProduct.set(it.productId, (soldByProduct.get(it.productId) ?? 0) + it.qty)));
    const topSold = (products ?? [])
      .map((p) => ({ p, sold: soldByProduct.get(p.id) ?? 0 }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 3);
    return {
      revenue,
      orders: (orders ?? []).length,
      ticket: valid.length ? revenue / valid.length : 0,
      products: (products ?? []).length,
      lowStock: (products ?? []).filter((p) => p.stock > 0 && p.stock <= 5).length,
      outStock: (products ?? []).filter((p) => p.stock === 0).length,
      topSold,
    };
  }, [orders, products]);

  if (authReady && (!user || user.role !== "admin")) return <Navigate to="/entrar?r=/admin" replace />;
  if (!user) return null;

  const saveProduct = async () => {
    if (!editing.name.trim() || editing.price <= 0) return toast("Preencha nome e preço válido.", "err");
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
      invalidateCatalog();
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
      invalidateCatalog();
      toast("Produto removido.", "info");
      setDeleteId(null);
      load();
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

  const tiles = [
    { icon: <Banknote size={17} />, label: "Receita", value: brl(stats.revenue), tone: "bg-ok-100 text-ok-700" },
    { icon: <ShoppingBag size={17} />, label: "Pedidos", value: String(stats.orders), tone: "bg-turbo-100 text-turbo-700" },
    { icon: <TrendingUp size={17} />, label: "Ticket médio", value: brl(stats.ticket), tone: "bg-accent-100 text-accent-600" },
    { icon: <Package size={17} />, label: "Produtos ativos", value: String(stats.products), tone: "bg-ink-100 text-ink-600" },
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

  const numField = (label: string, key: "price" | "oldPrice" | "stock", placeholder: string) => (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        className="field"
        value={editing[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setEditing((p) => ({ ...p, [key]: e.target.value === "" ? undefined : Number(e.target.value) }) as Product)}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[24px] font-extrabold text-ink-950 md:text-[28px]">
            <LayoutDashboard size={24} className="text-accent-500" /> Painel admin
          </h1>
          <p className="text-[13px] font-medium text-ink-400">Catálogo, pedidos e estoque em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setResetOpen(true)} className="btn-ghost !py-2 !text-[12.5px]">
            <RotateCcw size={14} /> Resetar dados demo
          </button>
          <button
            onClick={() => {
              setEditing(emptyProduct());
              setFormOpen(true);
            }}
            className="btn-accent !py-2 !text-[13px]"
          >
            <Plus size={15} /> Novo produto
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabBtn("geral", "Visão geral", <TrendingUp size={15} />)}
        {tabBtn("produtos", "Produtos", <Package size={15} />)}
        {tabBtn("pedidos", "Pedidos", <ShoppingBag size={15} />)}
      </div>

      {/* ---- visão geral ---- */}
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

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Mais vendidos</h2>
              {stats.topSold.every((t) => t.sold === 0) ? (
                <p className="mt-3 rounded-xl bg-ink-50 px-4 py-5 text-center text-[13px] font-medium text-ink-400">
                  Nenhum pedido ainda — os rankings aparecem após a primeira venda.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {stats.topSold.map(({ p, sold }, i) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 font-display text-[12.5px] font-extrabold text-accent-400">{i + 1}</span>
                      <img src={p.image} alt="" className="h-11 w-11 rounded-lg bg-ink-50 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink-800">{p.name}</p>
                        <p className="text-[11.5px] font-semibold text-ink-400">{sold} un. vendidas · {brl(p.price)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
              <h2 className="font-display text-[16px] font-extrabold text-ink-900">Alertas de estoque</h2>
              {(products ?? []).filter((p) => p.stock <= 5).length === 0 ? (
                <p className="mt-3 rounded-xl bg-ink-50 px-4 py-5 text-center text-[13px] font-medium text-ink-400">Estoque saudável em todo o catálogo.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(products ?? [])
                    .filter((p) => p.stock <= 5)
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

      {/* ---- produtos ---- */}
      {tab === "produtos" && (
        <div className="mt-5 animate-fadein">
          {products === null ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : products.length === 0 ? (
            <EmptyState icon={<Package size={26} />} title="Catálogo vazio" desc="Crie seu primeiro produto para começar a vender.">
              <button onClick={() => setFormOpen(true)} className="btn-accent"><Plus size={15} /> Novo produto</button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-card shadow-card">
              <table className="w-full min-w-[760px] text-left">
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
                            <span className="block max-w-[260px] truncate text-[13px] font-bold text-ink-800">{p.name}</span>
                            <span className="text-[11px] font-semibold uppercase text-ink-400">{p.brand}{p.turbo && " · turbo"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] font-semibold text-ink-500">{CATS.find((c) => c.id === p.category)?.label ?? p.category}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[13.5px] font-extrabold text-ink-900">{brl(p.price)}</span>
                        {p.oldPrice && <span className="ml-1.5 text-[11px] text-ink-400 line-through">{brl(p.oldPrice)}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${p.stock === 0 ? "bg-danger-100 text-danger-700" : p.stock <= 5 ? "bg-warn-100 text-warn-700" : "bg-ok-100 text-ok-700"}`}>
                          {p.stock} un.
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] font-bold text-ink-600">
                        {p.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="font-medium text-ink-400">({p.ratingCount})</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(JSON.parse(JSON.stringify(p)));
                              setFormOpen(true);
                            }}
                            className="rounded-lg p-2 text-ink-400 transition hover:bg-turbo-100 hover:text-turbo-700"
                            aria-label="Editar"
                          >
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

      {/* ---- pedidos ---- */}
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
                      <p className="font-display text-[14.5px] font-extrabold text-ink-950">{o.id} <span className="ml-1 font-sans text-[12px] font-semibold text-ink-400">{fullDate(o.createdAt)}</span></p>
                      <p className="truncate text-[12.5px] font-semibold text-ink-500">
                        {o.customer} · {o.items.reduce((s, i) => s + i.qty, 0)} itens · {o.payment}
                      </p>
                    </div>
                    <span className="font-display text-[16px] font-extrabold text-ink-950">{brl(o.total)}</span>
                    <StatusChip status={status} />
                    <select
                      value={status}
                      onChange={(e) => setStatus(o, e.target.value as OrderStatus)}
                      className="field w-auto !py-1.5 !text-[12.5px] font-bold"
                      aria-label="Alterar status"
                    >
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

      {/* modal produto */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={products?.some((p) => p.id === editing.id) ? "Editar produto" : "Novo produto"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
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
              {CATS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          {numField("Preço (R$)", "price", "199.90")}
          {numField("Preço antigo (opcional)", "oldPrice", "249.90")}
          {numField("Estoque", "stock", "10")}
          <div>
            <label className="field-label">Imagem</label>
            <input className="field" list="stock-images" value={editing.image} onChange={(e) => setEditing((p) => ({ ...p, image: e.target.value }))} placeholder="/images/p1.jpg ou URL" />
            <datalist id="stock-images">
              {STOCK_IMAGES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {editing.image && <img src={editing.image} alt="prévia" className="mt-2 h-16 w-16 rounded-lg bg-ink-50 object-cover ring-1 ring-ink-100" />}
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
            <textarea
              className="field min-h-20 resize-y"
              value={Array.isArray(editing.features) ? editing.features.join("\n") : (editing.features as unknown as string)}
              onChange={(e) => setEditing((p) => ({ ...p, features: e.target.value as unknown as string[] }))}
              placeholder={"Recurso 1\nRecurso 2"}
            />
          </div>
          <div>
            <label className="field-label">Tags (separadas por vírgula)</label>
            <textarea
              className="field min-h-20 resize-y"
              value={Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags as unknown as string)}
              onChange={(e) => setEditing((p) => ({ ...p, tags: e.target.value as unknown as string[] }))}
              placeholder="fone, bluetooth, musica"
            />
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

      {/* modal excluir */}
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

      {/* modal reset */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Resetar dados da demo?">
        <p className="text-[14px] text-ink-600">
          Catálogo, pedidos, avaliações e contas voltarão ao estado original de fábrica. Sua sessão atual será encerrada.
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
