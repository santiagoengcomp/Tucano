/**
 * Tucano API — servidor Node com ZERO dependências (somente módulos nativos).
 *
 * Como rodar:
 *   1) npm run build        (gera a pasta dist/ do frontend)
 *   2) node backend/server.js
 *   3) abra http://localhost:4000
 *
 * Conectar o frontend a este backend:
 *   VITE_API_URL=http://localhost:4000 npm run build
 *
 * Testar com curl:
 *   curl http://localhost:4000/api/products
 *   curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" \
 *        -d '{"email":"admin@tucano.com","password":"admin123"}'
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 4000;

/* ---------------- banco de dados em arquivo ---------------- */
function defaultSettings() {
  return { storeName: "Tucano", freeShipMin: 149, shipFee: 19.9, announcement: "Frete grátis acima de R$ 149 · Até 10x sem juros" };
}

function seed() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "catalog.json"), "utf-8"));
  return {
    users: [
      { id: "u_admin", name: "Equipe Tucano", email: "admin@tucano.com", password: "admin123", role: "admin", addresses: [{ id: "a1", label: "Escritório", name: "Equipe Tucano", cep: "01310-100", street: "Av. Paulista", number: "1106", city: "São Paulo", uf: "SP" }] },
      { id: "u_demo", name: "Maria Souza", email: "cliente@demo.com", password: "demo123", role: "customer", addresses: [{ id: "a2", label: "Casa", name: "Maria Souza", cep: "05407-002", street: "R. Fradique Coutinho", number: "344", city: "São Paulo", uf: "SP" }] },
    ],
    products: catalog.products,
    reviews: catalog.reviews,
    orders: [],
    categories: catalog.categories,
    promos: [
      { id: "promo_bemvindo", code: "BEMVINDO10", type: "percent", value: 10, active: true, minOrder: 0, expiresAt: null, usedCount: 0, createdAt: Date.now() },
      { id: "promo_frete", code: "FRETE20", type: "fixed", value: 20, active: true, minOrder: 100, expiresAt: null, usedCount: 0, createdAt: Date.now() },
    ],
    settings: defaultSettings(),
  };
}

/* garante campos novos em bancos antigos */
function normalize(db) {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "catalog.json"), "utf-8"));
  if (!Array.isArray(db.categories)) db.categories = catalog.categories;
  if (!Array.isArray(db.promos)) db.promos = [];
  if (!db.settings) db.settings = defaultSettings();
  return db;
}

function load() {
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
  } catch {
    const db = seed();
    save(db);
    return db;
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* ---------------- helpers ---------------- */
const FREE_MIN = 149;
const SHIP_FEE = 19.9;
const json = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
};
const err = (res, status, msg) => json(res, status, { error: msg });
const body = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const makeToken = (uid) => Buffer.from(JSON.stringify({ uid, exp: Date.now() + 7 * 864e5 })).toString("base64");
function auth(req, db, admin = false) {
  const h = req.headers.authorization || "";
  try {
    const { uid, exp } = JSON.parse(Buffer.from(h.replace(/^Bearer\s+/i, ""), "base64").toString());
    if (exp < Date.now()) throw 0;
    const user = db.users.find((u) => u.id === uid);
    if (!user || (admin && user.role !== "admin")) throw 0;
    return user;
  } catch {
    return null;
  }
}
const pub = ({ password, ...u }) => u;
const ORDER_STAGES = [
  { status: "confirmado", after: 0 },
  { status: "preparando", after: 60_000 },
  { status: "enviado", after: 180_000 },
  { status: "entregue", after: 360_000 },
];
const orderStatus = (o) => {
  if (o.cancelled) return "cancelado";
  if (o.statusOverride) return o.statusOverride;
  let cur = "confirmado";
  for (const s of ORDER_STAGES) if (Date.now() - o.createdAt >= s.after) cur = s.status;
  return cur;
};

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };

/* ---------------- servidor ---------------- */
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  if (p.startsWith("/api/")) {
    const db = load();
    const m = req.method;
    const b = ["POST", "PUT", "PATCH"].includes(m) ? await body(req) : null;

    try {
      /* categorias (CRUD) */
      if (p === "/api/categories" && m === "GET") return json(res, 200, db.categories);
      if (p === "/api/categories" && m === "POST") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const label = (b?.label || "").trim();
        if (label.length < 2) return err(res, 400, "Informe um nome de categoria válido.");
        const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (db.categories.some((c) => c.id === id)) return err(res, 409, "Já existe uma categoria com esse nome.");
        const cat = { id, label };
        db.categories.push(cat);
        save(db);
        return json(res, 200, [cat]);
      }
      match = p.match(/^\/api\/categories\/([^/]+)$/);
      if (match && m === "PUT") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const cat = db.categories.find((c) => c.id === match[1]);
        if (!cat) return err(res, 404, "Categoria não encontrada.");
        if ((b?.label || "").trim().length < 2) return err(res, 400, "Informe um nome válido.");
        cat.label = b.label.trim();
        save(db);
        return json(res, 200, [cat]);
      }
      if (match && m === "DELETE") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const inUse = db.products.filter((x) => x.category === match[1]).length;
        if (inUse > 0) return err(res, 409, `Há ${inUse} produto(s) nessa categoria. Mova-os antes de excluir.`);
        db.categories = db.categories.filter((c) => c.id !== match[1]);
        save(db);
        return json(res, 200, { ok: true });
      }

      /* configurações da loja */
      if (p === "/api/settings" && m === "GET") return json(res, 200, db.settings);
      if (p === "/api/settings" && m === "PUT") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        db.settings = { ...db.settings, ...(b || {}) };
        save(db);
        return json(res, 200, db.settings);
      }

      /* promoções / cupons */
      if (p === "/api/promos" && m === "GET") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        return json(res, 200, db.promos);
      }
      if (p === "/api/promos" && m === "POST") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const code = (b?.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{3,20}$/.test(code)) return err(res, 400, "Código deve ter 3–20 letras/números.");
        if (db.promos.some((x) => x.code === code)) return err(res, 409, "Já existe um cupom com esse código.");
        if (!(b?.value > 0)) return err(res, 400, "Informe um valor de desconto maior que zero.");
        if (b?.type === "percent" && b.value > 90) return err(res, 400, "Desconto percentual máximo é 90%.");
        const promo = { code, type: b.type === "fixed" ? "fixed" : "percent", value: b.value, active: b.active !== false, minOrder: b.minOrder || 0, expiresAt: b.expiresAt || null, id: "promo_" + Date.now().toString(36), usedCount: 0, createdAt: Date.now() };
        db.promos.unshift(promo);
        save(db);
        return json(res, 200, [promo]);
      }
      if (p === "/api/promos/validate" && m === "POST") {
        const promo = db.promos.find((x) => x.code === (b?.code || "").trim().toUpperCase());
        if (!promo) return err(res, 404, "Cupom inválido ou não encontrado.");
        if (!promo.active) return err(res, 400, "Este cupom está desativado.");
        if (promo.expiresAt && Date.now() > promo.expiresAt) return err(res, 400, "Este cupom expirou.");
        const subtotal = Number(b?.subtotal) || 0;
        if (subtotal < promo.minOrder) return err(res, 400, `Válido para pedidos a partir de R$ ${promo.minOrder}.`);
        const discount = promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
        return json(res, 200, [{ promo, discount: Math.round(discount * 100) / 100 }]);
      }
      match = p.match(/^\/api\/promos\/([^/]+)$/);
      if (match && m === "PUT") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const promo = db.promos.find((x) => x.id === match[1]);
        if (!promo) return err(res, 404, "Cupom não encontrado.");
        Object.assign(promo, b || {}, { id: promo.id, code: promo.code });
        save(db);
        return json(res, 200, [promo]);
      }
      if (match && m === "DELETE") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        db.promos = db.promos.filter((x) => x.id !== match[1]);
        save(db);
        return json(res, 200, { ok: true });
      }

      /* desconto em massa */
      if (p === "/api/products/bulk-discount" && m === "POST") {
        if (!auth(req, db, true)) return err(res, 401, "Acesso restrito à administração.");
        const percent = Number(b?.percent);
        if (!(percent > 0 && percent <= 90)) return err(res, 400, "Percentual deve estar entre 1 e 90.");
        const targets = db.products.filter((x) => !b?.categoryId || x.category === b.categoryId);
        if (!targets.length) return err(res, 400, "Nenhum produto encontrado para aplicar o desconto.");
        targets.forEach((x) => {
          x.oldPrice = x.price;
          x.price = Math.round(x.price * (1 - percent / 100) * 100) / 100;
        });
        save(db);
        return json(res, 200, { count: targets.length });
      }

      /* produtos */
      if (m === "GET" && p === "/api/products") return json(res, 200, db.products);
      if (m === "PUT" || (m === "POST" && p === "/api/products")) {
        const user = auth(req, db, true);
        if (!user) return err(res, 401, "Acesso restrito à administração.");
        if (!b?.name?.trim() || !(b.price > 0)) return err(res, 400, "Nome e preço válido são obrigatórios.");
        const clean = { ...b, name: b.name.trim(), brand: b.brand?.trim() || "Tucano", stock: Math.max(0, Math.floor(b.stock || 0)), createdAt: b.createdAt || Date.now() };
        const idx = db.products.findIndex((x) => x.id === clean.id);
        if (idx >= 0) db.products[idx] = clean;
        else db.products.unshift(clean);
        save(db);
        return json(res, 200, clean);
      }
      let match = p.match(/^\/api\/products\/([^/]+)$/);
      if (match && m === "GET") {
        const prod = db.products.find((x) => x.id === match[1]);
        return prod ? json(res, 200, [prod]) : err(res, 404, "Produto não encontrado.");
      }
      if (match && m === "DELETE") {
        const user = auth(req, db, true);
        if (!user) return err(res, 401, "Acesso restrito à administração.");
        db.products = db.products.filter((x) => x.id !== match[1]);
        db.reviews = db.reviews.filter((r) => r.productId !== match[1]);
        save(db);
        return json(res, 200, { ok: true });
      }
      match = p.match(/^\/api\/products\/([^/]+)\/reviews$/);
      if (match && m === "GET") return json(res, 200, db.reviews.filter((r) => r.productId === match[1]).sort((a, b) => b.date - a.date));
      if (match && m === "POST") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Entre na sua conta para continuar.");
        const prod = db.products.find((x) => x.id === match[1]);
        if (!prod) return err(res, 404, "Produto não encontrado.");
        if (!(b?.rating >= 1 && b.rating <= 5) || !b.title?.trim() || b.text?.trim().length < 10) return err(res, 400, "Avaliação inválida.");
        const review = { id: "r" + Date.now().toString(36), productId: match[1], user: user.name, rating: b.rating, title: b.title.trim(), text: b.text.trim(), date: Date.now() };
        db.reviews.unshift(review);
        prod.rating = Math.round(((prod.rating * prod.ratingCount + b.rating) / (prod.ratingCount + 1)) * 10) / 10;
        prod.ratingCount += 1;
        save(db);
        return json(res, 200, review);
      }

      /* auth */
      if (m === "POST" && p === "/api/auth/register") {
        const email = (b?.email || "").trim().toLowerCase();
        if ((b?.name || "").trim().length < 2) return err(res, 400, "Informe seu nome completo.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err(res, 400, "E-mail inválido.");
        if ((b?.password || "").length < 6) return err(res, 400, "A senha precisa de pelo menos 6 caracteres.");
        if (db.users.some((u) => u.email === email)) return err(res, 409, "Já existe uma conta com este e-mail.");
        const user = { id: "u" + Date.now().toString(36), name: b.name.trim(), email, password: b.password, role: "customer", addresses: [] };
        db.users.push(user);
        save(db);
        return json(res, 200, { token: makeToken(user.id), user: pub(user) });
      }
      if (m === "POST" && p === "/api/auth/login") {
        const user = db.users.find((u) => u.email === (b?.email || "").trim().toLowerCase());
        if (!user || user.password !== b?.password) return err(res, 401, "E-mail ou senha incorretos.");
        return json(res, 200, { token: makeToken(user.id), user: pub(user) });
      }
      if (p === "/api/me" && m === "GET") {
        const user = auth(req, db);
        return user ? json(res, 200, pub(user)) : err(res, 401, "Sessão expirada. Entre novamente.");
      }
      if (p === "/api/me" && m === "PUT") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Sessão expirada.");
        if (b?.name) user.name = b.name.trim();
        if (Array.isArray(b?.addresses)) user.addresses = b.addresses;
        save(db);
        return json(res, 200, pub(user));
      }

      /* pedidos */
      if (p === "/api/orders" && m === "POST") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Entre na sua conta para continuar.");
        if (!b?.items?.length) return err(res, 400, "Seu carrinho está vazio.");
        if (!b?.address?.street || !b?.address?.cep) return err(res, 400, "Informe um endereço completo.");
        const items = [];
        let subtotal = 0;
        for (const it of b.items) {
          const prod = db.products.find((x) => x.id === it.productId);
          if (!prod) return err(res, 409, "Um item do carrinho não está mais disponível.");
          if (prod.stock < 1) return err(res, 409, `"${prod.name}" está esgotado.`);
          const qty = Math.min(Math.max(1, it.qty), prod.stock);
          subtotal += prod.price * qty;
          items.push({ productId: prod.id, name: prod.name, image: prod.image, price: prod.price, qty });
        }
        subtotal = Math.round(subtotal * 100) / 100;
        const { freeShipMin, shipFee } = db.settings;
        const shipping = subtotal >= freeShipMin ? 0 : shipFee;

        let discount = 0;
        let couponCode;
        if (b?.couponCode?.trim()) {
          const promo = db.promos.find((x) => x.code === b.couponCode.trim().toUpperCase());
          if (promo && promo.active && (!promo.expiresAt || Date.now() <= promo.expiresAt) && subtotal >= promo.minOrder) {
            discount = promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
            discount = Math.round(discount * 100) / 100;
            couponCode = promo.code;
            promo.usedCount += 1;
          }
        }

        items.forEach((it) => {
          db.products.find((x) => x.id === it.productId).stock -= it.qty;
        });
        const order = { id: "TUC-" + Date.now().toString(36).toUpperCase().slice(-6), userId: user.id, customer: user.name, items, subtotal, shipping, discount, couponCode, total: Math.round((subtotal + shipping - discount) * 100) / 100, address: b.address, payment: b.payment || "—", createdAt: Date.now() };
        db.orders.unshift(order);
        save(db);
        return json(res, 200, order);
      }
      if (p === "/api/orders" && m === "GET") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Entre na sua conta.");
        return json(res, 200, user.role === "admin" ? db.orders : db.orders.filter((o) => o.userId === user.id));
      }
      match = p.match(/^\/api\/orders\/([^/]+)$/);
      if (match && m === "GET") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Entre na sua conta.");
        const o = db.orders.find((x) => x.id === match[1]);
        if (!o || (user.role !== "admin" && o.userId !== user.id)) return err(res, 404, "Pedido não encontrado.");
        return json(res, 200, [o]);
      }
      match = p.match(/^\/api\/orders\/([^/]+)\/cancel$/);
      if (match && m === "POST") {
        const user = auth(req, db);
        if (!user) return err(res, 401, "Entre na sua conta.");
        const o = db.orders.find((x) => x.id === match[1]);
        if (!o) return err(res, 404, "Pedido não encontrado.");
        const st = orderStatus(o);
        if (["enviado", "entregue"].includes(st)) return err(res, 400, "Este pedido não pode mais ser cancelado.");
        o.cancelled = true;
        o.items.forEach((it) => {
          const prod = db.products.find((x) => x.id === it.productId);
          if (prod) prod.stock += it.qty;
        });
        save(db);
        return json(res, 200, o);
      }
      match = p.match(/^\/api\/orders\/([^/]+)\/status$/);
      if (match && m === "PATCH") {
        const user = auth(req, db, true);
        if (!user) return err(res, 401, "Acesso restrito à administração.");
        const o = db.orders.find((x) => x.id === match[1]);
        if (!o) return err(res, 404, "Pedido não encontrado.");
        if (b?.status === "cancelado") {
          o.cancelled = true;
          o.statusOverride = undefined;
          o.items.forEach((it) => {
            const prod = db.products.find((x) => x.id === it.productId);
            if (prod) prod.stock += it.qty;
          });
        } else {
          o.cancelled = false;
          o.statusOverride = b?.status;
        }
        save(db);
        return json(res, 200, o);
      }

      if (p === "/api/reset" && m === "POST") {
        save(seed());
        return json(res, 200, { ok: true });
      }

      return err(res, 404, "Rota não encontrada.");
    } catch (e) {
      return err(res, 500, "Erro interno: " + (e?.message || e));
    }
  }

  /* ---------------- estáticos (dist/) ---------------- */
  let file = path.join(DIST, p === "/" ? "index.html" : p);
  if (!file.startsWith(DIST)) return err(res, 403, "Proibido.");
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  if (!fs.existsSync(file)) return err(res, 404, "Frontend não compilado — rode: npm run build");
  const ext = path.extname(file);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  Tucano API + loja rodando em  →  http://localhost:${PORT}\n  Teste: curl http://localhost:${PORT}/api/products\n`);
});
