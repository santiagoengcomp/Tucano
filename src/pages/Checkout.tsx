import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { Check, ChevronDown, CreditCard, MapPin, QrCode, ShoppingCart, Zap } from "lucide-react";
import { api, FREE_SHIPPING_MIN, ORDER_STAGES, SHIPPING_FEE } from "../api/client";
import { useStore } from "../context/Store";
import type { Address, Order, Product, Settings } from "../types";
import { StatusChip } from "../components/ui";
import { brl, maskCEP, maskCard, maskExpiry, uid, validCard, validCEP, validExpiry } from "../utils";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const emptyAddr: Address = { id: "", label: "Entrega", name: "", cep: "", street: "", number: "", city: "", uf: "SP" };

function StepCard({ n, title, open, done, onToggle, children }: { n: number; title: string; open: boolean; done: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card transition ${open ? "border-accent-400 shadow-card" : "border-ink-100"}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-extrabold transition ${
            done ? "bg-ok-600 text-white" : open ? "bg-accent-500 text-ink-900" : "bg-ink-100 text-ink-500"
          }`}
        >
          {done ? <Check size={15} strokeWidth={3} /> : n}
        </span>
        <span className="flex-1 font-display text-[16px] font-extrabold text-ink-900">{title}</span>
        <ChevronDown size={17} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-ink-100 px-4 py-4 animate-fadein sm:px-5">{children}</div>}
    </section>
  );
}

export default function Checkout() {
  const { user, token, authReady, cart, clearCart, toast, refreshUser } = useStore();
  const nav = useNavigate();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"form" | "done">("form");
  const [doneOrder, setDoneOrder] = useState<Order | null>(null);

  const [addrForm, setAddrForm] = useState<Address>({ ...emptyAddr });
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState(false);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");

  const [payMethod, setPayMethod] = useState<"pix" | "card">("pix");
  const [card, setCard] = useState({ num: "", name: "", exp: "", cvv: "" });
  const [placing, setPlacing] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [shopSettings, setShopSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    api.listProducts().then((p) => alive && setProducts(p));
    api.getSettings().then((s) => alive && setShopSettings(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (user && user.addresses.length > 0 && !newAddr && selectedAddr === null) {
      setSelectedAddr(user.addresses[0].id);
      setAddrForm({ ...user.addresses[0] });
    }
    if (user && addrForm.name === "") setAddrForm((a) => ({ ...a, name: user.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ViaCEP — preenchimento automático gratuito */
  useEffect(() => {
    const digits = addrForm.cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    let alive = true;
    setCepStatus("loading");
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((d: { erro?: boolean; logradouro?: string; localidade?: string; uf?: string }) => {
        if (!alive) return;
        if (d.erro) return setCepStatus("err");
        setCepStatus("ok");
        setAddrForm((a) => ({
          ...a,
          street: d.logradouro || a.street,
          city: d.localidade || a.city,
          uf: d.uf || a.uf,
        }));
      })
      .catch(() => alive && setCepStatus("err"));
    return () => {
      alive = false;
    };
  }, [addrForm.cep]);

  const rows = useMemo(
    () =>
      (products ?? [])
        .map((p) => ({ p, qty: cart.find((i) => i.productId === p.id)?.qty ?? 0 }))
        .filter((r) => r.qty > 0),
    [products, cart],
  );
  const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const freeShipMin = shopSettings?.freeShipMin ?? FREE_SHIPPING_MIN;
  const shipFee = shopSettings?.shipFee ?? SHIPPING_FEE;
  const shipping = subtotal >= freeShipMin ? 0 : shipFee;
  const couponOff = coupon?.discount ?? 0;
  const pixOff = payMethod === "pix" ? Math.round((subtotal - couponOff) * 0.05 * 100) / 100 : 0;
  const total = Math.round((subtotal + shipping - couponOff - pixOff) * 100) / 100;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponMsg(null);
    try {
      const v = await api.validatePromo(code, subtotal);
      setCoupon({ code: v.promo.code, discount: v.discount });
      setCouponMsg({ ok: true, text: `Cupom ${v.promo.code} aplicado: −${brl(v.discount)}` });
    } catch (e) {
      setCoupon(null);
      setCouponMsg({ ok: false, text: (e as Error).message });
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponMsg(null);
  };

  const addrValid =
    addrForm.name.trim().length >= 2 &&
    validCEP(addrForm.cep) &&
    addrForm.street.trim().length >= 2 &&
    addrForm.number.trim().length >= 1 &&
    addrForm.city.trim().length >= 2;
  const cardValid = payMethod === "pix" || (validCard(card.num) && card.name.trim().length >= 2 && validExpiry(card.exp) && /^\d{3,4}$/.test(card.cvv));

  if (authReady && !user) return <Navigate to="/entrar?r=/checkout" replace />;

  if (phase === "done" && doneOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center animate-rise">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok-100">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-ok-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-5 font-display text-[28px] font-extrabold text-ink-950">Pedido confirmado!</h1>
        <p className="mt-1 text-[14.5px] text-ink-500">
          Obrigado, {user?.name.split(" ")[0]}. Seu pedido <span className="font-extrabold text-ink-800">{doneOrder.id}</span> já está sendo preparado.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <StatusChip status="confirmado" />
          <span className="text-[12.5px] font-semibold text-ink-400">status avança em tempo real (demo acelerada)</span>
        </div>
        <div className="mt-6 rounded-2xl border border-ink-100 bg-card p-5 text-left shadow-card">
          <div className="flex justify-between text-[14px]">
            <span className="font-semibold text-ink-500">Total {payMethod === "pix" ? "(Pix, 5% OFF)" : "no cartão"}</span>
            <span className="font-display text-[18px] font-extrabold text-ink-950">{brl(doneOrder.total)}</span>
          </div>
          <ol className="mt-4 space-y-3">
            {ORDER_STAGES.map((s, i) => (
              <li key={s.status} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${i === 0 ? "bg-accent-500 text-ink-900" : "bg-ink-100 text-ink-400"}`}>
                  {i + 1}
                </span>
                <span className={`text-[13.5px] font-semibold ${i === 0 ? "text-ink-900" : "text-ink-400"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to={`/pedidos/${doneOrder.id}`} className="btn-accent">Acompanhar pedido</Link>
          <Link to="/" className="btn-ghost">Voltar à loja</Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14">
        <div className="rounded-2xl border border-dashed border-ink-200 bg-card p-8 text-center">
          <ShoppingCart size={30} className="mx-auto text-ink-300" />
          <h1 className="mt-3 font-display text-xl font-extrabold text-ink-900">Nada para finalizar</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">Adicione produtos ao carrinho antes de ir para o checkout.</p>
          <Link to="/busca" className="btn-accent mt-4">Ir para o catálogo</Link>
        </div>
      </div>
    );
  }

  const place = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      const address: Address = { ...addrForm, id: selectedAddr && !newAddr ? selectedAddr : uid() };
      const payment =
        payMethod === "pix" ? "Pix (aprovação imediata)" : `Cartão final ${card.num.replace(/\D/g, "").slice(-4)}`;
      const order = await api.createOrder(token, { items: cart, address, payment, couponCode: coupon?.code });
      if (newAddr || !user?.addresses.some((a) => a.id === selectedAddr)) {
        await api.updateProfile(token, { addresses: [...(user?.addresses ?? []).filter((a) => a.id !== address.id), address] }).catch(() => {});
        refreshUser().catch(() => {});
      }
      clearCart();
      setDoneOrder(order);
      setPhase("done");
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, colors: ["#ff9e1b", "#0e7c86", "#16222e", "#ffffff"] });
      toast("Pagamento aprovado. Pedido criado!");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setPlacing(false);
    }
  };

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddrForm((a) => ({ ...a, [k]: k === "cep" ? maskCEP(e.target.value) : e.target.value }));

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold text-ink-900 md:text-[28px]">Finalizar compra</h1>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-3">
          {/* 1 — endereço */}
          <StepCard n={1} title="Endereço de entrega" open={step === 1} done={step > 1} onToggle={() => setStep(1)}>
            {user && user.addresses.length > 0 && (
              <div className="mb-3 space-y-2">
                {user.addresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedAddr(a.id);
                      setNewAddr(false);
                      setAddrForm({ ...a });
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                      selectedAddr === a.id && !newAddr ? "border-accent-500 bg-accent-50 ring-1 ring-accent-400" : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <MapPin size={16} className="mt-0.5 shrink-0 text-accent-600" />
                    <span className="text-[13px] leading-snug">
                      <span className="font-bold text-ink-900">{a.label} — {a.name}</span>
                      <span className="block text-ink-500">{a.street}, {a.number} · {a.city}/{a.uf} · CEP {a.cep}</span>
                    </span>
                  </button>
                ))}
                <button onClick={() => { setNewAddr(true); setSelectedAddr(null); }} className="text-[12.5px] font-bold text-turbo-700 hover:underline">
                  + Usar outro endereço
                </button>
              </div>
            )}

            {(newAddr || !user?.addresses.length) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label">Nome do destinatário</label>
                  <input className="field" value={addrForm.name} onChange={set("name")} placeholder="Quem recebe" />
                </div>
                <div>
                  <label className="field-label">CEP {cepStatus === "loading" && <span className="text-turbo-600">· buscando…</span>}{cepStatus === "ok" && <span className="text-ok-600">· endereço encontrado</span>}{cepStatus === "err" && <span className="text-warn-600">· não localizado</span>}</label>
                  <input className="field" inputMode="numeric" value={addrForm.cep} onChange={set("cep")} placeholder="00000-000" />
                </div>
                <div>
                  <label className="field-label">Número</label>
                  <input className="field" value={addrForm.number} onChange={set("number")} placeholder="123" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Rua / Avenida</label>
                  <input className="field" value={addrForm.street} onChange={set("street")} placeholder="Endereço" />
                </div>
                <div>
                  <label className="field-label">Cidade</label>
                  <input className="field" value={addrForm.city} onChange={set("city")} placeholder="Cidade" />
                </div>
                <div>
                  <label className="field-label">UF</label>
                  <select className="field" value={addrForm.uf} onChange={set("uf")}>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  if (!addrValid) return toast("Preencha o endereço completo para continuar.", "err");
                  setStep(2);
                }}
                className="btn-accent"
              >
                Continuar para pagamento
              </button>
            </div>
          </StepCard>

          {/* 2 — pagamento */}
          <StepCard n={2} title="Pagamento" open={step === 2} done={step > 2} onToggle={() => setStep(Math.min(step, 2) === 2 ? step : 2)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => setPayMethod("pix")}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${payMethod === "pix" ? "border-ok-600 bg-ok-100/60 ring-1 ring-ok-600" : "border-ink-200 hover:border-ink-300"}`}
              >
                <QrCode size={20} className={payMethod === "pix" ? "text-ok-700" : "text-ink-400"} />
                <span>
                  <span className="block text-[14px] font-extrabold text-ink-900">Pix</span>
                  <span className="block text-[11.5px] font-semibold text-ok-700">aprovação imediata · 5% OFF</span>
                </span>
              </button>
              <button
                onClick={() => setPayMethod("card")}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${payMethod === "card" ? "border-accent-500 bg-accent-50 ring-1 ring-accent-400" : "border-ink-200 hover:border-ink-300"}`}
              >
                <CreditCard size={20} className={payMethod === "card" ? "text-accent-600" : "text-ink-400"} />
                <span>
                  <span className="block text-[14px] font-extrabold text-ink-900">Cartão de crédito</span>
                  <span className="block text-[11.5px] font-semibold text-ink-400">até 10x sem juros</span>
                </span>
              </button>
            </div>

            {payMethod === "pix" ? (
              <p className="mt-3 rounded-xl bg-ink-50 px-4 py-3 text-[13px] font-medium text-ink-600">
                O QR Code Pix será gerado após a confirmação — pagamento simulado para demonstração, sem cobrança real.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label">Número do cartão</label>
                  <input className="field font-mono" inputMode="numeric" value={card.num} onChange={(e) => setCard((c) => ({ ...c, num: maskCard(e.target.value) }))} placeholder="0000 0000 0000 0000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Nome impresso</label>
                  <input className="field" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))} placeholder="COMO NO CARTÃO" />
                </div>
                <div>
                  <label className="field-label">Validade</label>
                  <input className="field font-mono" inputMode="numeric" value={card.exp} onChange={(e) => setCard((c) => ({ ...c, exp: maskExpiry(e.target.value) }))} placeholder="MM/AA" />
                </div>
                <div>
                  <label className="field-label">CVV</label>
                  <input className="field font-mono" inputMode="numeric" value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="123" />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  if (!cardValid) return toast("Revise os dados do cartão.", "err");
                  setStep(3);
                }}
                className="btn-accent"
              >
                Revisar pedido
              </button>
            </div>
          </StepCard>

          {/* 3 — revisão */}
          <StepCard n={3} title="Revisão do pedido" open={step === 3} done={false} onToggle={() => addrValid && setStep(3)}>
            <div className="space-y-2.5">
              {rows.map(({ p, qty }) => (
                <div key={p.id} className="flex items-center gap-3">
                  <img src={p.image} alt="" className="h-12 w-12 rounded-lg bg-ink-50 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-800">{p.name}</p>
                    <p className="text-[11.5px] font-semibold text-ink-400">{qty}x {brl(p.price)}</p>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-ink-900">{brl(p.price * qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[12.5px] font-medium text-ink-600">
              <MapPin size={14} className="mt-0.5 shrink-0 text-accent-600" />
              Entregar para {addrForm.name} — {addrForm.street}, {addrForm.number}, {addrForm.city}/{addrForm.uf}
            </div>
          </StepCard>
        </div>

        {/* resumo */}
        <aside className="h-fit rounded-2xl border border-ink-100 bg-card p-5 shadow-card lg:sticky lg:top-32">
          <h2 className="font-display text-[17px] font-extrabold text-ink-900">Resumo</h2>

          {coupon ? (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-ok-100 px-3 py-2">
              <span className="font-mono text-[13px] font-extrabold text-ok-700">{coupon.code}</span>
              <button onClick={removeCoupon} className="text-[11.5px] font-bold text-ok-700 underline-offset-2 hover:underline">
                remover
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Cupom de desconto"
                  className="field !py-2 font-mono !text-[13px] uppercase"
                />
                <button onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()} className="btn-dark shrink-0 !px-4 !py-2 !text-[13px]">
                  {checkingCoupon ? "…" : "Aplicar"}
                </button>
              </div>
              {couponMsg && (
                <p className={`mt-1.5 text-[12px] font-semibold ${couponMsg.ok ? "text-ok-600" : "text-danger-600"}`}>{couponMsg.text}</p>
              )}
            </div>
          )}

          <dl className="mt-3 space-y-2 text-[14px]">
            <div className="flex justify-between text-ink-600">
              <dt>Itens ({rows.reduce((s, r) => s + r.qty, 0)})</dt>
              <dd className="font-bold text-ink-800">{brl(subtotal)}</dd>
            </div>
            {couponOff > 0 && (
              <div className="flex justify-between text-ok-700">
                <dt>Cupom {coupon?.code}</dt>
                <dd className="font-bold">− {brl(couponOff)}</dd>
              </div>
            )}
            <div className="flex justify-between text-ink-600">
              <dt>Frete</dt>
              <dd className={`font-bold ${shipping === 0 ? "text-ok-600" : "text-ink-800"}`}>{shipping === 0 ? "Grátis" : brl(shipping)}</dd>
            </div>
            {pixOff > 0 && (
              <div className="flex justify-between text-ok-700">
                <dt>Desconto Pix (5%)</dt>
                <dd className="font-bold">− {brl(pixOff)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-ink-200 pt-2.5 text-[17px] font-extrabold text-ink-950">
              <dt>Total</dt>
              <dd>{brl(total)}</dd>
            </div>
          </dl>
          {rows.some((r) => r.p.turbo) && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-turbo-100 px-3 py-2 text-[11.5px] font-extrabold text-turbo-700">
              <Zap size={12} fill="currentColor" strokeWidth={0} /> Parte do pedido com Entrega Turbo (2h)
            </p>
          )}
          <button onClick={place} disabled={placing || step < 3} className="btn-accent mt-4 w-full !py-3">
            {placing ? "Processando pagamento…" : `Confirmar pedido · ${brl(total)}`}
          </button>
          <p className="mt-2.5 text-center text-[11px] font-medium text-ink-400">
            Demonstração — nenhum valor real é cobrado.
          </p>
        </aside>
      </div>
    </div>
  );
}
