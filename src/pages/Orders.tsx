import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Check, MapPin, Package, Truck, XCircle } from "lucide-react";
import { api, nextStageIn, ORDER_STAGES, orderStatus } from "../api/client";
import { useStore } from "../context/Store";
import type { Order } from "../types";
import { EmptyState, Modal, StatusChip } from "../components/ui";
import { brl, fmtMs, fullDate } from "../utils";

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function Timeline({ order }: { order: Order }) {
  const status = orderStatus(order);
  const cancelled = status === "cancelado";
  const idx = ORDER_STAGES.findIndex((s) => s.status === status);
  const remaining = nextStageIn(order);
  const icons = [<Check size={14} key="c" />, <Package size={14} key="p" />, <Truck size={14} key="e" />, <MapPin size={14} key="m" />];

  return (
    <div>
      <ol className="relative ml-3 space-y-4 border-l-2 border-ink-100 pl-5">
        {ORDER_STAGES.map((s, i) => {
          const done = !cancelled && idx >= i;
          const current = !cancelled && idx === i;
          return (
            <li key={s.status} className="relative">
              <span
                className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-paper transition-all ${
                  done ? "bg-ok-600 text-white" : "bg-ink-100 text-ink-400"
                } ${current ? "animate-pop" : ""}`}
              >
                {done ? icons[i] : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <p className={`text-[13.5px] font-bold ${done ? "text-ink-900" : "text-ink-400"}`}>
                {s.label}
                {current && status !== "entregue" && remaining > 0 && (
                  <span className="ml-2 rounded bg-accent-100 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-accent-600">
                    próxima etapa em {fmtMs(remaining)}
                  </span>
                )}
              </p>
              <p className={`text-[12px] ${done ? "text-ink-500" : "text-ink-300"}`}>{s.hint}</p>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-danger-100 px-4 py-3 text-[13px] font-bold text-danger-700">
          <XCircle size={16} /> Pedido cancelado — o estorno foi processado automaticamente.
        </p>
      )}
    </div>
  );
}

export function OrdersPage() {
  const { user, token, authReady } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");
  useTick();

  const load = useCallback(() => {
    api.listOrders(token).then(setOrders).catch((e) => setErr((e as Error).message));
  }, [token]);
  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  if (authReady && !user) return <Navigate to="/entrar?r=/pedidos" replace />;

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold text-ink-900 md:text-[28px]">Meus pedidos</h1>
      <p className="mt-0.5 text-[13px] font-medium text-ink-400">O status avança em tempo real — demonstração acelerada.</p>

      {err ? (
        <div className="mt-5">
          <EmptyState icon={<Package size={26} />} title="Não foi possível carregar" desc={err}>
            <button onClick={load} className="btn-accent">Tentar novamente</button>
          </EmptyState>
        </div>
      ) : orders === null ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon={<Package size={28} />} title="Você ainda não fez pedidos" desc="Quando comprar algo, o acompanhamento aparece aqui em tempo real.">
            <Link to="/busca" className="btn-accent">Começar a comprar</Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {orders.map((o) => {
            const status = orderStatus(o);
            return (
              <Link
                key={o.id}
                to={`/pedidos/${o.id}`}
                className="block rounded-2xl border border-ink-100 bg-card p-4 transition hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-lift sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-display text-[16px] font-extrabold text-ink-950">{o.id}</span>
                    <span className="ml-2.5 text-[12.5px] font-semibold text-ink-400">{fullDate(o.createdAt)}</span>
                  </div>
                  <StatusChip status={status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 4).map((it) => (
                      <img key={it.productId} src={it.image} alt="" className="h-12 w-12 rounded-lg border-2 border-card bg-ink-50 object-cover" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink-600">
                      {o.items.reduce((s, i) => s + i.qty, 0)} itens · {o.items[0]?.name}
                      {o.items.length > 1 ? " e mais…" : ""}
                    </p>
                    <p className="text-[12px] font-medium text-ink-400">{o.payment}</p>
                  </div>
                  <span className="font-display text-[18px] font-extrabold text-ink-950">{brl(o.total)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user, token, authReady, toast } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useTick();

  const load = useCallback(() => {
    if (!id) return;
    api.getOrder(token, id).then(setOrder).catch(() => setNotFound(true));
  }, [id, token]);

  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  if (authReady && !user) return <Navigate to="/entrar?r=/pedidos" replace />;

  if (notFound || !id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14">
        <EmptyState icon={<Package size={26} />} title="Pedido não encontrado" desc="Confira o número do pedido ou veja a lista completa.">
          <Link to="/pedidos" className="btn-accent">Meus pedidos</Link>
        </EmptyState>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-3 py-6 md:px-6">
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  const status = orderStatus(order);
  const canCancel = status === "confirmado" || status === "preparando";
  const eta = new Date(order.createdAt + 3 * 864e5);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelOrder(token, order.id);
      toast("Pedido cancelado. Estorno processado.", "info");
      setConfirmCancel(false);
      load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <Link to="/pedidos" className="text-[13px] font-bold text-turbo-700 hover:underline">← Meus pedidos</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold text-ink-950 md:text-[26px]">Pedido {order.id}</h1>
          <p className="text-[13px] font-medium text-ink-400">
            realizado em {fullDate(order.createdAt)} · {order.payment}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={status} />
          {canCancel && (
            <button onClick={() => setConfirmCancel(true)} className="btn-ghost !px-4 !py-2 !text-[12.5px] !text-danger-600">
              Cancelar pedido
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-[16px] font-extrabold text-ink-900">Acompanhamento</h2>
          <Timeline order={order} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
            <h2 className="font-display text-[16px] font-extrabold text-ink-900">Itens ({order.items.reduce((s, i) => s + i.qty, 0)})</h2>
            <div className="mt-3 space-y-3">
              {order.items.map((it) => (
                <Link key={it.productId} to={`/produto/${it.productId}`} className="flex items-center gap-3 transition hover:opacity-80">
                  <img src={it.image} alt="" className="h-14 w-14 rounded-lg bg-ink-50 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-bold text-ink-800">{it.name}</p>
                    <p className="text-[12px] font-semibold text-ink-400">{it.qty}x {brl(it.price)}</p>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-ink-900">{brl(it.price * it.qty)}</span>
                </Link>
              ))}
            </div>
            <dl className="mt-4 space-y-1.5 border-t border-dashed border-ink-200 pt-3 text-[13.5px]">
              <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd className="font-bold">{brl(order.subtotal)}</dd></div>
              <div className="flex justify-between text-ink-600"><dt>Frete</dt><dd className={`font-bold ${order.shipping === 0 ? "text-ok-600" : ""}`}>{order.shipping === 0 ? "Grátis" : brl(order.shipping)}</dd></div>
              <div className="flex justify-between pt-1 text-[15.5px] font-extrabold text-ink-950"><dt>Total</dt><dd>{brl(order.total)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink-900">
              <MapPin size={16} className="text-accent-600" /> Entrega
            </h2>
            <p className="mt-2 text-[13px] font-semibold text-ink-700">{order.address.name}</p>
            <p className="text-[13px] text-ink-500">
              {order.address.street}, {order.address.number}
              <br />
              {order.address.city}/{order.address.uf} · CEP {order.address.cep}
            </p>
            {status !== "entregue" && status !== "cancelado" && (
              <p className="mt-3 rounded-lg bg-turbo-100 px-3 py-2 text-[12px] font-extrabold text-turbo-700">
                Chegará até {fullDate(eta.getTime())}
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancelar pedido?">
        <p className="text-[14px] text-ink-600">
          O pedido <span className="font-bold text-ink-900">{order.id}</span> será cancelado, o estoque devolvido e o valor de{" "}
          <span className="font-bold text-ink-900">{brl(order.total)}</span> estornado. Essa ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setConfirmCancel(false)} className="btn-ghost flex-1">Manter pedido</button>
          <button onClick={doCancel} disabled={cancelling} className="flex-1 rounded-full bg-danger-600 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-danger-700 active:scale-[0.97] disabled:opacity-50">
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
