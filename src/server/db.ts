import seed from "../data/catalog.json";
import type { Order, Product, Review } from "../types";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "customer";
  addresses: { id: string; label: string; name: string; cep: string; street: string; number: string; city: string; uf: string }[];
};

export type DB = {
  v: number;
  users: StoredUser[];
  products: Product[];
  reviews: Review[];
  orders: Order[];
};

const KEY = "tucano_db_v2";

function buildSeed(): DB {
  const users: StoredUser[] = [
    {
      id: "u_admin",
      name: "Equipe Tucano",
      email: "admin@tucano.com",
      password: "admin123",
      role: "admin",
      addresses: [
        { id: "a1", label: "Escritório", name: "Equipe Tucano", cep: "01310-100", street: "Av. Paulista", number: "1106", city: "São Paulo", uf: "SP" },
      ],
    },
    {
      id: "u_demo",
      name: "Maria Souza",
      email: "cliente@demo.com",
      password: "demo123",
      role: "customer",
      addresses: [
        { id: "a2", label: "Casa", name: "Maria Souza", cep: "05407-002", street: "R. Fradique Coutinho", number: "344", city: "São Paulo", uf: "SP" },
      ],
    },
  ];
  return {
    v: 2,
    users,
    products: JSON.parse(JSON.stringify(seed.products)) as Product[],
    reviews: JSON.parse(JSON.stringify(seed.reviews)) as Review[],
    orders: [],
  };
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.users)) return parsed;
    }
  } catch {
    /* dados corrompidos → recria */
  }
  const fresh = buildSeed();
  saveDB(fresh);
  return fresh;
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function resetDB() {
  localStorage.removeItem(KEY);
  loadDB();
}
