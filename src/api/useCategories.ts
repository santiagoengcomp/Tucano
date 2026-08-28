import { useEffect, useState } from "react";
import { api } from "./client";
import type { Category } from "../types";

let cache: Category[] | null = null;
let listeners: ((c: Category[]) => void)[] = [];

export function invalidateCategories() {
  cache = null;
}

function emit(list: Category[]) {
  listeners.forEach((l) => l(list));
}

export function useCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    if (cache) {
      setCats(cache);
      return;
    }
    const listener = (c: Category[]) => alive && setCats(c);
    listeners.push(listener);
    api
      .listCategories()
      .then((c) => {
        cache = c;
        emit(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return cats;
}

export function categoryLabel(cats: Category[], id: string): string {
  return cats.find((c) => c.id === id)?.label ?? id;
}
