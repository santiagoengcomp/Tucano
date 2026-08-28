# Backend Tucano — gratuito, sem dependências

Servidor REST em Node.js usando **apenas módulos nativos** (http, fs, path).
Serve a API **e** o frontend compilado, persistindo tudo em `backend/data.json`.

## Rodar em 2 passos

```bash
npm run build            # 1. compila o frontend em dist/
node backend/server.js   # 2. sobe API + loja em http://localhost:4000
```

## Conectar o frontend a este backend

Por padrão o app usa a API simulada dentro do navegador (localStorage) —
funciona em hospedagem estática e em WebView **sem servidor nenhum**.
Para usar este backend real:

```bash
VITE_API_URL=http://localhost:4000 npm run build
node backend/server.js
```

### No WebView (Android / iOS)

| Onde o app roda            | URL para apontar                          |
| -------------------------- | ----------------------------------------- |
| Emulador Android           | `http://10.0.2.2:4000`                    |
| Celular Android na rede    | `http://<IP-do-PC>:4000` (ex.: 192.168.0.10) |
| Simulador iOS              | `http://localhost:4000`                   |

- Descubra o IP do PC: `ipconfig` (Windows) ou `ifconfig | grep inet` (Mac/Linux)
- Android 9+ bloqueia HTTP puro: adicione `android:usesCleartextTraffic="true"` no
  `AndroidManifest.xml` ou use HTTPS em produção
- No app, chame `loadUrl("http://10.0.2.2:4000")` na WebView

### Hospedar o backend de graça

- **Render.com** → "Web Service" → build `npm run build`, start `node backend/server.js`
- **Railway.app** / **Fly.io** / **Koyeb** → detectam o Node automaticamente
- Defina a env `PORT` se a plataforma exigir (o servidor já a lê)

## APIs externas usadas (e as que você PRECISA)

| API      | Para quê                        | Custo | Chave? | Status   |
| -------- | ------------------------------- | ----- | ------ | -------- |
| **ViaCEP** | Autocompletar endereço pelo CEP | Grátis | Não    | Já integrada (opcional — o checkout funciona sem) |

**É só isso.** Autenticação, catálogo, pedidos, cupons e estoque são 100% internos —
o sistema inteiro roda sem nenhuma API externa obrigatória.

### Opcionais para ir a produção (não incluídas)

| Necessidade            | Sugestão gratuita              |
| ---------------------- | ------------------------------ |
| Pagamento real (Pix/cartão) | Mercado Pago (sandbox grátis) ou Stripe |
| E-mail transacional    | Resend (3 mil/mês grátis)      |
| Armazenar fotos        | Cloudinary (25 GB grátis) ou Supabase Storage |
| Banco de dados em nuvem| Supabase (Postgres grátis)     |

## Testar com curl

```bash
# listar produtos
curl http://localhost:4000/api/products

# login (retorna token)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tucano.com","password":"admin123"}'

# aplicar cupom (validação)
curl -X POST http://localhost:4000/api/promos/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"BEMVINDO10","subtotal":250}'

# criar pedido com cupom
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"items":[{"productId":"p1","qty":1}],"payment":"Pix","couponCode":"BEMVINDO10","address":{"id":"a1","label":"Casa","name":"Maria","cep":"05407-002","street":"R. Fradique Coutinho","number":"344","city":"São Paulo","uf":"SP"}}'
```

## Rotas da API

| Método | Rota                              | Auth   | Descrição                              |
| ------ | --------------------------------- | ------ | -------------------------------------- |
| GET    | /api/categories                   | —      | lista de categorias                    |
| POST   | /api/categories                   | admin  | criar categoria                        |
| PUT    | /api/categories/:id               | admin  | renomear categoria                     |
| DELETE | /api/categories/:id               | admin  | excluir categoria (protege produtos)   |
| GET    | /api/products                     | —      | catálogo completo                      |
| GET    | /api/products/:id                 | —      | um produto                             |
| PUT    | /api/products                     | admin  | criar/atualizar produto                |
| DELETE | /api/products/:id                 | admin  | remover produto                        |
| POST   | /api/products/bulk-discount       | admin  | desconto em massa por categoria (%)    |
| GET    | /api/products/:id/reviews         | —      | avaliações do produto                  |
| POST   | /api/products/:id/reviews         | user   | enviar avaliação                       |
| POST   | /api/auth/register                | —      | criar conta                            |
| POST   | /api/auth/login                   | —      | entrar (retorna token)                 |
| GET    | /api/me                           | user   | dados da sessão                        |
| PUT    | /api/me                           | user   | atualizar perfil/endereços             |
| GET    | /api/promos                       | admin  | listar cupons                          |
| POST   | /api/promos                       | admin  | criar cupom (% ou valor fixo)          |
| PUT    | /api/promos/:id                   | admin  | editar/ativar/desativar cupom          |
| DELETE | /api/promos/:id                   | admin  | excluir cupom                          |
| POST   | /api/promos/validate              | —      | validar cupom no checkout              |
| GET    | /api/settings                     | —      | configurações da loja (frete, nome)    |
| PUT    | /api/settings                     | admin  | atualizar configurações                |
| POST   | /api/orders                       | user   | criar pedido (aceita couponCode)       |
| GET    | /api/orders                       | user   | meus pedidos (admin: todos)            |
| GET    | /api/orders/:id                   | user   | detalhe do pedido                      |
| POST   | /api/orders/:id/cancel            | user   | cancelar (com estorno de estoque)      |
| PATCH  | /api/orders/:id/status            | admin  | alterar status do pedido               |
| POST   | /api/reset                        | —      | restaurar dados de demonstração        |

Contas de teste: `cliente@demo.com / demo123` e `admin@tucano.com / admin123`.
Cupons de teste: `BEMVINDO10` (10% off) e `FRETE20` (R$ 20 em compras ≥ R$ 100).
