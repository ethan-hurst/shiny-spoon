// components/features/reports/report-templates.tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, FileText, Package, Users, TrendingUp, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { saveReport } from '@/app/actions/reports'
import type { ReportTemplate } from '@/types/reports.types'

interface ReportTemplatesProps {
  templates: ReportTemplate[]
}

const categoryIcons = {
  inventory: Package,
  orders: FileText,
  customers: Users,
  performance: TrendingUp,
  custom: BarChart3,
}

const categoryColors = {
  inventory: 'bg-blue-100 text-blue-800',
  orders: 'bg-green-100 text-green-800',
  customers: 'bg-purple-100 text-purple-800',
  performance: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-800',
}

export function ReportTemplates({ templates }: ReportTemplatesProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all')
  const [isCreating, setIsCreating] = React.useState<string | null>(null)

  const categories = Array.from(new Set(templates.map(t => t.category)))

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleCreateFromTemplate = async (template: ReportTemplate) => {
    setIsCreating(template.id)
    try {
      const result = await saveReport({
        ...template.config,
        name: `${template.name} (Copy)`,
      })
      
      if (result.success) {
        toast.success('Report created from template')
        router.push(`/reports/${result.reportId}`)
      } else {
        toast.error(result.error || 'Failed to create report')
      }
    } catch (error) {
      toast.error('Failed to create report')
    } finally {
      setIsCreating(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const Icon = categoryIcons[template.category as keyof typeof categoryIcons] || BarChart3
          const isLoading = isCreating === template.id
          
          return (
            <Card key={template.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={categoryColors[template.category as keyof typeof categoryColors]}
                  >
                    {template.category}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <CardDescription>
                  {template.description}
                </CardDescription>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {template.config.components?.length || 0} components
                  </span>
                  {template.is_system && (
                    <Badge variant="outline" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => handleCreateFromTemplate(template)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Use Template
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm || selectedCategory !== 'all' 
              ? 'No templates match your filters'
              : 'No templates available'
            }
          </div>
        </div>
      )}
    </div>
  )
}