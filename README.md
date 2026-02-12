# Niseko Gazet

Local news platform for Niseko, Japan featuring a TikTok-style vertical video feed (VO3), AI-assisted editorial workflow (Cizer), human-in-the-loop approval system, and subscriber distribution with personalization.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js 16 (App Router)                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ VO3 Feed │  │ Newsroom │  │ Dashboard     │  │
│  │ (Public) │  │ (Auth)   │  │ (Role-based)  │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│  ┌────┴──────────────┴────────────────┴───────┐  │
│  │          API Routes (30 endpoints)         │  │
│  │   Auth · Feed · Stories · Moderation       │  │
│  │   Subscriptions · Preferences · Tips       │  │
│  └────────────────┬───────────────────────────┘  │
│                   │                              │
├───────────────────┼──────────────────────────────┤
│  Services Layer   │                              │
│  ┌────────────────┴───────────────────────────┐  │
│  │  story-service · delivery-service          │  │
│  │  subscriber-service · moderation-service   │  │
│  │  audit-log · version-hash · rbac           │  │
│  └────────────────┬───────────────────────────┘  │
│                   │                              │
│  ┌────────────────┴───────────────────────────┐  │
│  │  Drizzle ORM · PostgreSQL (Supabase)       │  │
│  │  10 tables · 9 enums · RBAC middleware     │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
        │
        │  /api/cizer/*
        ▼
┌───────────────────┐     ┌──────────────────┐
│  Cizer (FastAPI)  │────▶│  Ollama / HF     │
│  AI Editor-in-    │     │  qwen2.5-7b      │
│  Chief            │     │  (fine-tuned)     │
└───────────────────┘     └──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Animation | Framer Motion |
| State | Zustand, React Query |
| Database | PostgreSQL via Supabase, Drizzle ORM |
| Auth | NextAuth v5 (Auth.js) with JWT + RBAC |
| AI Service | Python FastAPI + Ollama |
| ML Training | TRL on HuggingFace Jobs |
| Testing | Vitest (148 tests), Playwright (E2E) |
| CI/CD | GitHub Actions |
| Deploy | Vercel (frontend), Railway (Cizer) |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Push database schema
npm run db:push

# Seed admin user
npx tsx scripts/seed-admin.ts

# Start development
npm run dev
```

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm test             # Run Vitest (148 tests)
npm run e2e          # Run Playwright E2E tests
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## Database Schema

10 tables with full relations:

- **users** - Authentication, roles (admin/editor/moderator/journalist/subscriber)
- **field_notes** - Raw 5W1H journalist input
- **stories** - Published articles with status workflow
- **story_versions** - Immutable content versions with SHA-256 hash
- **approval_records** - Editorial approval binding approver to version hash
- **delivery_logs** - Per-subscriber delivery tracking
- **subscriptions** - Plan-based entitlements (free/basic/premium/enterprise)
- **user_preferences** - Followed/muted topics, quiet hours, frequency caps
- **moderation_queue** - Anonymous tips and flagged content
- **audit_logs** - All state changes with actor, action, IP

## Critical Invariants

1. **No publish without approval** - Publishing requires a matching ApprovalRecord for the exact versionHash
2. **Version immutability** - StoryVersions cannot be modified once approved
3. **No fabrication** - Cizer AI must never fabricate facts
4. **Audit everything** - All state changes create audit log entries
5. **Risk acknowledgement** - Risk-flagged stories require explicit human acknowledgement
6. **Entitlement gating** - Gated content requires active subscription

## Cizer AI Service

The AI Editor-in-Chief runs as a separate Python service:

```bash
cd services/cizer
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Training Pipeline

Fine-tune Cizer on editorial data using HuggingFace Jobs:

```bash
# Generate training data from seed examples
uv run services/cizer/training/generate_training_data.py \
  --seed-file data/training-seed.json \
  --output-repo caesarniseko/niseko-gazet-editorial-data

# Submit SFT training job (see services/cizer/training/sft_train.py)
# Convert to GGUF for Ollama (see services/cizer/training/convert_to_gguf.py)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feed` | Public | Paginated feed with filters |
| POST | `/api/tips` | Public | Submit anonymous tip |
| POST | `/api/field-notes` | Journalist+ | Create field note |
| GET/POST | `/api/stories` | Journalist+ | Story CRUD |
| POST | `/api/stories/[id]/versions` | Journalist+ | Create version |
| POST | `/api/stories/[id]/approve` | Editor+ | Approve/reject version |
| POST | `/api/stories/[id]/publish` | Editor+ | Publish (the gate) |
| GET/PUT | `/api/subscriptions` | Subscriber+ | Manage subscription |
| GET/PUT | `/api/preferences` | Subscriber+ | User preferences |
| GET/PATCH | `/api/moderation` | Moderator+ | Moderation queue |
| POST | `/api/cizer/process` | Journalist+ | Process field note |
| POST | `/api/cizer/risks` | Journalist+ | Classify risk flags |
| POST | `/api/cizer/fact-check` | Journalist+ | Fact-check suggestions |

## Deployment

### Frontend (Vercel)

```bash
npx vercel --prod
```

### Cizer AI (Railway)

Deploy `services/cizer/` as a Python service with Ollama sidecar.

### Database (Supabase)

Create a project at [supabase.com](https://supabase.com/dashboard), then:

```bash
npm run db:push
npx tsx scripts/seed-admin.ts
```

## License

Private - All rights reserved.
