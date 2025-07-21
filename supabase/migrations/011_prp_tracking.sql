-- PRP tracking tables for development progress

-- PRP phases
CREATE TABLE prp_phases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRP records
CREATE TABLE prps (
  id TEXT PRIMARY KEY, -- e.g., 'PRP-001'
  phase_id TEXT REFERENCES prp_phases(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'documented', 'partial', 'implemented')),
  document_path TEXT,
  
  -- Implementation tracking
  implementation_started_at TIMESTAMPTZ,
  implementation_completed_at TIMESTAMPTZ,
  implemented_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRP implementation files
CREATE TABLE prp_implementation_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prp_id TEXT REFERENCES prps(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRP missing features (for partial implementations)
CREATE TABLE prp_missing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prp_id TEXT REFERENCES prps(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRP dependencies
CREATE TABLE prp_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prp_id TEXT REFERENCES prps(id) ON DELETE CASCADE,
  depends_on_prp_id TEXT REFERENCES prps(id) ON DELETE CASCADE,
  dependency_type TEXT CHECK (dependency_type IN ('requires', 'recommended', 'optional')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(prp_id, depends_on_prp_id)
);

-- Insert initial data
INSERT INTO prp_phases (id, name, description, sort_order) VALUES
  ('phase-1', 'Phase 1', 'Foundation Setup', 1),
  ('phase-2', 'Phase 2', 'Core Features', 2),
  ('phase-3', 'Phase 3', 'Business Logic', 3),
  ('phase-4', 'Phase 4', 'Integration Layer', 4),
  ('phase-5', 'Phase 5', 'Advanced Features', 5),
  ('phase-6', 'Phase 6', 'Analytics & Reporting', 6),
  ('phase-7', 'Phase 7', 'Performance & Scale', 7),
  ('phase-8', 'Phase 8', 'Advanced Integrations', 8);

-- Insert existing PRPs
INSERT INTO prps (id, phase_id, title, description, status, document_path) VALUES
  -- Phase 1 (all implemented)
  ('PRP-001', 'phase-1', 'Project Setup', 'Next.js, TypeScript, Tailwind CSS, shadcn/ui', 'implemented', 'Phase 1/PRP-001.md'),
  ('PRP-002', 'phase-1', 'Supabase Configuration', 'Database, Auth, RLS policies', 'implemented', 'Phase 1/PRP-002.md'),
  ('PRP-003', 'phase-1', 'Authentication Flow', 'Login, Signup, Password Reset', 'implemented', 'Phase 1/PRP-003.md'),
  ('PRP-004', 'phase-1', 'Dashboard Layout', 'Sidebar, Navigation, Responsive', 'implemented', 'Phase 1/PRP-004.md'),
  
  -- Phase 2 (all implemented)
  ('PRP-005', 'phase-2', 'Products Management', 'CRUD, Images, Variants', 'implemented', 'Phase 2/PRP-005.md'),
  ('PRP-006', 'phase-2', 'Warehouse Management', 'Locations, Contacts, Zones', 'implemented', 'Phase 2/PRP-006.md'),
  ('PRP-007', 'phase-2', 'Inventory Management Core', 'Stock levels, Adjustments', 'implemented', 'Phase 2/PRP-007.md'),
  ('PRP-008', 'phase-2', 'Real-time Inventory Updates', 'WebSocket, Offline queue', 'implemented', 'Phase 2/PRP-008.md'),
  
  -- Phase 3 (documented)
  ('PRP-009', 'phase-3', 'Customer Management', 'Customers, Contacts, Credit', 'documented', 'Phase 3/PRP-009.md'),
  ('PRP-010', 'phase-3', 'Pricing Rules Engine', 'Rules, Tiers, Promotions', 'documented', 'Phase 3/PRP-010.md'),
  ('PRP-011', 'phase-3', 'Sync Status Dashboard', 'Status, Logs, Health', 'documented', 'Phase 3/PRP-011.md'),
  
  -- Phase 4 (documented)
  ('PRP-012', 'phase-4', 'Integration Framework', 'Base classes, Queues', 'documented', 'Phase 4/PRP-012.md'),
  ('PRP-013', 'phase-4', 'NetSuite Connector', 'REST, SOAP, SuiteQL', 'documented', 'Phase 4/PRP-013.md'),
  ('PRP-014', 'phase-4', 'Shopify B2B Integration', 'GraphQL, Webhooks', 'documented', 'Phase 4/PRP-014.md'),
  
  -- Phase 5 (mix of documented and partial)
  ('PRP-015', 'phase-5', 'Sync Engine Core', 'Orchestration, Scheduling', 'documented', 'Phase 5/PRP-015.md'),
  ('PRP-016', 'phase-5', 'Data Accuracy Monitor', 'Validation, Anomalies', 'documented', 'Phase 5/PRP-016.md'),
  ('PRP-017', 'phase-5', 'Bulk Operations', 'CSV upload/export, streaming processor', 'partial', 'Phase 5/PRP-017.md'),
  ('PRP-019', 'phase-5', 'Custom Reports Builder', 'Drag-drop, Templates', 'documented', 'Phase 5/PRP-019.md'),
  ('PRP-020', 'phase-5', 'Audit Trail & Compliance', 'Logging, GDPR', 'documented', NULL),
  ('PRP-021', 'phase-5', 'AI-Powered Insights', 'Forecasting, Anomalies', 'documented', 'Phase 5/PRP-021.md'),
  
  -- Phase 6 (documented)
  ('PRP-018', 'phase-6', 'Analytics Dashboard', 'Charts, Metrics, Export', 'documented', 'Phase 6/PRP-018.md'),
  ('PRP-022', 'phase-6', 'Export & Scheduling', 'Scheduled reports', 'planned', NULL),
  
  -- Phase 7 (planned)
  ('PRP-023', 'phase-7', 'Performance Optimization', 'Caching, CDN', 'planned', NULL),
  ('PRP-024', 'phase-7', 'Horizontal Scaling', 'Multi-tenant', 'planned', NULL),
  ('PRP-025', 'phase-7', 'Load Testing', 'Stress tests', 'planned', NULL),
  
  -- Phase 8 (planned)
  ('PRP-026', 'phase-8', 'Multi-ERP Support', 'SAP, Oracle', 'planned', NULL),
  ('PRP-027', 'phase-8', 'API Gateway', 'Public API', 'planned', NULL),
  ('PRP-028', 'phase-8', 'Mobile Applications', 'iOS, Android', 'planned', NULL);

-- Insert implementation files for implemented PRPs
INSERT INTO prp_implementation_files (prp_id, file_path, file_type) VALUES
  -- PRP-001
  ('PRP-001', 'app/', 'directory'),
  ('PRP-001', 'components/ui/', 'directory'),
  ('PRP-001', 'tailwind.config.ts', 'config'),
  ('PRP-001', 'tsconfig.json', 'config'),
  
  -- PRP-002
  ('PRP-002', 'supabase/migrations/*.sql', 'sql'),
  ('PRP-002', 'lib/supabase/client.ts', 'typescript'),
  ('PRP-002', 'lib/supabase/server.ts', 'typescript'),
  ('PRP-002', 'lib/supabase/middleware.ts', 'typescript'),
  
  -- PRP-003
  ('PRP-003', 'app/(auth)/login/page.tsx', 'page'),
  ('PRP-003', 'app/(auth)/signup/page.tsx', 'page'),
  ('PRP-003', 'app/(auth)/reset-password/page.tsx', 'page'),
  ('PRP-003', 'components/features/auth/*', 'components'),
  
  -- PRP-004
  ('PRP-004', 'app/(dashboard)/layout.tsx', 'layout'),
  ('PRP-004', 'components/layouts/dashboard-sidebar.tsx', 'component'),
  ('PRP-004', 'components/layouts/dashboard-header.tsx', 'component'),
  
  -- PRP-005
  ('PRP-005', 'app/(dashboard)/products/page.tsx', 'page'),
  ('PRP-005', 'components/features/products/*', 'components'),
  ('PRP-005', 'app/actions/products.ts', 'actions'),
  ('PRP-005', 'lib/products/*', 'library'),
  
  -- PRP-006
  ('PRP-006', 'app/(dashboard)/warehouses/page.tsx', 'page'),
  ('PRP-006', 'components/features/warehouses/*', 'components'),
  ('PRP-006', 'app/actions/warehouses.ts', 'actions'),
  
  -- PRP-007
  ('PRP-007', 'app/(dashboard)/inventory/page.tsx', 'page'),
  ('PRP-007', 'components/features/inventory/*', 'components'),
  ('PRP-007', 'app/actions/inventory.ts', 'actions'),
  
  -- PRP-008
  ('PRP-008', 'lib/realtime/*', 'library'),
  ('PRP-008', 'components/features/inventory/performance-widget.tsx', 'component'),
  ('PRP-008', 'lib/offline/queue.ts', 'library'),
  
  -- PRP-017 (partial)
  ('PRP-017', 'lib/csv/parser.ts', 'library'),
  ('PRP-017', 'components/features/inventory/bulk-upload-dialog.tsx', 'component'),
  ('PRP-017', 'lib/csv/templates.ts', 'library');

-- Insert missing features for partial implementations
INSERT INTO prp_missing_features (prp_id, feature, priority) VALUES
  ('PRP-017', 'Streaming processor for large files', 'high'),
  ('PRP-017', 'Progress tracking with SSE', 'high'),
  ('PRP-017', 'Rollback functionality', 'medium');

-- Insert dependencies
INSERT INTO prp_dependencies (prp_id, depends_on_prp_id, dependency_type, notes) VALUES
  ('PRP-009', 'PRP-010', 'recommended', 'Customer pricing tiers integrate with pricing engine'),
  ('PRP-011', 'PRP-012', 'requires', 'Sync status needs integration framework'),
  ('PRP-013', 'PRP-012', 'requires', 'NetSuite connector needs base framework'),
  ('PRP-014', 'PRP-012', 'requires', 'Shopify connector needs base framework'),
  ('PRP-015', 'PRP-012', 'requires', 'Sync engine needs integration framework'),
  ('PRP-016', 'PRP-015', 'requires', 'Data accuracy monitor needs sync engine'),
  ('PRP-018', 'PRP-007', 'requires', 'Analytics needs inventory data'),
  ('PRP-019', 'PRP-018', 'recommended', 'Reports builder can leverage analytics components'),
  ('PRP-021', 'PRP-018', 'requires', 'AI insights need analytics data');

-- Functions for statistics
CREATE OR REPLACE FUNCTION get_prp_statistics()
RETURNS TABLE (
  total_prps INTEGER,
  implemented INTEGER,
  partial INTEGER,
  documented INTEGER,
  planned INTEGER,
  implementation_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_prps,
    COUNT(*) FILTER (WHERE status = 'implemented')::INTEGER as implemented,
    COUNT(*) FILTER (WHERE status = 'partial')::INTEGER as partial,
    COUNT(*) FILTER (WHERE status = 'documented')::INTEGER as documented,
    COUNT(*) FILTER (WHERE status = 'planned')::INTEGER as planned,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'implemented')::NUMERIC / 
      COUNT(*)::NUMERIC * 100, 
      2
    ) as implementation_rate
  FROM prps;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX idx_prps_phase ON prps(phase_id);
CREATE INDEX idx_prps_status ON prps(status);
CREATE INDEX idx_prp_files_prp ON prp_implementation_files(prp_id);
CREATE INDEX idx_prp_features_prp ON prp_missing_features(prp_id);
CREATE INDEX idx_prp_deps_prp ON prp_dependencies(prp_id);
CREATE INDEX idx_prp_deps_depends ON prp_dependencies(depends_on_prp_id);

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_prp_statistics() TO authenticated;