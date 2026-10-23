# Encurta: links curtos com analytics em tempo real

Encurtador de URLs com painel de métricas: quantas pessoas clicaram, de onde vieram, em qual dispositivo e navegador. Os cliques **aparecem na tela na hora em que acontecem**.

![CI](https://github.com/Artas1337/encurta/actions/workflows/ci.yml/badge.svg)

> Projeto de portfólio. Backend com regras reais de produção (rate limiting, privacidade, cache HTTP, detecção de robôs), streaming com Server-Sent Events e 25 testes automatizados.

## Funcionalidades

- **Encurtar** qualquer link http/https, com código aleatório ou **apelido personalizado** (`/meu-tcc`)
- **Data de validade:** depois dela o link responde *410 Gone* com uma página amigável
- **QR code** em SVG para cada link, pronto para baixar e imprimir
- **Painel de métricas** de 7, 30 ou 90 dias:
  - cliques × visitantes únicos por dia (gráfico com linha-guia e tooltip)
  - origem (LinkedIn, Google, acesso direto…), navegador, sistema e dispositivo
- **Tempo real:** cada clique chega via **Server-Sent Events** e atualiza números, listas e o feed sem recarregar
- Busca, copiar com um clique, cadastro e login com JWT

## Decisões técnicas

| Problema | Solução |
|---|---|
| Contar visitantes únicos **sem guardar IP** | Hash SHA-256 de `sal + dia + IP + user-agent`. Dá para contar únicos, mas não dá para recuperar o IP nem seguir alguém entre dias. |
| Robôs e prévias de link (WhatsApp, Slack, Googlebot) inflam os números | Parser de user-agent identifica bots, que são redirecionados mas **não contados**. |
| Navegador guardando o redirecionamento em cache | **302** + `Cache-Control: no-store`, em vez de 301, para que todo clique chegue ao servidor. |
| Abuso na criação de links | **Rate limit** por janela deslizante (20/min por usuário), com `Retry-After` e `X-RateLimit-Remaining`. |
| Colisão de códigos aleatórios | Alfabeto sem caracteres ambíguos (0/O, 1/l/I); 57⁶ ≈ 34 bilhões de combinações; retry em caso de colisão e índice `UNIQUE COLLATE NOCASE`. |
| Atualizar o painel em tempo real | `EventEmitter` interno: o redirecionamento publica e o endpoint SSE assina por link. SSE em vez de WebSocket porque o fluxo é só servidor → cliente e reconecta sozinho. |
| `EventSource` não aceita cabeçalho de autenticação | O middleware de auth também lê o token da query string, só para as rotas abertas pelo próprio navegador (SSE e QR). |
| Gráfico com buracos em dias sem clique | A API completa a série com zeros: o front recebe todos os dias do período. |
| Segurança das URLs | Só `http:`/`https:` (bloqueia `javascript:` e afins); apelidos reservados (`api`, `login`…). |

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, EventSource, gráficos SVG feitos à mão |
| Backend | Node.js, Express 5, TypeScript, Zod, JWT, bcrypt, `qrcode` |
| Banco | SQLite nativo do Node (`node:sqlite`) em modo WAL |
| Testes | Vitest + Supertest (25 testes, incluindo streaming SSE de ponta a ponta) |

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/:code` | Redireciona e registra o clique |
| GET · POST | `/api/links` | Lista (com busca `?q=`) / cria |
| PATCH · DELETE | `/api/links/:id` | Edita destino, título, validade / exclui |
| GET | `/api/links/:id/stats?days=7\|30\|90` | Série diária, únicos, origens, navegadores, SO, dispositivos |
| GET | `/api/links/:id/live` | Stream SSE de cliques em tempo real |
| GET | `/api/links/:id/qr.svg` | QR code |
| GET | `/api/overview` | Totais do usuário |

## Como rodar

Requer **Node.js 22.13+**.

```bash
npm install
npm run seed   # opcional: demo@encurta.test / demo123 com 30 dias de cliques
npm run dev
```

- Painel: http://localhost:5176
- API e links curtos: http://localhost:3335

Para ver o tempo real: abra as métricas de um link e, em outra aba, acesse o link curto. O clique aparece na hora.

```bash
npm test        # 25 testes
npm run build
```

Variáveis de ambiente: `API_PORT`, `PUBLIC_URL` (domínio dos links curtos), `DB_FILE`, `JWT_SECRET` e `VISITOR_SALT` (**defina em produção**).

## Próximos passos

- Cache em memória dos códigos mais acessados
- Domínio personalizado por usuário
- Rate limit distribuído com Redis para rodar com várias instâncias

---

Feito por **Arthur Martins** · [LinkedIn](https://linkedin.com/in/arthur-martins-2547553b6) · [GitHub](https://github.com/Artas1337)
