export interface PRP {
  id: string
  title: string
  description: string
  status: 'implemented' | 'partial' | 'documented' | 'planned'
  documentPath?: string
  implementedFiles?: string[]
  missingFeatures?: string[]
}

export interface Phase {
  id: string
  name: string
  description: string
  prps: PRP[]
}

export const prpData: Phase[] = [
  {
    id: 'phase-1',
    name: 'Phase 1',
    description: 'Foundation Setup',
    prps: [
      {
        id: 'PRP-001',
        title: 'Project Setup',
        description: 'Next.js, TypeScript, Tailwind CSS, shadcn/ui',
        status: 'implemented',
        documentPath: 'Phase 1/PRP-001.md',
        implementedFiles: [
          'app/',
          'components/ui/',
          'tailwind.config.ts',
          'tsconfig.json'
        ]
      },
      {
        id: 'PRP-002',
        title: 'Supabase Configuration',
        description: 'Database, Auth, RLS policies',
        status: 'implemented',
        documentPath: 'Phase 1/PRP-002.md',
        implementedFiles: [
          'supabase/migrations/*.sql',
          'lib/supabase/client.ts',
          'lib/supabase/server.ts',
          'lib/supabase/middleware.ts'
        ]
      },
      {
        id: 'PRP-003',
        title: 'Authentication Flow',
        description: 'Login, Signup, Password Reset',
        status: 'implemented',
        documentPath: 'Phase 1/PRP-003.md',
        implementedFiles: [
          'app/(auth)/login/page.tsx',
          'app/(auth)/signup/page.tsx',
          'app/(auth)/reset-password/page.tsx',
          'components/features/auth/*'
        ]
      },
      {
        id: 'PRP-004',
        title: 'Dashboard Layout',
        description: 'Sidebar, Navigation, Responsive',
        status: 'implemented',
        documentPath: 'Phase 1/PRP-004.md',
        implementedFiles: [
          'app/(dashboard)/layout.tsx',
          'components/layouts/dashboard-sidebar.tsx',
          'components/layouts/dashboard-header.tsx'
        ]
      }
    ]
  },
  {
    id: 'phase-2',
    name: 'Phase 2',
    description: 'Core Features',
    prps: [
      {
        id: 'PRP-005',
        title: 'Products Management',
        description: 'CRUD, Images, Variants',
        status: 'implemented',
        documentPath: 'Phase 2/PRP-005.md',
        implementedFiles: [
          'app/(dashboard)/products/page.tsx',
          'components/features/products/*',
          'app/actions/products.ts',
          'lib/products/*'
        ]
      },
      {
        id: 'PRP-006',
        title: 'Warehouse Management',
        description: 'Locations, Contacts, Zones',
        status: 'implemented',
        documentPath: 'Phase 2/PRP-006.md',
        implementedFiles: [
          'app/(dashboard)/warehouses/page.tsx',
          'components/features/warehouses/*',
          'app/actions/warehouses.ts'
        ]
      },
      {
        id: 'PRP-007',
        title: 'Inventory Management Core',
        description: 'Stock levels, Adjustments',
        status: 'implemented',
        documentPath: 'Phase 2/PRP-007.md',
        implementedFiles: [
          'app/(dashboard)/inventory/page.tsx',
          'components/features/inventory/*',
          'app/actions/inventory.ts'
        ]
      },
      {
        id: 'PRP-008',
        title: 'Real-time Inventory Updates',
        description: 'WebSocket, Offline queue',
        status: 'implemented',
        documentPath: 'Phase 2/PRP-008.md',
        implementedFiles: [
          'lib/realtime/*',
          'components/features/inventory/performance-widget.tsx',
          'lib/offline/queue.ts'
        ]
      }
    ]
  },
  {
    id: 'phase-3',
    name: 'Phase 3',
    description: 'Business Logic',
    prps: [
      {
        id: 'PRP-009',
        title: 'Customer Management',
        description: 'Customers, Contacts, Credit',
        status: 'documented',
        documentPath: 'Phase 3/PRP-009.md'
      },
      {
        id: 'PRP-010',
        title: 'Pricing Rules Engine',
        description: 'Rules, Tiers, Promotions',
        status: 'documented',
        documentPath: 'Phase 3/PRP-010.md'
      },
      {
        id: 'PRP-011',
        title: 'Sync Status Dashboard',
        description: 'Status, Logs, Health',
        status: 'documented',
        documentPath: 'Phase 3/PRP-011.md'
      }
    ]
  },
  {
    id: 'phase-4',
    name: 'Phase 4',
    description: 'Integration Layer',
    prps: [
      {
        id: 'PRP-012',
        title: 'Integration Framework',
        description: 'Base classes, Queues',
        status: 'documented',
        documentPath: 'Phase 4/PRP-012.md'
      },
      {
        id: 'PRP-013',
        title: 'NetSuite Connector',
        description: 'REST, SOAP, SuiteQL',
        status: 'documented',
        documentPath: 'Phase 4/PRP-013.md'
      },
      {
        id: 'PRP-014',
        title: 'Shopify B2B Integration',
        description: 'GraphQL, Webhooks',
        status: 'documented',
        documentPath: 'Phase 4/PRP-014.md'
      }
    ]
  },
  {
    id: 'phase-5',
    name: 'Phase 5',
    description: 'Advanced Features',
    prps: [
      {
        id: 'PRP-015',
        title: 'Sync Engine Core',
        description: 'Orchestration, Scheduling',
        status: 'documented',
        documentPath: 'Phase 5/PRP-015.md'
      },
      {
        id: 'PRP-016',
        title: 'Data Accuracy Monitor',
        description: 'Validation, Anomalies',
        status: 'documented',
        documentPath: 'Phase 5/PRP-016.md'
      },
      {
        id: 'PRP-017',
        title: 'Bulk Operations',
        description: 'CSV upload/export, streaming processor',
        status: 'partial',
        documentPath: 'Phase 5/PRP-017.md',
        implementedFiles: [
          'lib/csv/parser.ts',
          'components/features/inventory/bulk-upload-dialog.tsx',
          'lib/csv/templates.ts'
        ],
        missingFeatures: [
          'Streaming processor for large files',
          'Progress tracking with SSE',
          'Rollback functionality'
        ]
      },
      {
        id: 'PRP-019',
        title: 'Custom Reports Builder',
        description: 'Drag-drop, Templates',
        status: 'documented',
        documentPath: 'Phase 5/PRP-019.md'
      },
      {
        id: 'PRP-020',
        title: 'Audit Trail & Compliance',
        description: 'Logging, GDPR',
        status: 'documented'
      },
      {
        id: 'PRP-021',
        title: 'AI-Powered Insights',
        description: 'Forecasting, Anomalies',
        status: 'documented',
        documentPath: 'Phase 5/PRP-021.md'
      }
    ]
  },
  {
    id: 'phase-6',
    name: 'Phase 6',
    description: 'Analytics & Reporting',
    prps: [
      {
        id: 'PRP-018',
        title: 'Analytics Dashboard',
        description: 'Charts, Metrics, Export',
        status: 'documented',
        documentPath: 'Phase 6/PRP-018.md'
      },
      {
        id: 'PRP-022',
        title: 'Export & Scheduling',
        description: 'Scheduled reports',
        status: 'planned'
      }
    ]
  },
  {
    id: 'phase-7',
    name: 'Phase 7',
    description: 'Performance & Scale',
    prps: [
      {
        id: 'PRP-023',
        title: 'Performance Optimization',
        description: 'Caching, CDN',
        status: 'planned'
      },
      {
        id: 'PRP-024',
        title: 'Horizontal Scaling',
        description: 'Multi-tenant',
        status: 'planned'
      },
      {
        id: 'PRP-025',
        title: 'Load Testing',
        description: 'Stress tests',
        status: 'planned'
      }
    ]
  },
  {
    id: 'phase-8',
    name: 'Phase 8',
    description: 'Advanced Integrations',
    prps: [
      {
        id: 'PRP-026',
        title: 'Multi-ERP Support',
        description: 'SAP, Oracle',
        status: 'planned'
      },
      {
        id: 'PRP-027',
        title: 'API Gateway',
        description: 'Public API',
        status: 'planned'
      },
      {
        id: 'PRP-028',
        title: 'Mobile Applications',
        description: 'iOS, Android',
        status: 'planned'
      }
    ]
  }
]