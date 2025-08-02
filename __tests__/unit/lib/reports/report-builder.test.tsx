import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { ReportBuilder } from '@/components/features/reports/report-builder'
import { ComponentLibrary } from '@/components/features/reports/component-library'
import { ReportCanvas } from '@/components/features/reports/report-canvas'
import { ComponentProperties } from '@/components/features/reports/component-properties'
import { DataSourceManager } from '@/components/features/reports/data-source-manager'
import { ReportSettings } from '@/components/features/reports/report-settings'
import { ReportPreview } from '@/components/features/reports/report-preview'
import { REPORT_COMPONENTS } from '@/lib/reports/report-components'
import type { ReportConfig, ReportComponent, DataSource } from '@/types/reports.types'

// Mock the DnD Kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  useDroppable: () => ({ setNodeRef: jest.fn() }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
  closestCenter: jest.fn(),
}))

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: jest.fn((arr, from, to) => {
    const result = [...arr]
    const [removed] = result.splice(from, 1)
    result.splice(to, 0, removed)
    return result
  }),
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
}))

describe('ReportBuilder', () => {
  const mockOnSave = jest.fn()
  const defaultConfig: ReportConfig = {
    name: 'Test Report',
    layout: 'grid',
    components: [],
    dataSources: [],
    filters: [],
    style: {
      theme: 'light',
      spacing: 'normal'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the report builder with all sections', () => {
    render(<ReportBuilder initialConfig={defaultConfig} onSave={mockOnSave} />)
    
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Design' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Data Sources' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
  })

  it('allows editing the report name', async () => {
    const user = userEvent.setup()
    render(<ReportBuilder initialConfig={defaultConfig} onSave={mockOnSave} />)
    
    const nameInput = screen.getByPlaceholderText('Report Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Report Name')
    
    expect(nameInput).toHaveValue('New Report Name')
  })

  it('toggles between edit and preview mode', async () => {
    const user = userEvent.setup()
    render(<ReportBuilder initialConfig={defaultConfig} onSave={mockOnSave} />)
    
    const toggleButton = screen.getByText('Preview')
    await user.click(toggleButton)
    
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const user = userEvent.setup()
    render(<ReportBuilder initialConfig={defaultConfig} onSave={mockOnSave} />)
    
    const saveButton = screen.getByText('Save Report')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Report',
        layout: 'grid',
      }))
    })
  })
})

describe('ComponentLibrary', () => {
  it('renders all component categories', () => {
    render(<ComponentLibrary />)
    
    expect(screen.getByText('Visualizations')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('KPIs')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('renders all components from REPORT_COMPONENTS', () => {
    render(<ComponentLibrary />)
    
    REPORT_COMPONENTS.forEach(component => {
      expect(screen.getByText(component.name)).toBeInTheDocument()
    })
  })
})

describe('ReportCanvas', () => {
  const mockConfig: ReportConfig = {
    name: 'Test',
    layout: 'grid',
    components: [
      {
        id: 'comp-1',
        type: 'metric',
        config: { title: 'Test Metric' },
        position: { x: 0, y: 0 },
        size: { width: 4, height: 2 }
      }
    ],
    dataSources: [],
    filters: [],
    style: { theme: 'light', spacing: 'normal' }
  }

  const mockHandlers = {
    onSelectComponent: jest.fn(),
    onUpdateComponent: jest.fn(),
    onDeleteComponent: jest.fn()
  }

  it('renders empty state when no components', () => {
    const emptyConfig = { ...mockConfig, components: [] }
    render(
      <ReportCanvas 
        config={emptyConfig}
        selectedComponent={null}
        {...mockHandlers}
      />
    )
    
    expect(screen.getByText('Start building your report')).toBeInTheDocument()
  })

  it('renders components from config', () => {
    render(
      <ReportCanvas 
        config={mockConfig}
        selectedComponent={null}
        {...mockHandlers}
      />
    )
    
    expect(screen.getByText('Metric Card')).toBeInTheDocument()
  })

  it('selects component on click', async () => {
    const user = userEvent.setup()
    render(
      <ReportCanvas 
        config={mockConfig}
        selectedComponent={null}
        {...mockHandlers}
      />
    )
    
    const component = screen.getByText('Metric Card').closest('[class*="Card"]')
    await user.click(component!)
    
    expect(mockHandlers.onSelectComponent).toHaveBeenCalledWith('comp-1')
  })
})

describe('ComponentProperties', () => {
  const mockComponent: ReportComponent = {
    id: 'test-1',
    type: 'metric',
    config: {
      title: 'Test Metric',
      aggregation: 'sum',
      format: 'number'
    },
    position: { x: 0, y: 0 },
    size: { width: 4, height: 2 }
  }

  const mockOnChange = jest.fn()

  it('renders nothing when no component selected', () => {
    const { container } = render(
      <ComponentProperties component={undefined} onChange={mockOnChange} />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('renders component properties based on schema', () => {
    render(
      <ComponentProperties component={mockComponent} onChange={mockOnChange} />
    )
    
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Aggregation')).toBeInTheDocument()
    expect(screen.getByLabelText('Format')).toBeInTheDocument()
  })

  it('updates string properties', async () => {
    const user = userEvent.setup()
    render(
      <ComponentProperties component={mockComponent} onChange={mockOnChange} />
    )
    
    const titleInput = screen.getByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')
    
    expect(mockOnChange).toHaveBeenCalledWith({
      config: expect.objectContaining({
        title: 'New Title'
      })
    })
  })

  it('updates select properties', async () => {
    const user = userEvent.setup()
    render(
      <ComponentProperties component={mockComponent} onChange={mockOnChange} />
    )
    
    const formatSelect = screen.getByLabelText('Format')
    await user.click(formatSelect)
    await user.click(screen.getByText('currency'))
    
    expect(mockOnChange).toHaveBeenCalledWith({
      config: expect.objectContaining({
        format: 'currency'
      })
    })
  })
})

describe('DataSourceManager', () => {
  const mockDataSources: DataSource[] = [
    {
      id: 'ds-1',
      type: 'query',
      query: 'SELECT * FROM test'
    }
  ]

  const mockOnChange = jest.fn()

  it('renders empty state', () => {
    render(
      <DataSourceManager dataSources={[]} onChange={mockOnChange} />
    )
    
    expect(screen.getByText('No data sources configured')).toBeInTheDocument()
  })

  it('renders existing data sources', () => {
    render(
      <DataSourceManager dataSources={mockDataSources} onChange={mockOnChange} />
    )
    
    expect(screen.getByText('ds-1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SELECT * FROM test')).toBeInTheDocument()
  })

  it('adds new data source', async () => {
    const user = userEvent.setup()
    render(
      <DataSourceManager dataSources={[]} onChange={mockOnChange} />
    )
    
    const addButton = screen.getByText('Add Data Source')
    await user.click(addButton)
    
    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'query',
        query: ''
      })
    ])
  })

  it('updates data source query', async () => {
    const user = userEvent.setup()
    render(
      <DataSourceManager dataSources={mockDataSources} onChange={mockOnChange} />
    )
    
    const queryInput = screen.getByDisplayValue('SELECT * FROM test')
    await user.clear(queryInput)
    await user.type(queryInput, 'SELECT * FROM inventory')
    
    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'ds-1',
        query: 'SELECT * FROM inventory'
      })
    ])
  })

  it('deletes data source', async () => {
    const user = userEvent.setup()
    render(
      <DataSourceManager dataSources={mockDataSources} onChange={mockOnChange} />
    )
    
    const deleteButton = screen.getByRole('button', { name: '' })
    await user.click(deleteButton)
    
    expect(mockOnChange).toHaveBeenCalledWith([])
  })
})

describe('ReportSettings', () => {
  const mockConfig: ReportConfig = {
    name: 'Test Report',
    layout: 'grid',
    components: [],
    dataSources: [],
    filters: [],
    style: {
      theme: 'light',
      spacing: 'normal'
    }
  }

  const mockOnChange = jest.fn()

  it('renders all settings sections', () => {
    render(
      <ReportSettings config={mockConfig} onChange={mockOnChange} />
    )
    
    expect(screen.getByText('General Settings')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Report Filters')).toBeInTheDocument()
  })

  it('updates report name', async () => {
    const user = userEvent.setup()
    render(
      <ReportSettings config={mockConfig} onChange={mockOnChange} />
    )
    
    const nameInput = screen.getByLabelText('Report Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Report')
    
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Report'
      })
    )
  })

  it('updates layout type', async () => {
    const user = userEvent.setup()
    render(
      <ReportSettings config={mockConfig} onChange={mockOnChange} />
    )
    
    const layoutSelect = screen.getByLabelText('Layout')
    await user.click(layoutSelect)
    await user.click(screen.getByText('Flexible Layout'))
    
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: 'flex'
      })
    )
  })

  it('updates theme', async () => {
    const user = userEvent.setup()
    render(
      <ReportSettings config={mockConfig} onChange={mockOnChange} />
    )
    
    const themeSelect = screen.getByLabelText('Theme')
    await user.click(themeSelect)
    await user.click(screen.getByText('Dark'))
    
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          theme: 'dark'
        })
      })
    )
  })
})

describe('ReportPreview', () => {
  const mockConfig: ReportConfig = {
    name: 'Test Report',
    layout: 'grid',
    components: [
      {
        id: 'text-1',
        type: 'text',
        config: {
          content: '<h1>Test Report</h1>',
          alignment: 'center'
        },
        position: { x: 0, y: 0 },
        size: { width: 12, height: 1 }
      }
    ],
    dataSources: [],
    filters: [],
    style: {
      theme: 'light',
      spacing: 'normal'
    }
  }

  it('renders loading state initially', () => {
    render(<ReportPreview config={mockConfig} />)
    
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('renders components after loading', async () => {
    render(<ReportPreview config={mockConfig} />)
    
    await waitFor(() => {
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    })
  })

  it('applies theme and spacing styles', async () => {
    const darkConfig = {
      ...mockConfig,
      style: { theme: 'dark' as const, spacing: 'compact' as const }
    }
    
    const { container } = render(<ReportPreview config={darkConfig} />)
    
    await waitFor(() => {
      const previewDiv = container.firstChild as HTMLElement
      expect(previewDiv.classList.contains('dark')).toBe(true)
      expect(previewDiv.classList.contains('space-y-2')).toBe(true)
    })
  })
})