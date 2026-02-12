# Niseko Gazet - Claude Code Project Instructions

## Project Overview
Niseko Gazet is a local news platform for Niseko, Japan featuring a TikTok-style
vertical feed (VO3), AI-assisted editorial workflow (Cizer), human-in-the-loop
approval system, and subscriber distribution manager with personalization.

## Tech Stack
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Database: PostgreSQL via Supabase, Drizzle ORM
- AI Service: Python FastAPI + Ollama (Cizer)
- Auth: NextAuth (Auth.js v5) with RBAC
- Testing: Vitest (unit/integration), Playwright (E2E)
- Deployment: Vercel (Next.js), Railway (Cizer), Supabase (DB)

## Key Commands
- `npm run dev` - Start Next.js dev server
- `npm run build` - Production build
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript check
- `npm test` - Run Vitest unit/integration tests
- `npm run e2e` - Run Playwright E2E tests
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio
- `cd services/cizer && uvicorn main:app --reload --port 8000` - Start Cizer

## Critical Invariants (NEVER violate)
1. No publish without matching ApprovalRecord for exact versionHash
2. StoryVersions are immutable once approved
3. AI (Cizer) must NEVER fabricate facts
4. All state changes must create audit log entries
5. Risk-flagged stories require explicit human acknowledgement before publish
6. Gated content requires active subscription entitlement

## Architecture Conventions
- All API routes use withAuth() RBAC wrapper
- Business logic lives in src/lib/services/, NOT in route handlers
- Validation uses Zod schemas from src/lib/validators/
- Database queries use Drizzle ORM (never raw SQL)
- Types are inferred from Drizzle schema (never manually defined)

## File Organization
- src/app/api/ - API route handlers (thin, delegate to services)
- src/lib/services/ - Business logic
- src/lib/db/ - Database schema, client, relations
- src/lib/validators/ - Zod validation schemas
- src/components/ - React components (ui/, feed/, newsroom/, etc.)
- services/cizer/ - Python AI service (separate process)
- tests/ - unit/, integration/, e2e/

## Risk Flags
Stories may contain these risk flags requiring human acknowledgement:
- identifiable_private_individual
- minor_involved
- allegation_or_crime_accusation
- ongoing_investigation
- medical_or_public_health_claim
- high_defamation_risk
- graphic_content
- sensitive_location

## Always use Context7 MCP for library documentation lookups.
