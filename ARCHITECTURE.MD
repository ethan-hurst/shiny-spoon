# TruthSource Architecture Overview (Next.js + Supabase)

This document provides a high-level overview of TruthSource's architecture using Next.js and Supabase.

## 🎯 Architecture Goals

1. **Data Accuracy**: Maintain 99.9% synchronization accuracy across systems
2. **Real-time Performance**: Instant updates using Supabase Realtime
3. **Scalability**: Leverage Supabase's infrastructure for automatic scaling
4. **Developer Experience**: Rapid development with Next.js and Supabase
5. **Security**: Built-in RLS (Row Level Security) and Supabase Auth

## 🏗 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            External Systems                              │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│    NetSuite     │   Shopify B2B   │   SAP B1        │   Dynamics 365  │
│      (ERP)      │  (E-commerce)   │    (ERP)        │     (ERP)       │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬────────┘
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Next.js App    │
                           │  (App Router)   │
                           └────────┬────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────▼────────┐       ┌─────────▼─────────┐       ┌────────▼────────┐
│   API Routes   │       │  Server Actions   │       │ Client Components│
│                │       │                   │       │                 │
│ • Webhooks     │       │ • Data mutations  │       │ • Real-time UI  │
│ • Integrations │       │ • Form handling   │       │ • Dashboards    │
│ • Scheduled    │       │ • Validation      │       │ • Forms         │
└────────┬───────┘       └─────────┬─────────┘       └────────┬────────┘
         │                         │                           │
         └─────────────────────────┴───────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │    Supabase     │
                           ├─────────────────┤
                           │ • PostgreSQL    │
                           │ • Auth          │
                           │ • Realtime      │
                           │ • Edge Functions│
                           │ • Storage       │
                           └────────┬────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
       ┌────────▼────────┐                   ┌─────────▼─────────┐
       │ Background Jobs │                   │   Monitoring      │
       │  (Vercel Cron)  │                   │   (Vercel)        │
       └─────────────────┘                   └───────────────────┘
```

## 🔧 Core Components

### 1. Next.js Application

- **App Router**: Modern Next.js 14+ architecture
- **Server Components**: Default for better performance
- **Client Components**: For interactive features
- **API Routes**: External webhooks and integrations
- **Server Actions**: Form submissions and mutations

### 2. Supabase Backend

- **PostgreSQL Database**: With RLS policies
- **Auth**: Built-in authentication with providers
- **Realtime**: Live data synchronization
- **Edge Functions**: Serverless compute for complex logic
- **Storage**: File uploads and documents

### 3. Integration Layer

- **API Routes**: Handle external webhooks
- **Background Jobs**: Vercel Cron for scheduled syncs
- **Edge Functions**: Process-intensive operations
- **Queue**: Supabase Queue (or Upstash) for async work

## 🔄 Data Flow

### Real-time Sync Flow

```
1. External System → Webhook → API Route
2. API Route → Validate → Supabase Insert/Update
3. Supabase → Realtime → Client Components
4. RLS Policies → Filter by Organization
5. UI Updates → Instantly via Subscription
```

### User Interaction Flow

```
1. User Action → Client Component
2. Client → Server Action (for mutations)
3. Server Action → Supabase Client
4. Supabase → Execute with RLS
5. Response → Revalidate Cache → Update UI
```

## 🛡 Security Architecture

### Authentication & Authorization

- Supabase Auth with multiple providers
- JWT tokens handled automatically
- RLS policies for data isolation
- Organization-based multi-tenancy

### Data Security

- RLS (Row Level Security) at database level
- Column-level encryption for sensitive data
- SSL/TLS for all connections
- Audit logs via Supabase

## 📊 Key Architecture Decisions

### Why Next.js?

- Full-stack framework with excellent DX
- Server Components for performance
- Built-in optimization and caching
- Great TypeScript support
- Vercel deployment integration

### Why Supabase?

- PostgreSQL with built-in APIs
- Real-time subscriptions out of the box
- Authentication without custom code
- RLS for secure multi-tenancy
- Automatic API generation

### Why This Stack for B2B SaaS?

- Rapid development without sacrificing quality
- Enterprise features (audit, RLS) built-in
- Scales automatically with Vercel + Supabase
- Modern stack attracts developers
- Cost-effective for startups

## 🚀 Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐
│     Vercel      │     │    Supabase     │
├─────────────────┤     ├─────────────────┤
│ • Next.js App   │────▶│ • PostgreSQL    │
│ • Edge Runtime  │     │ • Auth Service  │
│ • Cron Jobs     │     │ • Realtime      │
│ • Analytics     │     │ • Edge Functions│
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │  CDN (Global)│
              └─────────────┘
```

## 📁 Project Structure

```
truthsource/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes for webhooks
│   └── actions/           # Server actions
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── features/         # Feature-specific components
├── lib/                   # Utilities and helpers
│   ├── supabase/         # Supabase client setup
│   └── integrations/     # External API clients
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
└── supabase/             # Database migrations & types
```

## 🔮 Technology Choices

### Frontend

- **Next.js 14+**: App Router, Server Components
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library
- **React Query**: Client-side caching

### Backend

- **Supabase**: PostgreSQL + Auth + Realtime
- **Edge Functions**: Complex business logic
- **Vercel Cron**: Scheduled jobs
- **Zod**: Schema validation

### Development

- **pnpm**: Fast package manager
- **Prettier**: Code formatting
- **ESLint**: Code quality
- **Playwright**: E2E testing

## 📈 Performance Optimizations

### Next.js Optimizations

- Server Components by default
- Dynamic imports for code splitting
- Image optimization with next/image
- Font optimization
- Incremental Static Regeneration

### Database Optimizations

- Proper indexes on foreign keys
- Composite indexes for common queries
- Materialized views for analytics
- Connection pooling via Supabase

### Caching Strategy

- Next.js Data Cache for server-side
- React Query for client-side
- Revalidation on mutations
- Static pages where possible

---

For implementation details, see the [technical documentation](docs/technical/).
