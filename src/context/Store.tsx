import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { CartItem, Product, Toast, ToastKind, User } from "../types";

const TOKEN_KEY = "tucano_token";
const CART_KEY = "tucano_cart";
const WISH_KEY = "tucano_wish";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type Store = {
  user: User | null;
  token: string | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;

  cart: CartItem[];
  cartCount: number;
  cartPulse: number;
  addToCart: (p: Product, qty?: number, opts?: { silent?: boolean }) => boolean;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  saveForLater: (productId: string) => void;

  wish: string[];
  toggleWish: (p: Product) => void;
  isWished: (id: string) => boolean;

  toasts: Toast[];
  toast: (msg: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => readJSON(CART_KEY, [] as CartItem[]));
  const [wish, setWish] = useState<string[]>(() => readJSON(WISH_KEY, [] as string[]));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartPulse, setCartPulse] = useState(0);
  const toastId = useRef(1);

  const toast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) {
        try {
          const u = await api.me(t);
          if (alive) setUserState(u);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          if (alive) setToken(null);
        }
      }
      if (alive) setAuthReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem(WISH_KEY, JSON.stringify(wish)), [wish]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) setUserState(await api.me(t));
  }, []);

  const addToCart = useCallback(
    (p: Product, qty = 1, opts?: { silent?: boolean }) => {
      if (p.stock < 1) {
        toast("Produto esgotado no momento.", "err");
        return false;
      }
      const found = cart.find((i) => i.productId === p.id);
      const current = found?.qty ?? 0;
      const next = Math.min(current + qty, p.stock);
      if (next === current) {
        toast(`Estoque máximo atingido (${p.stock} un.).`, "info");
        return false;
      }
      setCart(found ? cart.map((i) => (i.productId === p.id ? { ...i, qty: next } : i)) : [...cart, { productId: p.id, qty: next }]);
      setCartPulse((n) => n + 1);
      if (!opts?.silent) toast(`Adicionado ao carrinho: ${p.name.slice(0, 34)}${p.name.length > 34 ? "…" : ""}`);
      return true;
    },
    [cart, toast],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((c) =>
      qty < 1 ? c.filter((i) => i.productId !== productId) : c.map((i) => (i.productId === productId ? { ...i, qty } : i)),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((c) => c.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback(
    (p: Product) => {
      setWish((w) => {
        const has = w.includes(p.id);
        toast(has ? "Removido dos favoritos." : "Salvo nos favoritos.", has ? "info" : "ok");
        return has ? w.filter((x) => x !== p.id) : [p.id, ...w];
      });
    },
    [toast],
  );

  const saveForLater = useCallback(
    (productId: string) => {
      setCart((c) => c.filter((i) => i.productId !== productId));
      setWish((w) => (w.includes(productId) ? w : [productId, ...w]));
      toast("Item salvo para depois.");
    },
    [toast],
  );

  const value = useMemo<Store>(
    () => ({
      user,
      token,
      authReady,
      login,
      register,
      logout,
      refreshUser,
      setUser: setUserState,
      cart,
      cartCount: cart.reduce((s, i) => s + i.qty, 0),
      cartPulse,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      saveForLater,
      wish,
      toggleWish,
      isWished: (id: string) => wish.includes(id),
      toasts,
      toast,
      dismissToast,
    }),
    [user, token, authReady, login, register, logout, refreshUser, cart, cartPulse, addToCart, setQty, removeFromCart, clearCart, saveForLater, wish, toggleWish, toasts, toast, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore fora do StoreProvider");
  return ctx;
}
