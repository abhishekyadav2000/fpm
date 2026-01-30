# FPM - Financial Posture Management

A complete personal finance management platform with AI-powered insights.

## 🚀 Features

- **Dashboard**: Real-time financial overview with net worth, income, expenses
- **Ledger**: Full transaction management with categories and splits
- **Budgets**: Envelope-style budgeting system
- **Portfolio**: Investment tracking with holdings and trades
- **Accounts**: Multi-account management (checking, savings, credit, loans)
- **Categories**: Customizable transaction categorization
- **Import**: CSV import with preview and validation
- **AI Advisor**: Chat with an AI financial advisor powered by local LLM
- **Insights**: AI-generated financial insights and recommendations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                    Next.js 14 (Vercel)                          │
│                    Port 3000                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    API          │ │   Analytics     │ │    Agents       │
│  Fastify/TS     │ │  FastAPI/Py     │ │  FastAPI/Py     │
│  Port 4000      │ │  Port 5001      │ │  Port 6000      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     Redis       │ │    Ollama       │
│   Port 5432     │ │   Port 6379     │ │   Port 11434    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| API | Fastify, TypeScript, Prisma ORM |
| Analytics | Python FastAPI |
| AI Agents | Python FastAPI, Ollama |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| LLM | Ollama (llama3.2:1b) |
| Infrastructure | Docker Compose |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- pnpm

### Development (Docker)

```bash
# Clone and setup
git clone https://github.com/yourorg/fpm.git
cd fpm

# Start all services
make up

# Or manually:
docker compose -f infra/docker-compose.yml up -d

# Pull Ollama model (first time only)
docker exec infra-ollama-1 ollama pull llama3.2:1b

# Seed database with demo data
docker exec infra-api-1 npx prisma db seed
```

Access the app at http://localhost:3000

**Demo credentials**: `admin@fpm.local` / `admin123`

### Local Development

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Start database
docker compose -f infra/docker-compose.yml up -d postgres redis ollama

# Run migrations
cd apps/api && npx prisma migrate dev

# Start services (in separate terminals)
pnpm --filter @fpm/api dev
pnpm --filter @fpm/analytics dev  
pnpm --filter @fpm/agents dev
pnpm --filter @fpm/web dev
```

## 📁 Project Structure

```
fpm/
├── apps/
│   ├── api/          # Fastify API (TypeScript)
│   │   ├── prisma/   # Database schema & migrations
│   │   └── src/      # API source code
│   ├── analytics/    # Analytics service (Python)
│   ├── agents/       # AI agent service (Python)
│   └── web/          # Next.js frontend
│       ├── src/
│       │   ├── app/          # App Router pages
│       │   ├── components/   # React components
│       │   └── lib/          # Utilities & API client
│       └── public/
├── infra/
│   └── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## 🔐 Environment Variables

### Required for Production

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/fpm

# Security
JWT_SECRET=your-secure-secret-min-32-chars

# API URLs (for frontend)
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

### Optional

```bash
# Redis (for caching)
REDIS_URL=redis://localhost:6379

# AI Services
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
```

## 🚀 Deployment

### Vercel (Frontend Only)

The Next.js frontend can be deployed to Vercel:

1. Connect your GitHub repository
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` - Your API URL
   - `AGENTS_URL` - Your agents service URL (server-side)
3. Deploy

### Full Stack (Docker)

For production with all services:

```bash
# Build production images
docker compose -f infra/docker-compose.yml build

# Deploy with production compose
docker compose -f infra/docker-compose.prod.yml up -d
```

### Database Migrations

```bash
# Generate migration
cd apps/api && npx prisma migrate dev --name your_migration

# Apply in production
npx prisma migrate deploy
```

## 📊 API Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user

### Accounts
- `GET /accounts` - List accounts
- `POST /accounts` - Create account
- `PUT /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

### Transactions
- `GET /transactions` - List transactions
- `POST /transactions` - Create transaction
- `PUT /transactions/:id` - Update transaction
- `DELETE /transactions/:id` - Delete transaction

### Budgets
- `GET /budgets/:month` - Get budget for month
- `POST /budgets/:month/envelopes` - Upsert envelope

### Portfolios
- `GET /portfolios` - List portfolios
- `POST /portfolios` - Create portfolio
- `POST /portfolios/:id/trades` - Add trade

## 🤖 AI Features

The AI Advisor uses Ollama with a local LLM to provide:
- Spending analysis
- Budget recommendations
- Investment guidance
- Financial tips

The AI has access to your financial context (with your permission) to give personalized advice.

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
