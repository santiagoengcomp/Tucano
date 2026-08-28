# Backend Tucano — gratuito e testável

Servidor REST em Node.js **sem nenhuma dependência** (usa apenas módulos nativos).
Serve a API e o frontend compilado, e persiste os dados em `backend/data.json`.

## Rodar

```bash
npm run build            # 1. compila o frontend em dist/
node backend/server.js   # 2. sobe API + loja em http://localhost:4000
```

## Conectar o frontend a este backend (opcional)

Por padrão o app roda com a API simulada dentro do navegador (localStorage) —
funciona em qualquer hospedagem estática e em WebView sem servidor.
Para usar este servidor:

```bash
VITE_API_URL=http://localhost:4000 npm run build
node backend/server.js
```

No Android (WebView) use `http://10.0.2.2:4000` para alcançar o localhost do host.

## Testar com curl

```bash
# listar produtos
curl http://localhost:4000/api/products

# login (retorna token)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tucano.com","password":"admin123"}'

# criar pedido (cole o token)
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"items":[{"productId":"p1","qty":1}],"payment":"Pix","address":{"id":"a1","label":"Casa","name":"Maria","cep":"05407-002","street":"R. Fradique Coutinho","number":"344","city":"São Paulo","uf":"SP"}}'
```

## Rotas

| Método | Rota                              | Auth   | Descrição                        |
| ------ | --------------------------------- | ------ | -------------------------------- |
| GET    | /api/categories                   | —      | categorias                       |
| GET    | /api/products                     | —      | catálogo                         |
| GET    | /api/products/:id                 | —      | um produto                       |
| PUT    | /api/products                     | admin  | criar/atualizar produto          |
| DELETE | /api/products/:id                 | admin  | remover produto                  |
| GET    | /api/products/:id/reviews         | —      | avaliações                       |
| POST   | /api/products/:id/reviews         | user   | avaliar produto                  |
| POST   | /api/auth/register                | —      | criar conta                      |
| POST   | /api/auth/login                   | —      | entrar (retorna token)           |
| GET    | /api/me                           | user   | dados da sessão                  |
| PUT    | /api/me                           | user   | atualizar perfil/endereços       |
| POST   | /api/orders                       | user   | criar pedido                     |
| GET    | /api/orders                       | user   | meus pedidos (admin: todos)      |
| GET    | /api/orders/:id                   | user   | detalhe do pedido                |
| POST   | /api/orders/:id/cancel            | user   | cancelar (com estorno)           |
| PATCH  | /api/orders/:id/status            | admin  | alterar status                   |
| POST   | /api/reset                        | —      | restaurar dados de demonstração  |

Contas de teste: `cliente@demo.com / demo123` e `admin@tucano.com / admin123`.
