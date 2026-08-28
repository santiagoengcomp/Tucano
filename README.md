# Tucano — Marketplace completo (estilo Amazon)

E-commerce completo com catálogo, busca e filtros, avaliações, carrinho, favoritos,
checkout (Pix/cartão), pedidos com rastreamento em tempo real, login/cadastro,
perfil com endereços e painel administrativo. Pronto para **WebView** (Android/iOS)
e para qualquer hospedagem estática.

## Onde estão os arquivos

| Pasta / arquivo   | Conteúdo                                                    |
| ----------------- | ----------------------------------------------------------- |
| `src/`            | Frontend React + Vite + Tailwind (loja + admin)             |
| `src/server/`     | API simulada no navegador (localStorage) — modo padrão      |
| `backend/`        | Servidor REST Node.js **sem dependências** (opcional)       |
| `public/images/`  | Fotos dos produtos                                          |
| `dist/`           | Build de produção (gerado com `npm run build`)              |

## Como baixar este projeto

1. Use a opção de **export/download** do workspace (geralmente um botão de
   download/ZIP na interface onde este projeto está aberto).
2. Extraia o ZIP em uma pasta qualquer do seu computador.

## Rodar localmente (grátis, sem chaves nem cadastro)

Requisitos: apenas [Node.js 18+](https://nodejs.org).

```bash
npm install        # instala as dependências
npm run dev        # loja em http://localhost:5173 (modo desenvolvimento)
```

Build de produção:

```bash
npm run build      # gera a pasta dist/ (é ela que você sobe na hospedagem)
```

Para testar o build final no seu PC:

```bash
npx serve dist     # ou: python -m http.server 8080 -d dist
```

## Usar o backend real (opcional, 100% gratuito)

O app já funciona sozinho com a API simulada no navegador (localStorage).
Se quiser rodar a API como servidor:

```bash
npm run build
node backend/server.js     # API + loja em http://localhost:4000
```

Para o frontend chamar esse servidor em vez da API simulada:

```bash
VITE_API_URL=http://localhost:4000 npm run build
node backend/server.js
```

Veja rotas e exemplos de teste com `curl` em [backend/README.md](backend/README.md).

## Contas de teste

| Perfil     | E-mail              | Senha     |
| ---------- | ------------------- | --------- |
| Cliente    | cliente@demo.com    | demo123   |
| Admin      | admin@tucano.com    | admin123  |

## Publicar de graça

- **Vercel / Netlify / Cloudflare Pages / GitHub Pages**: suba o repositório e
  aponte o build para `npm run build` com pasta de saída `dist/`.
- **WebView Android**: carregue `dist/index.html` (ou a URL publicada). O app
  usa hash-router, safe-areas e manifest, então funciona servido de qualquer
  caminho ou de `file:///`. Para chamar o backend local do emulador, use
  `http://10.0.2.2:4000`.

## Destaques

- Busca com sugestões, filtros (preço, avaliação, estoque, ofertas) e ordenação
- Carrinho com frete grátis progressivo e "salvar para depois"
- Checkout com CEP automático (ViaCEP), Pix com 5% OFF e cartão validado
- Pedidos que avançam de status em tempo real (demo acelerada) com cancelamento
- Avaliações com histograma e médias recalculadas
- Admin com receita, CRUD de produtos, gestão de pedidos e reset da demo
- 10 fotos de produto geradas, identidade própria e micro-interações
