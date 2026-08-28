export type Category = { id: string; label: string };

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  oldPrice?: number;
  rating: number;
  ratingCount: number;
  stock: number;
  image: string;
  short: string;
  description: string;
  features: string[];
  tags: string[];
  turbo?: boolean;
  createdAt: number;
};

export type Review = {
  id: string;
  productId: string;
  user: string;
  rating: number;
  title: string;
  text: string;
  date: number;
};

export type Address = {
  id: string;
  label: string;
  name: string;
  cep: string;
  street: string;
  number: string;
  city: string;
  uf: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "customer";
  addresses: Address[];
};

export type CartItem = { productId: string; qty: number };

export type OrderItem = {
  productId: string;
  name: string;
  image: string;
  price: number;
  qty: number;
};

export type OrderStatus =
  | "confirmado"
  | "preparando"
  | "enviado"
  | "entregue"
  | "cancelado";

export type Order = {
  id: string;
  userId: string;
  customer: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount?: number;
  couponCode?: string;
  total: number;
  address: Address;
  payment: string;
  createdAt: number;
  cancelled?: boolean;
  statusOverride?: OrderStatus;
};

export type ToastKind = "ok" | "err" | "info";
export type Toast = { id: number; kind: ToastKind; msg: string };

/* ---------- promoções / cupons ---------- */
export type PromoType = "percent" | "fixed";
export type Promo = {
  id: string;
  code: string;
  type: PromoType;
  value: number; // % (percent) ou R$ (fixed)
  active: boolean;
  minOrder: number; // pedido mínimo para valer (0 = sem mínimo)
  expiresAt: number | null; // timestamp ou null = sem validade
  usedCount: number;
  createdAt: number;
};

export type PromoValidation = {
  promo: Promo;
  discount: number;
};

/* ---------- configurações da loja ---------- */
export type Settings = {
  storeName: string;
  freeShipMin: number; // frete grátis a partir de
  shipFee: number; // valor do frete
  announcement: string; // aviso exibido no topo
};

/* ---------- vendas (dashboard) ---------- */
export type SalesPoint = { day: string; revenue: number; orders: number };
export type CategorySlice = { name: string; value: number };
