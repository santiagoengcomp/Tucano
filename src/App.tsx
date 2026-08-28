import { useEffect } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUp, SearchX } from "lucide-react";
import Header, { BottomNav } from "./components/Header";
import { Logo, ToastHost } from "./components/ui";
import { StoreProvider, useStore } from "./context/Store";
import Home from "./pages/Home";
import Search from "./pages/Search";
import ProductPage from "./pages/Product";
import { CartPage, WishlistPage } from "./pages/Cart";
import Checkout from "./pages/Checkout";
import { OrderDetailPage, OrdersPage } from "./pages/Orders";
import { AccountPage, LoginPage } from "./pages/Account";
import Admin from "./pages/Admin";

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, search]);
  return null;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center animate-fadein">
      <p className="font-display text-[64px] font-extrabold leading-none text-ink-900">
        4<span className="text-accent-500">0</span>4
      </p>
      <SearchX size={30} className="mx-auto mt-2 text-ink-300" />
      <h1 className="mt-3 font-display text-xl font-extrabold text-ink-900">Página não encontrada</h1>
      <p className="mt-1 text-[14px] text-ink-500">O link pode estar quebrado ou a página saiu do catálogo.</p>
      <Link to="/" className="btn-accent mt-5">Voltar para a loja</Link>
    </div>
  );
}

function Footer() {
  const { toast } = useStore();
  const soon = () => toast("Seção de demonstração — conteúdo completo em breve.", "info");
  const col = "space-y-2";
  const link = "block text-[13px] font-medium text-ink-300 transition hover:text-accent-400";
  return (
    <footer className="mt-12 bg-ink-950 pb-24 pt-10 text-white md:pb-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mx-auto mb-8 flex items-center gap-2 rounded-full bg-ink-800 px-5 py-2.5 text-[13px] font-bold text-ink-100 transition hover:bg-ink-700"
        >
          <ArrowUp size={15} /> Voltar ao topo
        </button>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-400">
              Seu marketplace completo: catálogo, busca, carrinho, pedidos em tempo real e painel de administração.
            </p>
          </div>
          <div className={col}>
            <h3 className="mb-1 text-[12px] font-extrabold uppercase tracking-wider text-ink-500">Comprar</h3>
            <Link className={link} to="/busca?cat=eletronicos">Eletrônicos</Link>
            <Link className={link} to="/busca?cat=casa">Casa & Cozinha</Link>
            <Link className={link} to="/busca?cat=games">Games</Link>
            <Link className={link} to="/busca?oferta=1">Ofertas do dia</Link>
          </div>
          <div className={col}>
            <h3 className="mb-1 text-[12px] font-extrabold uppercase tracking-wider text-ink-500">Sua conta</h3>
            <Link className={link} to="/conta">Minha conta</Link>
            <Link className={link} to="/pedidos">Meus pedidos</Link>
            <Link className={link} to="/favoritos">Favoritos</Link>
            <Link className={link} to="/carrinho">Carrinho</Link>
          </div>
          <div className={col}>
            <h3 className="mb-1 text-[12px] font-extrabold uppercase tracking-wider text-ink-500">Ajuda</h3>
            <button className={link} onClick={soon}>Trocas e devoluções</button>
            <button className={link} onClick={soon}>Frete e entregas</button>
            <button className={link} onClick={soon}>Formas de pagamento</button>
            <button className={link} onClick={soon}>Fale conosco</button>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-800 pt-6 sm:flex-row">
          <p className="text-[12px] font-medium text-ink-500">© 2026 Tucano · marketplace de demonstração — nenhum pagamento real é processado.</p>
          <p className="text-[12px] font-medium text-ink-500">
            API simulada no navegador · backend Node opcional em <span className="font-mono text-ink-300">/backend</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/busca" element={<Search />} />
          <Route path="/produto/:id" element={<ProductPage />} />
          <Route path="/carrinho" element={<CartPage />} />
          <Route path="/favoritos" element={<WishlistPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
