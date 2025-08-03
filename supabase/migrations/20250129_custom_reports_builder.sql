-- Custom Reports Builder Schema (PRP-019)

-- Report templates
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('inventory', 'orders', 'customers', 'performance', 'custom')),

  -- Template configuration
  config JSONB NOT NULL DEFAULT '{
    "layout": "grid",
    "components": [],
    "dataSources": [],
    "filters": [],
    "style": {}
  }',

  is_system BOOLEAN DEFAULT FALSE, -- System templates can't be edited
  is_public BOOLEAN DEFAULT FALSE, -- Available to all orgs

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's saved reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  template_id UUID REFERENCES report_templates(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Report configuration (overrides template)
  config JSONB NOT NULL,

  -- Scheduling
  schedule_enabled BOOLEAN DEFAULT FALSE,
  schedule_cron TEXT, -- Cron expression
  schedule_timezone TEXT DEFAULT 'UTC',
  schedule_recipients TEXT[], -- Email addresses
  schedule_format TEXT[] DEFAULT ARRAY['pdf'], -- pdf, csv, excel

  -- Sharing
  is_shared BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,

  -- Access control
  access_level TEXT DEFAULT 'private' CHECK (access_level IN ('private', 'team', 'organization')),

  -- Metadata
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report runs history
CREATE TABLE report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,

  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Parameters used for this run
  parameters JSONB DEFAULT '{}',

  -- Results
  result_url TEXT, -- S3/storage URL
  result_size_bytes INTEGER,
  record_count INTEGER,

  -- Delivery status
  delivery_status JSONB DEFAULT '[]', -- Array of {email, status, timestamp}

  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report components library
CREATE TABLE report_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('chart', 'table', 'metric', 'text', 'image', 'filter')),
  category TEXT NOT NULL,

  -- Component configuration schema
  config_schema JSONB NOT NULL,

  -- Default configuration
  default_config JSONB NOT NULL,

  -- Component metadata
  icon TEXT,
  preview_image TEXT,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_report_templates_org ON report_templates(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_reports_org ON reports(organization_id);
CREATE INDEX idx_reports_schedule ON reports(organization_id, schedule_enabled) WHERE schedule_enabled = TRUE;
CREATE INDEX idx_report_runs_report ON report_runs(report_id, created_at DESC);
CREATE INDEX idx_reports_share_token ON reports(share_token) WHERE share_token IS NOT NULL;

-- RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and public templates" ON report_templates
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    OR is_public = TRUE
  );

CREATE POLICY "Users can manage own templates" ON report_templates
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    AND is_system = FALSE
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    AND is_system = FALSE
  );

CREATE POLICY "Users can view reports based on access level" ON reports
  FOR SELECT USING (
    CASE
      WHEN access_level = 'private' THEN created_by = auth.uid()
      WHEN access_level = 'team' THEN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND organization_id = reports.organization_id
      )
      WHEN access_level = 'organization' THEN
        organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
      ELSE FALSE
    END
  );

CREATE POLICY "Users can manage own reports" ON reports
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view report runs for accessible reports" ON report_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_runs.report_id
      AND (
        reports.created_by = auth.uid()
        OR (reports.access_level != 'private' AND
            reports.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()))
      )
    )
  );

-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload report results" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reports' AND
    EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE r.created_by = auth.uid()
      AND storage.filename(name) LIKE rr.id || '%'
    )
  );

CREATE POLICY "Users can view own report results" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports' AND
    EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE (
        r.created_by = auth.uid()
        OR (r.access_level != 'private' AND
            r.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()))
      )
      AND storage.filename(name) LIKE rr.id || '%'
    )
  );

-- Function to execute report queries securely
CREATE OR REPLACE FUNCTION execute_report_query(
  query TEXT,
  parameters JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  org_id UUID;
BEGIN
  -- Get the user's organization
  SELECT organization_id INTO org_id
  FROM user_profiles
  WHERE user_id = auth.uid();

  -- Validate query (basic checks)
  IF position('DELETE' IN upper(query)) > 0 OR
     position('UPDATE' IN upper(query)) > 0 OR
     position('INSERT' IN upper(query)) > 0 OR
     position('DROP' IN upper(query)) > 0 OR
     position('CREATE' IN upper(query)) > 0 OR
     position('ALTER' IN upper(query)) > 0 THEN
    RAISE EXCEPTION 'Queries must be read-only';
  END IF;

  -- Execute query with parameters
  -- This is a simplified version - in production, use proper parameterized queries
  EXECUTE format(
    'SELECT json_agg(row_to_json(t)) FROM (%s) t',
    replace(replace(query, ':orgId', quote_literal(org_id::text)), ':parameters', parameters::text)
  ) INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Insert system report templates
INSERT INTO report_templates (name, description, category, is_system, is_public, config) VALUES
(
  'Inventory Summary Report',
  'Overview of current inventory levels, low stock alerts, and value by warehouse',
  'inventory',
  true,
  true,
  '{
    "name": "Inventory Summary Report",
    "layout": "grid",
    "components": [
      {
        "id": "title-1",
        "type": "text",
        "config": {
          "content": "<h1>Inventory Summary Report</h1>",
          "alignment": "center"
        },
        "position": {"x": 0, "y": 0},
        "size": {"width": 12, "height": 1}
      },
      {
        "id": "metric-1",
        "type": "metric",
        "config": {
          "title": "Total Inventory Value",
          "dataSource": "inventory",
          "metric": "total_value",
          "aggregation": "sum",
          "format": "currency"
        },
        "position": {"x": 0, "y": 2},
        "size": {"width": 3, "height": 2}
      },
      {
        "id": "metric-2",
        "type": "metric",
        "config": {
          "title": "Total SKUs",
          "dataSource": "inventory",
          "metric": "sku_count",
          "aggregation": "count",
          "format": "number"
        },
        "position": {"x": 3, "y": 2},
        "size": {"width": 3, "height": 2}
      },
      {
        "id": "metric-3",
        "type": "metric",
        "config": {
          "title": "Low Stock Items",
          "dataSource": "inventory",
          "metric": "low_stock_count",
          "aggregation": "count",
          "format": "number"
        },
        "position": {"x": 6, "y": 2},
        "size": {"width": 3, "height": 2}
      }
    ],
    "dataSources": [
      {
        "id": "inventory",
        "type": "query",
        "query": "SELECT * FROM inventory_current WHERE organization_id = :orgId"
      }
    ],
    "filters": [],
    "style": {
      "theme": "light",
      "spacing": "normal"
    }
  }'
),
(
  'Order Performance Report',
  'Track order accuracy, fulfillment times, and error rates',
  'orders',
  true,
  true,
  '{
    "name": "Order Performance Report",
    "layout": "grid",
    "components": [],
    "dataSources": [],
    "filters": [],
    "style": {"theme": "light", "spacing": "normal"}
  }'
),
(
  'Customer Analysis Report',
  'Customer segments, purchase patterns, and lifetime value',
  'customers',
  true,
  true,
  '{
    "name": "Customer Analysis Report",
    "layout": "grid",
    "components": [],
    "dataSources": [],
    "filters": [],
    "style": {"theme": "light", "spacing": "normal"}
  }'
);

-- Insert default report components
INSERT INTO report_components (name, type, category, config_schema, default_config, icon) VALUES
(
  'Bar Chart',
  'chart',
  'Visualizations',
  '{
    "title": {"type": "string", "label": "Title"},
    "dataSource": {"type": "select", "label": "Data Source"},
    "xAxis": {"type": "field", "label": "X Axis"},
    "yAxis": {"type": "field", "label": "Y Axis"},
    "color": {"type": "color", "label": "Color"}
  }',
  '{
    "title": "Bar Chart",
    "xAxis": "",
    "yAxis": "",
    "color": "hsl(var(--chart-1))"
  }',
  'BarChart'
),
(
  'Line Chart',
  'chart',
  'Visualizations',
  '{
    "title": {"type": "string", "label": "Title"},
    "dataSource": {"type": "select", "label": "Data Source"},
    "xAxis": {"type": "field", "label": "X Axis"},
    "yAxis": {"type": "field", "label": "Y Axis"},
    "lines": {"type": "multi-field", "label": "Lines"}
  }',
  '{
    "title": "Line Chart",
    "xAxis": "",
    "yAxis": "",
    "lines": []
  }',
  'LineChart'
),
(
  'Data Table',
  'table',
  'Data',
  '{
    "title": {"type": "string", "label": "Title"},
    "dataSource": {"type": "select", "label": "Data Source"},
    "columns": {"type": "columns", "label": "Columns"},
    "pageSize": {"type": "number", "label": "Page Size", "min": 10, "max": 100}
  }',
  '{
    "title": "Data Table",
    "columns": [],
    "pageSize": 25
  }',
  'Table'
),
(
  'Metric Card',
  'metric',
  'KPIs',
  '{
    "title": {"type": "string", "label": "Title"},
    "dataSource": {"type": "select", "label": "Data Source"},
    "metric": {"type": "field", "label": "Metric Field"},
    "aggregation": {"type": "select", "label": "Aggregation", "options": ["sum", "avg", "count", "min", "max"]},
    "comparison": {"type": "boolean", "label": "Show Comparison"},
    "format": {"type": "select", "label": "Format", "options": ["number", "currency", "percentage"]}
  }',
  '{
    "title": "Metric",
    "aggregation": "sum",
    "format": "number",
    "comparison": false
  }',
  'Card'
),
(
  'Text Block',
  'text',
  'Content',
  '{
    "content": {"type": "richtext", "label": "Content"},
    "alignment": {"type": "select", "label": "Alignment", "options": ["left", "center", "right"]}
  }',
  '{
    "content": "<p>Enter your text here...</p>",
    "alignment": "left"
  }',
  'Type'
),
(
  'Date Range Filter',
  'filter',
  'Filters',
  '{
    "label": {"type": "string", "label": "Label"},
    "defaultRange": {"type": "select", "label": "Default Range", "options": ["last7days", "last30days", "last90days", "custom"]}
  }',
  '{
    "label": "Date Range",
    "defaultRange": "last30days"
  }',
  'Filter'
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_timestamp
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER update_report_templates_timestamp
BEFORE UPDATE ON report_templates
FOR EACH ROW
EXECUTE FUNCTION update_reports_updated_at();