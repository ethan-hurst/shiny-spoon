## 🛡️ Development Guards

Real-time development monitoring and quality enforcement system that catches security, performance, and quality issues during development.

### Quick Analysis

```bash
# Analyze all files for violations
npm run dev:guards:quick analyze

# Setup enhanced pre-commit hooks
npm run setup:hooks
```

**Recent Analysis Results:**
- 📊 479 files analyzed
- 🚨 7 violations found (5 security, 2 performance)
- ✅ Automated fixes available

Features:
- 🔒 **Security Guards**: Organization isolation, rate limiting, authentication
- ⚡ **Performance Guards**: N+1 query detection, bundle size monitoring
- ✨ **Quality Guards**: TypeScript strict mode, error handling validation
- 🔧 **Auto-fixes**: One-click violation resolution
- 📱 **Browser Toolbar**: Real-time violation display with VS Code integration

[📚 View Complete Documentation](docs/DEVELOPMENT-GUARDS.md)

---

# TruthSource - B2B E-commerce Data Accuracy Platform

<p align="center">
  <strong>Stop losing revenue to preventable order errors</strong><br>
  33% of B2B e-commerce orders contain errors. We fix that.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## 🎯 The Problem We Solve

**Every third B2B order has an error.** Inventory shows in-stock when it's not. Prices don't match contracts. Delivery promises are wrong. This costs the average distributor **$400,000 annually** in lost revenue, returns, and customer churn.

TruthSource ensures your ERP (NetSuite, SAP, Dynamics) and e-commerce platform (Shopify B2B, BigCommerce) show the same data, in real-time, with 99.9% accuracy.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account ([create free account](https://supabase.com))
- Git

### Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/your-org/truthsource.git
cd truthsource
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Set up the database**

```bash
# Start Supabase locally (optional)
pnpm supabase start

# Run migrations
pnpm supabase db push

# Generate TypeScript types
pnpm supabase gen types typescript --local > lib/database.types.ts
```

5. **Run the development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🛠 Tech Stack

### Frontend

- **[Next.js 14+](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[shadcn/ui](https://ui.shadcn.com/)** - Component library
- **[React Query](https://tanstack.com/query)** - Data fetching & caching
- **[React Hook Form](https://react-hook-form.com/)** - Form handling
- **[Zod](https://zod.dev/)** - Schema validation

### Backend

- **[Supabase](https://supabase.com/)** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Edge Functions
  - Vector embeddings (for search)
- **[Vercel](https://vercel.com/)** - Deployment & Edge Functions

### Development Tools

- **[Playwright](https://playwright.dev/)** - E2E testing
- **[Prettier](https://prettier.io/)** - Code formatting
- **[ESLint](https://eslint.org/)** - Linting
- **[Husky](https://typicode.github.io/husky/)** - Git hooks

## ✨ Features

### Core Features

- ✅ **Real-time Inventory Sync** - Multi-warehouse inventory tracking
- ✅ **Dynamic Pricing Engine** - Customer-specific pricing rules
- ✅ **Order Accuracy Monitor** - Detect and prevent errors before they happen
- ✅ **Multi-tenant Architecture** - Secure data isolation with RLS
- ✅ **Audit Trail** - Complete history of all changes

### Integrations

- ✅ NetSuite (via SuiteTalk API)
- ✅ Shopify B2B (via Admin API)
- 🚧 SAP Business One
- 🚧 Microsoft Dynamics 365
- 🚧 BigCommerce B2B

### Coming Soon

- 📅 AI-powered demand forecasting
- 📅 Automated reorder suggestions
- 📅 Mobile app for warehouse management
- 📅 Advanced analytics dashboard

## 📁 Project Structure

```
truthsource/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes for webhooks
│   └── actions/           # Server actions
├── components/            # React components
│   ├── ui/               # Base UI components (shadcn/ui)
│   └── features/         # Feature-specific components
├── lib/                   # Utilities and configurations
│   ├── supabase/         # Supabase client setup
│   ├── integrations/     # External API integrations
│   └── utils/           # Helper functions
├── hooks/                # Custom React hooks
├── types/               # TypeScript type definitions
├── supabase/            # Database migrations and functions
│   ├── migrations/      # SQL migration files
│   └── functions/       # Edge Functions
└── public/              # Static assets
```

## 🏗 Architecture

TruthSource uses a modern, serverless architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│    Supabase     │◀────│ External APIs   │
│  (Vercel Edge)  │     │   (PostgreSQL)  │     │ (ERP/E-comm)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                              Real-time
```

Key architectural decisions:

- **Server Components by default** for optimal performance
- **Row Level Security (RLS)** for data isolation
- **Real-time subscriptions** for instant updates
- **Edge Functions** for complex business logic
- **Incremental Static Regeneration** for marketing pages

## 🧪 Testing

TruthSource uses a comprehensive testing strategy to ensure reliability and maintainability. See [TESTING.md](TESTING.md) for detailed documentation.

### Testing Stack

- **Jest** - Unit and integration testing
- **React Testing Library** - Component testing
- **Playwright** - End-to-end testing
- **Performance benchmarks** - Ensure optimal performance

### Quick Test Commands

```bash
# Run all tests
pnpm test:all

# Unit tests
pnpm test:unit          # Run unit tests
pnpm test:watch         # Watch mode for development
pnpm test:coverage      # Generate coverage report

# Integration tests
pnpm test:integration   # Run integration tests

# E2E tests
pnpm test:e2e           # Run E2E tests
pnpm test:e2e:ui        # Interactive UI mode
pnpm test:e2e:headed    # See browser while testing

# Performance tests
pnpm test:perf          # Run performance benchmarks

# Validation scripts
pnpm validate:setup     # Validate PRP-001 (project setup)
pnpm validate:migrations # Validate PRP-002 (database migrations)
```

### Test Coverage

We maintain high test coverage standards:

- Unit tests for all utilities and business logic
- Integration tests for server actions and API routes
- E2E tests for critical user workflows
- Performance benchmarks for the pricing engine

Current coverage targets:

- Statements: 80%
- Branches: 70%
- Functions: 80%
- Lines: 80%

## 🚀 Deployment

### Deploy to Vercel

1. **Fork this repository**

2. **Create a new project on Vercel**
   - Import your forked repository
   - Configure environment variables
   - Deploy

3. **Set up Supabase**
   - Create a new Supabase project
   - Run migrations via Supabase Dashboard
   - Configure Auth providers

4. **Configure webhooks** (if using integrations)
   - NetSuite: `https://your-app.vercel.app/api/webhooks/netsuite`
   - Shopify: `https://your-app.vercel.app/api/webhooks/shopify`

### Environment Variables

Required environment variables for production:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Integrations (optional)
NETSUITE_ACCOUNT_ID=
NETSUITE_CONSUMER_KEY=
NETSUITE_CONSUMER_SECRET=
NETSUITE_TOKEN_ID=
NETSUITE_TOKEN_SECRET=

SHOPIFY_ACCESS_TOKEN=
SHOPIFY_WEBHOOK_SECRET=
```

## 📚 Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Supabase Integration Guide](docs/technical/supabase-integration-guide.md)
- [API Documentation](docs/technical/api-specification.md)
- [Deployment Guide](docs/technical/deployment-guide.md)

## 🤝 Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

### Code Style

- TypeScript for all new code
- Server Components by default
- Tailwind CSS for styling
- Follow the established patterns

## 📊 Performance

- **Lighthouse Score**: 95+ on all metrics
- **First Contentful Paint**: <1s
- **Time to Interactive**: <2s
- **API Response Time**: <200ms p95
- **Real-time Sync**: <30s end-to-end

## 🔒 Security

- SOC2 Type II compliant architecture
- All data encrypted at rest and in transit
- Row Level Security (RLS) for multi-tenancy
- Regular security audits
- GDPR compliant

## 📝 License

This project is proprietary software. See [LICENSE](LICENSE) for details.

## 🌟 Support

- **Documentation**: [docs.truthsource.io](https://docs.truthsource.io)
- **Discord**: [Join our community](https://discord.gg/truthsource)
- **Email**: support@truthsource.io

## 🙏 Acknowledgments

Built with amazing open source projects:

- [Next.js](https://nextjs.org/) by Vercel
- [Supabase](https://supabase.com/) - The open source Firebase alternative
- [shadcn/ui](https://ui.shadcn.com/) - Beautifully designed components
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework

---

<p align="center">
  <strong>TruthSource</strong><br>
  Your Single Source of Truth for B2B Data<br>
  <a href="https://truthsource.io">truthsource.io</a>
</p>
# Test commit for development guards
