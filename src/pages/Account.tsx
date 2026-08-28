import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LayoutDashboard, LogOut, MapPin, Package, Pencil, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { api } from "../api/client";
import { useStore } from "../context/Store";
import type { Address } from "../types";
import { Modal } from "../components/ui";
import { maskCEP, uid, validCEP } from "../utils";

/* ---------------- LOGIN / CADASTRO ---------------- */
export function LoginPage() {
  const { user, login, register, toast } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const r = params.get("r") ?? "/conta";
  const [mode, setMode] = useState<"entrar" | "criar">(params.get("modo") === "criar" ? "criar" : "entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) nav(r, { replace: true });
  }, [user, nav, r]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = mode === "entrar" ? await login(email, password) : await register(name, email, password);
      toast(`Bem-vindo(a), ${u.name.split(" ")[0]}!`);
      nav(r, { replace: true });
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const fill = (kind: "demo" | "admin") => {
    setMode("entrar");
    if (kind === "demo") {
      setEmail("cliente@demo.com");
      setPassword("demo123");
    } else {
      setEmail("admin@tucano.com");
      setPassword("admin123");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8 md:py-12 animate-fadein">
      <div className="rounded-2xl border border-ink-100 bg-card p-6 shadow-card">
        <h1 className="font-display text-[24px] font-extrabold text-ink-950">
          {mode === "entrar" ? "Entrar na sua conta" : "Criar conta grátis"}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          {mode === "entrar" ? "Acesse pedidos, favoritos e checkout em 1 clique." : "Leva menos de um minuto — sem cartão."}
        </p>

        <div className="mt-4 grid grid-cols-2 rounded-full bg-ink-100 p-1">
          {(["entrar", "criar"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full py-2 text-[13px] font-extrabold transition ${
                mode === m ? "bg-ink-900 text-white shadow" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          {mode === "criar" && (
            <div>
              <label className="field-label">Nome completo</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria da Silva" autoComplete="name" />
            </div>
          )}
          <div>
            <label className="field-label">E-mail</label>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="field-label">Senha</label>
            <div className="relative">
              <input
                className="field pr-11"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "criar" ? "mínimo 6 caracteres" : "Sua senha"}
                autoComplete={mode === "criar" ? "new-password" : "current-password"}
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition hover:text-ink-700" aria-label="Mostrar senha">
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-accent w-full !py-3">
            {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar minha conta"}
          </button>
        </form>

        <div className="mt-5 rounded-xl bg-ink-50 p-3.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wide text-ink-400">
            <ShieldCheck size={13} className="text-turbo-600" /> Contas de teste
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => fill("demo")} className="rounded-full border border-turbo-600/40 bg-turbo-100 px-3 py-1.5 text-[12px] font-bold text-turbo-700 transition hover:bg-turbo-600 hover:text-white">
              cliente@demo.com · demo123
            </button>
            <button onClick={() => fill("admin")} className="rounded-full border border-accent-500/50 bg-accent-100 px-3 py-1.5 text-[12px] font-bold text-accent-600 transition hover:bg-accent-500 hover:text-ink-900">
              admin@tucano.com · admin123
            </button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-ink-400">Toque para preencher automaticamente.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- CONTA ---------------- */
const emptyAddr: Address = { id: "", label: "Casa", name: "", cep: "", street: "", number: "", city: "", uf: "SP" };

function AddressModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Address | null; onSave: (a: Address) => void }) {
  const [a, setA] = useState<Address>(emptyAddr);
  useEffect(() => {
    if (open) setA(initial ?? { ...emptyAddr });
  }, [open, initial]);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setA((x) => ({ ...x, [k]: k === "cep" ? maskCEP(e.target.value) : e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Editar endereço" : "Novo endereço"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Apelido</label>
          <input className="field" value={a.label} onChange={set("label")} placeholder="Casa, Trabalho…" />
        </div>
        <div>
          <label className="field-label">Destinatário</label>
          <input className="field" value={a.name} onChange={set("name")} placeholder="Nome" />
        </div>
        <div>
          <label className="field-label">CEP</label>
          <input className="field" inputMode="numeric" value={a.cep} onChange={set("cep")} placeholder="00000-000" />
        </div>
        <div>
          <label className="field-label">Número</label>
          <input className="field" value={a.number} onChange={set("number")} placeholder="123" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Rua / Avenida</label>
          <input className="field" value={a.street} onChange={set("street")} placeholder="Endereço" />
        </div>
        <div>
          <label className="field-label">Cidade</label>
          <input className="field" value={a.city} onChange={set("city")} placeholder="Cidade" />
        </div>
        <div>
          <label className="field-label">UF</label>
          <select className="field" value={a.uf} onChange={set("uf")}>
            {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={() => onSave({ ...a, id: a.id || uid() })}
        disabled={!(a.name.trim() && validCEP(a.cep) && a.street.trim() && a.number.trim() && a.city.trim())}
        className="btn-accent mt-5 w-full"
      >
        Salvar endereço
      </button>
    </Modal>
  );
}

export function AccountPage() {
  const { user, token, authReady, logout, setUser, toast } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [addrModal, setAddrModal] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (authReady && !user) return <Navigate to="/entrar?r=/conta" replace />;
  if (!user) return null;

  const saveName = async () => {
    if (name.trim().length < 2) return toast("Nome muito curto.", "err");
    setSavingName(true);
    try {
      setUser(await api.updateProfile(token, { name }));
      toast("Perfil atualizado!");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSavingName(false);
    }
  };

  const saveAddress = async (a: Address) => {
    try {
      const exists = user.addresses.some((x) => x.id === a.id);
      const addresses = exists ? user.addresses.map((x) => (x.id === a.id ? a : x)) : [...user.addresses, a];
      setUser(await api.updateProfile(token, { addresses }));
      setAddrModal(false);
      setEditing(null);
      toast("Endereço salvo!");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      setUser(await api.updateProfile(token, { addresses: user.addresses.filter((a) => a.id !== id) }));
      toast("Endereço removido.", "info");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-5 md:px-6 md:py-7 animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold text-ink-950 md:text-[28px]">Minha conta</h1>
          <p className="text-[13px] font-medium text-ink-400">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <Link to="/admin" className="btn-ghost !py-2 !text-[13px]">
              <LayoutDashboard size={15} /> Painel admin
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              toast("Você saiu da conta.", "info");
              nav("/");
            }}
            className="btn-ghost !py-2 !text-[13px] !text-danger-600"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold text-ink-900">
            <UserRound size={17} className="text-accent-600" /> Perfil
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="field-label">Nome</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">E-mail (login)</label>
              <input className="field opacity-60" value={user.email} readOnly />
            </div>
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${user.role === "admin" ? "bg-accent-100 text-accent-600" : "bg-turbo-100 text-turbo-700"}`}>
                {user.role === "admin" ? "Administrador" : "Cliente"}
              </span>
              <button onClick={saveName} disabled={savingName} className="btn-accent !py-2 !text-[13px]">
                {savingName ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold text-ink-900">
              <MapPin size={17} className="text-accent-600" /> Endereços
            </h2>
            <button onClick={() => { setEditing(null); setAddrModal(true); }} className="btn-ghost !px-3 !py-1.5 !text-[12.5px]">
              <Plus size={14} /> Novo
            </button>
          </div>
          {user.addresses.length === 0 ? (
            <p className="mt-4 rounded-xl bg-ink-50 px-4 py-5 text-center text-[13px] font-medium text-ink-400">
              Nenhum endereço cadastrado ainda.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {user.addresses.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-ink-100 p-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-ink-900">{a.label} · {a.name}</p>
                    <p className="text-[12.5px] text-ink-500">{a.street}, {a.number} — {a.city}/{a.uf} · {a.cep}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditing(a); setAddrModal(true); }} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-turbo-700" aria-label="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteAddress(a.id)} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-danger-100 hover:text-danger-600" aria-label="Remover">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link to="/pedidos" className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-lift">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-600"><Package size={18} /></span>
          <span>
            <span className="block text-[14px] font-extrabold text-ink-900">Meus pedidos</span>
            <span className="block text-[12px] font-medium text-ink-400">acompanhe em tempo real</span>
          </span>
        </Link>
        <Link to="/favoritos" className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-lift">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-100 text-danger-600">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.6 2.3 4.9 5.9 4.6 8 4.4 9.7 5.5 12 8c2.3-2.5 4-3.6 6.1-3.4 3.6.3 5.5 4 3.9 7.1C19.5 16.3 12 21 12 21z"/></svg>
          </span>
          <span>
            <span className="block text-[14px] font-extrabold text-ink-900">Favoritos</span>
            <span className="block text-[12px] font-medium text-ink-400">sua lista de desejos</span>
          </span>
        </Link>
        <Link to="/carrinho" className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-lift">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-turbo-100 text-turbo-700">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1.5 1.5 0 0 0 1.5 1.1h8.9a1.5 1.5 0 0 0 1.4-1.1L21.5 8H6"/></svg>
          </span>
          <span>
            <span className="block text-[14px] font-extrabold text-ink-900">Carrinho</span>
            <span className="block text-[12px] font-medium text-ink-400">finalize sua compra</span>
          </span>
        </Link>
      </section>

      <AddressModal open={addrModal} onClose={() => { setAddrModal(false); setEditing(null); }} initial={editing} onSave={saveAddress} />
    </div>
  );
}
