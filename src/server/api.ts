import { loadDB, resetDB, saveDB, type StoredUser } from "./db";
import seed from "../data/catalog.json";
import type { Address, CartItem, Category, Order, OrderStatus, Product, Review, User } from "../types";

/**
 * Backend simulado (modo demo): mesmas rotas e contratos do servidor Node
 * em /backend/server.js. Troque para o servidor real definindo
 * VITE_API_URL no build (ex.: VITE_API_URL=http://localhost:4000).
 */

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

const delay = () => new Promise((r) => setTimeout(r, 200 + Math.random() * 280));

function toUser(u: StoredUser): User {
  const { password: _pw, ...rest } = u;
  return rest;
}

function makeToken(userId: string): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ uid: userId, exp: Date.now() + 7 * 864e5 }))));
}

function authUser(token?: string | null): StoredUser {
  if (!token) throw new ApiError("Entre na sua conta para continuar.", 401);
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(token)))) as { uid: string; exp: number };
    if (payload.exp < Date.now()) throw new Error();
    const db = loadDB();
    const user = db.users.find((u) => u.id === payload.uid);
    if (!user) throw new Error();
    return user;
  } catch {
    throw new ApiError("Sessão expirada. Entre novamente.", 401);
  }
}

function requireAdmin(token?: string | null): StoredUser {
  const user = authUser(token);
  if (user.role !== "admin") throw new ApiError("Acesso restrito à administração.", 403);
  return user;
}

/* ---------- progresso de pedido (demo acelerada) ---------- */
export const ORDER_STAGES: { status: OrderStatus; after: number; label: string; hint: string }[] = [
  { status: "confirmado", after: 0, label: "Pagamento confirmado", hint: "Recebemos seu pedido e o pagamento foi aprovado." },
  { status: "preparando", after: 60_000, label: "Em separação", hint: "Seus itens estão sendo separados no centro de distribuição." },
  { status: "enviado", after: 180_000, label: "Enviado", hint: "O pacote saiu para entrega e está a caminho." },
  { status: "entregue", after: 360_000, label: "Entregue", hint: "Pedido entregue. Aproveite!" },
];

export function orderStatus(o: Order): OrderStatus {
  if (o.cancelled) return "cancelado";
  if (o.statusOverride) return o.statusOverride;
  const elapsed = Date.now() - o.createdAt;
  let current: OrderStatus = "confirmado";
  for (const s of ORDER_STAGES) if (elapsed >= s.after) current = s.status;
  return current;
}

export function stageIndex(o: Order): number {
  return ORDER_STAGES.findIndex((s) => s.status === orderStatus(o));
}

export function nextStageIn(o: Order): number {
  const idx = stageIndex(o);
  if (idx < 0 || idx >= ORDER_STAGES.length - 1) return 0;
  return Math.max(0, o.createdAt + ORDER_STAGES[idx + 1].after - Date.now());
}

export const FREE_SHIPPING_MIN = 149;
export const SHIPPING_FEE = 19.9;

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export const api = {
  async listCategories(): Promise<Category[]> {
    await delay();
    return JSON.parse(JSON.stringify(seed.categories)) as Category[];
  },

  async listProducts(): Promise<Product[]> {
    await delay();
    const db = loadDB();
    return JSON.parse(JSON.stringify(db.products)) as Product[];
  },

  async getProduct(id: string): Promise<Product> {
    await delay();
    const db = loadDB();
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new ApiError("Produto não encontrado.", 404);
    return JSON.parse(JSON.stringify(p));
  },

  async listReviews(productId: string): Promise<Review[]> {
    await delay();
    const db = loadDB();
    return db.reviews.filter((r) => r.productId === productId).sort((a, b) => b.date - a.date)
      .map((r) => ({ ...r }));
  },

  async addReview(token: string | null, productId: string, body: { rating: number; title: string; text: string }): Promise<Review> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    const p = db.products.find((x) => x.id === productId);
    if (!p) throw new ApiError("Produto não encontrado.", 404);
    if (body.rating < 1 || body.rating > 5) throw new ApiError("Escolha de 1 a 5 estrelas.");
    if (body.title.trim().length < 3) throw new ApiError("Dê um título à sua avaliação.");
    if (body.text.trim().length < 10) throw new ApiError("Conte um pouco mais (mín. 10 caracteres).");
    const review: Review = {
      id: "r" + Date.now().toString(36),
      productId,
      user: user.name,
      rating: body.rating,
      title: body.title.trim(),
      text: body.text.trim(),
      date: Date.now(),
    };
    db.reviews.unshift(review);
    p.rating = Math.round(((p.rating * p.ratingCount + body.rating) / (p.ratingCount + 1)) * 10) / 10;
    p.ratingCount += 1;
    saveDB(db);
    return { ...review };
  },

  async register(body: { name: string; email: string; password: string }): Promise<{ token: string; user: User }> {
    await delay();
    const db = loadDB();
    const name = body.name.trim();
    const email = body.email.trim().toLowerCase();
    if (name.length < 2) throw new ApiError("Informe seu nome completo.");
    if (!validateEmail(email)) throw new ApiError("E-mail inválido.");
    if (body.password.length < 6) throw new ApiError("A senha precisa de pelo menos 6 caracteres.");
    if (db.users.some((u) => u.email === email)) throw new ApiError("Já existe uma conta com este e-mail.", 409);
    const user: StoredUser = {
      id: "u" + Date.now().toString(36),
      name,
      email,
      password: body.password,
      role: "customer",
      addresses: [],
    };
    db.users.push(user);
    saveDB(db);
    return { token: makeToken(user.id), user: toUser(user) };
  },

  async login(body: { email: string; password: string }): Promise<{ token: string; user: User }> {
    await delay();
    const db = loadDB();
    const user = db.users.find((u) => u.email === body.email.trim().toLowerCase());
    if (!user || user.password !== body.password) throw new ApiError("E-mail ou senha incorretos.", 401);
    return { token: makeToken(user.id), user: toUser(user) };
  },

  async me(token: string | null): Promise<User> {
    await delay();
    return toUser(authUser(token));
  },

  async updateProfile(token: string | null, body: { name?: string; addresses?: Address[] }): Promise<User> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    const stored = db.users.find((u) => u.id === user.id)!;
    if (body.name !== undefined) {
      if (body.name.trim().length < 2) throw new ApiError("Nome muito curto.");
      stored.name = body.name.trim();
    }
    if (body.addresses !== undefined) stored.addresses = JSON.parse(JSON.stringify(body.addresses));
    saveDB(db);
    return toUser(stored);
  },

  async createOrder(token: string | null, body: { items: CartItem[]; address: Address; payment: string }): Promise<Order> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    if (!body.items.length) throw new ApiError("Seu carrinho está vazio.");
    if (!body.address?.street || !body.address?.cep) throw new ApiError("Informe um endereço de entrega completo.");
    const items = [];
    let subtotal = 0;
    for (const it of body.items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (!p) throw new ApiError("Um item do carrinho não está mais disponível.", 409);
      if (p.stock < 1) throw new ApiError(`"${p.name}" está esgotado.`, 409);
      const qty = Math.min(Math.max(1, it.qty), p.stock);
      subtotal += p.price * qty;
      items.push({ productId: p.id, name: p.name, image: p.image, price: p.price, qty });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const shipping = subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.productId)!;
      p.stock -= it.qty;
    }
    const order: Order = {
      id: "TUC-" + Date.now().toString(36).toUpperCase().slice(-6),
      userId: user.id,
      customer: user.name,
      items,
      subtotal,
      shipping,
      total: Math.round((subtotal + shipping) * 100) / 100,
      address: JSON.parse(JSON.stringify(body.address)),
      payment: body.payment,
      createdAt: Date.now(),
    };
    db.orders.unshift(order);
    saveDB(db);
    return JSON.parse(JSON.stringify(order));
  },

  async listOrders(token: string | null): Promise<Order[]> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    const orders = user.role === "admin" ? db.orders : db.orders.filter((o) => o.userId === user.id);
    return JSON.parse(JSON.stringify(orders)) as Order[];
  },

  async getOrder(token: string | null, id: string): Promise<Order> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    const o = db.orders.find((x) => x.id === id);
    if (!o) throw new ApiError("Pedido não encontrado.", 404);
    if (user.role !== "admin" && o.userId !== user.id) throw new ApiError("Pedido não encontrado.", 404);
    return JSON.parse(JSON.stringify(o));
  },

  async cancelOrder(token: string | null, id: string): Promise<Order> {
    await delay();
    const user = authUser(token);
    const db = loadDB();
    const o = db.orders.find((x) => x.id === id);
    if (!o) throw new ApiError("Pedido não encontrado.", 404);
    if (user.role !== "admin" && o.userId !== user.id) throw new ApiError("Sem permissão para cancelar.", 403);
    const status = orderStatus(o);
    if (status === "entregue") throw new ApiError("Pedidos entregues não podem ser cancelados.");
    if (status === "enviado") throw new ApiError("O pacote já foi enviado — recuse a entrega para cancelar.");
    o.cancelled = true;
    // devolve estoque
    for (const it of o.items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock += it.qty;
    }
    saveDB(db);
    return JSON.parse(JSON.stringify(o));
  },

  /* ---------- administração ---------- */
  async adminUpsertProduct(token: string | null, product: Product): Promise<Product> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    if (!product.name?.trim() || product.price <= 0) throw new ApiError("Nome e preço válido são obrigatórios.");
    if (!product.image?.trim()) throw new ApiError("Informe a URL da imagem do produto.");
    const clean: Product = {
      ...product,
      name: product.name.trim(),
      brand: product.brand.trim() || "Tucano",
      rating: Math.min(5, Math.max(0, product.rating || 0)),
      stock: Math.max(0, Math.floor(product.stock || 0)),
      createdAt: product.createdAt || Date.now(),
    };
    const idx = db.products.findIndex((p) => p.id === clean.id);
    if (idx >= 0) db.products[idx] = clean;
    else db.products.unshift(clean);
    saveDB(db);
    return JSON.parse(JSON.stringify(clean));
  },

  async adminDeleteProduct(token: string | null, id: string): Promise<void> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    db.products = db.products.filter((p) => p.id !== id);
    db.reviews = db.reviews.filter((r) => r.productId !== id);
    saveDB(db);
  },

  async adminSetOrderStatus(token: string | null, id: string, status: OrderStatus): Promise<Order> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const o = db.orders.find((x) => x.id === id);
    if (!o) throw new ApiError("Pedido não encontrado.", 404);
    if (status === "cancelado") {
      o.cancelled = true;
      o.statusOverride = undefined;
      for (const it of o.items) {
        const p = db.products.find((x) => x.id === it.productId);
        if (p) p.stock += it.qty;
      }
    } else {
      o.cancelled = false;
      o.statusOverride = status;
    }
    saveDB(db);
    return JSON.parse(JSON.stringify(o));
  },

  async resetDemo(): Promise<void> {
    await delay();
    resetDB();
  },
};
