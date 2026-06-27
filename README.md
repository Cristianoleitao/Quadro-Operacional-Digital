# Quadro Operacional Digital

Sistema web para controle e gerenciamento da manutenção de ônibus, substituindo planilhas Excel por um quadro operacional digital em tempo real.

## Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, TypeScript
- **Banco:** PostgreSQL + Prisma ORM
- **Tempo real:** WebSocket
- **Autenticação:** JWT + RBAC

## Pré-requisitos

- Node.js 20+
- Docker (para PostgreSQL)

## Instalação

```bash
# 1. Subir o banco de dados
docker compose up -d

# 2. Instalar dependências
npm install

# 3. Configurar backend
cp backend/.env.example backend/.env

# 4. Rodar migrations e seed
npm run db:migrate
npm run db:seed

# 5. Iniciar desenvolvimento
npm run dev
```

### Banco limpo (desenvolvimento)

```bash
# Apaga todos os dados, reaplica migrations e roda seed de desenvolvimento
npm run db:reset

# Apenas garagens (recomendado após deploy / produção)
npm run db:seed:min
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001
- **Quadro TV:** http://localhost:5173/quadro

## Usuários de teste (senha: `admin123`)

| Matrícula | Perfil        | Setor        |
|-----------|---------------|--------------|
| ADM001    | Administrador | —            |
| GER001    | Gerência      | —            |
| MEC001    | Profissional  | Mecânica     |
| ELE001    | Profissional  | Elétrica     |
| LANT001   | Profissional  | Lanternagem  |
| PINT001   | Profissional  | Pintura      |
| REFR001   | Profissional  | Refrigeração |
| BORR001   | Profissional  | Borracharia  |

## Telas

| Rota            | Perfil         | Descrição                              |
|-----------------|----------------|----------------------------------------|
| `/quadro`       | Público        | Quadro operacional para TV 55"         |
| `/login`        | Todos          | Autenticação                           |
| `/admin`        | Administrador  | Central de acompanhamento              |
| `/profissional` | Profissional   | Assumir e executar serviços            |
| `/gerencia`     | Gerência       | Indicadores, histórico e auditoria     |

## Cadastro rápido (Quadro TV)

1. Informe o número do veículo, setor e descrição
2. **ENTER** — adiciona serviço à OS em elaboração
3. **ENTER + ENTER** — finaliza e salva a Ordem de Serviço

## Status visuais

| Cor     | Status                  |
|---------|-------------------------|
| Branco  | Em Execução             |
| Vermelho| Parado Crítico          |
| Amarelo | Aguardando Insumo       |
| Roxo    | Serviço Demorado        |
| Azul    | Manutenção Preventiva   |
| Verde   | Finalizado              |

## Estrutura do projeto

```
├── backend/          # API Node.js + WebSocket
│   ├── prisma/       # Schema e migrations
│   └── src/
│       ├── routes/   # Endpoints REST
│       ├── middleware/
│       └── lib/
├── frontend/         # React SPA
│   └── src/
│       ├── pages/    # Telas do sistema
│       ├── context/  # Autenticação
│       └── lib/      # API client
└── docker-compose.yml
```

## Deploy (Docker)

```bash
# 1. Configurar variáveis de produção
cp .env.production.example .env
# Edite .env: POSTGRES_PASSWORD, JWT_SECRET, APP_PORT

# 2. Subir stack (PostgreSQL + API + frontend/nginx)
npm run deploy:up

# 3. Seed mínimo — garagens para o cadastro de usuários
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-min.ts
```

- **App:** http://localhost:8080 (ou a porta definida em `APP_PORT`)
- **Quadro TV:** http://localhost:8080/quadro
- **Health API:** http://localhost:8080/api/health

Comandos úteis:

```bash
npm run deploy:logs    # acompanhar logs
npm run deploy:down    # parar containers
```

Volumes persistentes: `postgres_data` (banco) e `uploads_data` (fotos/áudios).

Para **zerar o banco em produção** (cuidado — apaga tudo):

```bash
npm run deploy:down
docker volume rm quadro-operacional-digital_postgres_data quadro-operacional-digital_uploads_data
npm run deploy:up
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-min.ts
```
