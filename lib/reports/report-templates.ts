import type { ReportTemplate } from '@/types/reports.types'

export const SYSTEM_REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'inventory-summary',
    name: 'Inventory Summary Report',
    description:
      'Overview of current inventory levels, low stock alerts, and value by warehouse',
    category: 'inventory',
    is_system: true,
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    config: {
      name: 'Inventory Summary Report',
      layout: 'grid',
      components: [
        {
          id: 'title-1',
          type: 'text',
          config: {
            content: '<h1>Inventory Summary Report</h1>',
            alignment: 'center',
          },
          position: { x: 0, y: 0 },
          size: { width: 12, height: 1 },
        },
        {
          id: 'date-filter-1',
          type: 'filter',
          config: {
            label: 'Report Period',
            defaultRange: 'last30days',
          },
          position: { x: 0, y: 1 },
          size: { width: 12, height: 1 },
        },
        {
          id: 'metric-1',
          type: 'metric',
          config: {
            title: 'Total Inventory Value',
            dataSource: 'inventory',
            metric: 'total_value',
            aggregation: 'sum',
            format: 'currency',
          },
          position: { x: 0, y: 2 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'metric-2',
          type: 'metric',
          config: {
            title: 'Total SKUs',
            dataSource: 'inventory',
            metric: 'sku_count',
            aggregation: 'count',
            format: 'number',
          },
          position: { x: 3, y: 2 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'metric-3',
          type: 'metric',
          config: {
            title: 'Low Stock Items',
            dataSource: 'inventory',
            metric: 'low_stock_count',
            aggregation: 'count',
            format: 'number',
          },
          position: { x: 6, y: 2 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'metric-4',
          type: 'metric',
          config: {
            title: 'Out of Stock',
            dataSource: 'inventory',
            metric: 'out_of_stock_count',
            aggregation: 'count',
            format: 'number',
          },
          position: { x: 9, y: 2 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'chart-1',
          type: 'chart',
          config: {
            title: 'Inventory Value by Warehouse',
            dataSource: 'inventory_by_warehouse',
            chartType: 'bar',
            xAxis: 'warehouse_name',
            yAxis: 'total_value',
          },
          position: { x: 0, y: 4 },
          size: { width: 6, height: 4 },
        },
        {
          id: 'chart-2',
          type: 'chart',
          config: {
            title: 'Inventory Trends',
            dataSource: 'inventory_trends',
            chartType: 'line',
            xAxis: 'date',
            lines: ['total_value', 'total_quantity'],
          },
          position: { x: 6, y: 4 },
          size: { width: 6, height: 4 },
        },
        {
          id: 'table-1',
          type: 'table',
          config: {
            title: 'Low Stock Items',
            dataSource: 'low_stock_items',
            columns: [
              { field: 'sku', label: 'SKU' },
              { field: 'product_name', label: 'Product Name' },
              { field: 'current_quantity', label: 'Current Qty' },
              { field: 'reorder_point', label: 'Reorder Point' },
              { field: 'warehouse', label: 'Warehouse' },
            ],
            pageSize: 25,
          },
          position: { x: 0, y: 8 },
          size: { width: 12, height: 6 },
        },
      ],
      dataSources: [
        {
          id: 'inventory',
          type: 'query',
          query:
            'SELECT * FROM inventory_current WHERE organization_id = :orgId',
        },
        {
          id: 'inventory_by_warehouse',
          type: 'query',
          query: `
            SELECT 
              w.name as warehouse_name,
              SUM(i.quantity * p.unit_price) as total_value
            FROM inventory i
            JOIN warehouses w ON i.warehouse_id = w.id
            JOIN products p ON i.product_id = p.id
            WHERE i.organization_id = :orgId
            GROUP BY w.id, w.name
          `,
        },
        {
          id: 'inventory_trends',
          type: 'analytics',
          metric: 'inventory_snapshots',
        },
        {
          id: 'low_stock_items',
          type: 'query',
          query: `
            SELECT 
              p.sku,
              p.name as product_name,
              i.quantity as current_quantity,
              i.reorder_point,
              w.name as warehouse
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            JOIN warehouses w ON i.warehouse_id = w.id
            WHERE i.organization_id = :orgId
              AND i.quantity <= i.reorder_point
            ORDER BY i.quantity ASC
          `,
        },
      ],
      filters: [],
      style: {
        theme: 'light',
        spacing: 'normal',
      },
    },
  },
  {
    id: 'order-accuracy',
    name: 'Order Accuracy Report',
    description:
      'Track order accuracy metrics, error trends, and impact on revenue',
    category: 'orders',
    is_system: true,
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    config: {
      name: 'Order Accuracy Report',
      layout: 'grid',
      components: [],
      dataSources: [],
      filters: [],
      style: { theme: 'light', spacing: 'normal' },
    },
  },
  {
    id: 'sync-performance',
    name: 'Sync Performance Report',
    description: 'Monitor integration sync performance, failures, and latency',
    category: 'performance',
    is_system: true,
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    config: {
      name: 'Sync Performance Report',
      layout: 'grid',
      components: [],
      dataSources: [],
      filters: [],
      style: { theme: 'light', spacing: 'normal' },
    },
  },
]

// Helper to create custom templates
export function createReportTemplate(
  name: string,
  description: string,
  category: string,
  components: any[]
): ReportTemplate {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    category: category as any,
    is_system: false,
    is_public: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    config: {
      name,
      layout: 'grid',
      components,
      dataSources: [],
      filters: [],
      style: {
        theme: 'light',
        spacing: 'normal',
      },
    },
  }
}