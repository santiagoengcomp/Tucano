import { loadDB, resetDB, saveDB, type StoredUser } from "./db";
import seed from "../data/catalog.json";
import type { Address, CartItem, Category, Order, OrderStatus, Product, Promo, PromoValidation, Review, Settings, User } from "../types";

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
    const db = loadDB();
    return JSON.parse(JSON.stringify(db.categories)) as Category[];
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

  async createOrder(token: string | null, body: { items: CartItem[]; address: Address; payment: string; couponCode?: string }): Promise<Order> {
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
    const { freeShipMin, shipFee } = db.settings;
    const shipping = subtotal >= freeShipMin ? 0 : shipFee;

    let discount = 0;
    let couponCode: string | undefined;
    if (body.couponCode?.trim()) {
      const promo = db.promos.find((p) => p.code === body.couponCode!.trim().toUpperCase());
      if (promo && promo.active && (!promo.expiresAt || Date.now() <= promo.expiresAt) && subtotal >= promo.minOrder) {
        discount = promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
        discount = Math.round(discount * 100) / 100;
        couponCode = promo.code;
        promo.usedCount += 1;
      }
    }

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
      discount,
      couponCode,
      total: Math.round((subtotal + shipping - discount) * 100) / 100,
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

  /* ---------- categorias (CRUD) ---------- */
  async createCategory(token: string | null, label: string): Promise<Category> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const clean = label.trim();
    if (clean.length < 2) throw new ApiError("Informe um nome de categoria válido.");
    const id = clean
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (db.categories.some((c) => c.id === id)) throw new ApiError("Já existe uma categoria com esse nome.", 409);
    const cat: Category = { id, label: clean };
    db.categories.push(cat);
    saveDB(db);
    return { ...cat };
  },

  async updateCategory(token: string | null, id: string, label: string): Promise<Category> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const cat = db.categories.find((c) => c.id === id);
    if (!cat) throw new ApiError("Categoria não encontrada.", 404);
    if (label.trim().length < 2) throw new ApiError("Informe um nome válido.");
    cat.label = label.trim();
    saveDB(db);
    return { ...cat };
  },

  async deleteCategory(token: string | null, id: string): Promise<void> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const inUse = db.products.filter((p) => p.category === id).length;
    if (inUse > 0) throw new ApiError(`Há ${inUse} produto(s) nessa categoria. Mova-os antes de excluir.`, 409);
    db.categories = db.categories.filter((c) => c.id !== id);
    saveDB(db);
  },

  /* ---------- promoções / cupons ---------- */
  async listPromos(token: string | null): Promise<Promo[]> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    return JSON.parse(JSON.stringify(db.promos)) as Promo[];
  },

  async createPromo(token: string | null, promo: Omit<Promo, "id" | "usedCount" | "createdAt">): Promise<Promo> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const code = promo.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new ApiError("Código deve ter 3–20 letras/números.");
    if (db.promos.some((p) => p.code === code)) throw new ApiError("Já existe um cupom com esse código.", 409);
    if (!(promo.value > 0)) throw new ApiError("Informe um valor de desconto maior que zero.");
    if (promo.type === "percent" && promo.value > 90) throw new ApiError("Desconto percentual máximo é 90%.");
    const full: Promo = { ...promo, code, id: "promo_" + Date.now().toString(36), usedCount: 0, createdAt: Date.now() };
    db.promos.unshift(full);
    saveDB(db);
    return { ...full };
  },

  async updatePromo(token: string | null, id: string, patch: Partial<Promo>): Promise<Promo> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    const promo = db.promos.find((p) => p.id === id);
    if (!promo) throw new ApiError("Cupom não encontrado.", 404);
    Object.assign(promo, patch, { id: promo.id, code: promo.code });
    saveDB(db);
    return { ...promo };
  },

  async deletePromo(token: string | null, id: string): Promise<void> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    db.promos = db.promos.filter((p) => p.id !== id);
    saveDB(db);
  },

  async validatePromo(code: string, subtotal: number): Promise<PromoValidation> {
    await delay();
    const db = loadDB();
    const promo = db.promos.find((p) => p.code === code.trim().toUpperCase());
    if (!promo) throw new ApiError("Cupom inválido ou não encontrado.", 404);
    if (!promo.active) throw new ApiError("Este cupom está desativado.");
    if (promo.expiresAt && Date.now() > promo.expiresAt) throw new ApiError("Este cupom expirou.");
    if (subtotal < promo.minOrder) throw new ApiError(`Válido para pedidos a partir de ${promo.minOrder.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
    const discount = promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
    return { promo: { ...promo }, discount: Math.round(discount * 100) / 100 };
  },

  /* ---------- desconto em massa ---------- */
  async bulkDiscount(token: string | null, opts: { categoryId?: string; percent: number }): Promise<number> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    if (!(opts.percent > 0 && opts.percent <= 90)) throw new ApiError("Percentual deve estar entre 1 e 90.");
    const targets = db.products.filter((p) => !opts.categoryId || p.category === opts.categoryId);
    if (!targets.length) throw new ApiError("Nenhum produto encontrado para aplicar o desconto.");
    for (const p of targets) {
      p.oldPrice = p.price;
      p.price = Math.round(p.price * (1 - opts.percent / 100) * 100) / 100;
    }
    saveDB(db);
    return targets.length;
  },

  /* ---------- configurações da loja ---------- */
  async getSettings(): Promise<Settings> {
    await delay();
    const db = loadDB();
    return { ...db.settings };
  },

  async updateSettings(token: string | null, patch: Partial<Settings>): Promise<Settings> {
    await delay();
    requireAdmin(token);
    const db = loadDB();
    db.settings = { ...db.settings, ...patch };
    saveDB(db);
    return { ...db.settings };
  },

  async resetDemo(): Promise<void> {
    await delay();
    resetDB();
  },
};
