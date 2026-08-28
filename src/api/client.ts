import { api as mockApi } from "../server/api";
import type { Address, CartItem, Category, Order, OrderStatus, Product, Review, User } from "../types";

/**
 * Cliente de API único.
 * - Sem VITE_API_URL  → usa o backend simulado no navegador (localStorage).
 * - Com VITE_API_URL  → usa o servidor Node gratuito em /backend/server.js
 *   (VITE_API_URL=http://localhost:4000 npm run build).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || "Erro na API") as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const B = (token: string | null) => ({ Authorization: `Bearer ${token ?? ""}` });

export const api = BASE
  ? {
      listCategories: () => http<Category[]>("/api/categories"),
      listProducts: () => http<Product[]>("/api/products"),
      getProduct: (id: string) => http<Product[]>(`/api/products/${id}`).then((r) => r[0]),
      listReviews: (productId: string) => http<Review[]>(`/api/products/${productId}/reviews`),
      addReview: (token: string | null, productId: string, body: { rating: number; title: string; text: string }) =>
        http<Review>(`/api/products/${productId}/reviews`, { method: "POST", headers: B(token), body: JSON.stringify(body) }),
      register: (body: { name: string; email: string; password: string }) =>
        http<{ token: string; user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
      login: (body: { email: string; password: string }) =>
        http<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
      me: (token: string | null) => http<User>("/api/me", { headers: B(token) }),
      updateProfile: (token: string | null, body: { name?: string; addresses?: Address[] }) =>
        http<User>("/api/me", { method: "PUT", headers: B(token), body: JSON.stringify(body) }),
      createOrder: (token: string | null, body: { items: CartItem[]; address: Address; payment: string }) =>
        http<Order>("/api/orders", { method: "POST", headers: B(token), body: JSON.stringify(body) }),
      listOrders: (token: string | null) => http<Order[]>("/api/orders", { headers: B(token) }),
      getOrder: (token: string | null, id: string) => http<Order[]>(`/api/orders/${id}`, { headers: B(token) }).then((r) => r[0]),
      cancelOrder: (token: string | null, id: string) =>
        http<Order>(`/api/orders/${id}/cancel`, { method: "POST", headers: B(token) }),
      adminUpsertProduct: (token: string | null, product: Product) =>
        http<Product>("/api/products", { method: "PUT", headers: B(token), body: JSON.stringify(product) }),
      adminDeleteProduct: (token: string | null, id: string) =>
        http<void>(`/api/products/${id}`, { method: "DELETE", headers: B(token) }),
      adminSetOrderStatus: (token: string | null, id: string, status: OrderStatus) =>
        http<Order>(`/api/orders/${id}/status`, { method: "PATCH", headers: B(token), body: JSON.stringify({ status }) }),
      resetDemo: () => http<void>("/api/reset", { method: "POST" }),
    }
  : mockApi;

export { ORDER_STAGES, orderStatus, stageIndex, nextStageIn, FREE_SHIPPING_MIN, SHIPPING_FEE } from "../server/api";
