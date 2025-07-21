'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Code, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Search,
  ExternalLink,
  GitBranch,
  Package
} from 'lucide-react'
import { prpData } from './prp-data'

export function PRPStatusDashboard() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhase, setSelectedPhase] = useState<string>('all')

  // Calculate statistics
  const totalPRPs = prpData.reduce((sum, phase) => sum + phase.prps.length, 0)
  const implementedPRPs = prpData.reduce((sum, phase) => 
    sum + phase.prps.filter(prp => prp.status === 'implemented').length, 0
  )
  const partialPRPs = prpData.reduce((sum, phase) => 
    sum + phase.prps.filter(prp => prp.status === 'partial').length, 0
  )
  const documentedPRPs = prpData.reduce((sum, phase) => 
    sum + phase.prps.filter(prp => prp.status === 'documented').length, 0
  )
  const plannedPRPs = prpData.reduce((sum, phase) => 
    sum + phase.prps.filter(prp => prp.status === 'planned').length, 0
  )

  const implementationProgress = (implementedPRPs / totalPRPs) * 100
  const documentationProgress = ((implementedPRPs + partialPRPs + documentedPRPs) / totalPRPs) * 100

  // Filter PRPs
  const filteredPhases = prpData
    .filter(phase => selectedPhase === 'all' || phase.id === selectedPhase)
    .map(phase => ({
      ...phase,
      prps: phase.prps.filter(prp => 
        searchTerm === '' || 
        prp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prp.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
    .filter(phase => phase.prps.length > 0)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'documented':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'planned':
        return <AlertCircle className="h-4 w-4 text-gray-400" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      implemented: 'default',
      partial: 'outline',
      documented: 'secondary',
      planned: 'outline'
    }
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">PRP Implementation Status</h1>
        <p className="text-muted-foreground mt-2">
          Track the status of all Project Requirement Plans
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total PRPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPRPs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Implemented
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{implementedPRPs}</div>
            <Progress value={implementationProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documented
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {documentedPRPs + partialPRPs}
            </div>
            <Progress value={documentationProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{plannedPRPs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search PRPs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={selectedPhase} onValueChange={setSelectedPhase} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All Phases</TabsTrigger>
            {prpData.map(phase => (
              <TabsTrigger key={phase.id} value={phase.id}>
                {phase.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* PRP List */}
      <div className="space-y-6">
        {filteredPhases.map(phase => (
          <Card key={phase.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{phase.name}</CardTitle>
                  <CardDescription>{phase.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{phase.prps.filter(p => p.status === 'implemented').length}</span>
                  <span>/</span>
                  <span>{phase.prps.length}</span>
                  <span>implemented</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {phase.prps.map(prp => (
                  <div
                    key={prp.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(prp.status)}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{prp.id}: {prp.title}</h4>
                          {getStatusBadge(prp.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {prp.description}
                        </p>
                        
                        {/* Implementation Details */}
                        {prp.implementedFiles && prp.implementedFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">
                              Implemented in:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {prp.implementedFiles.slice(0, 3).map((file, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Code className="mr-1 h-3 w-3" />
                                  {file}
                                </Badge>
                              ))}
                              {prp.implementedFiles.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{prp.implementedFiles.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Missing Items for Partial Implementation */}
                        {prp.status === 'partial' && prp.missingFeatures && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-yellow-600">
                              Missing features:
                            </div>
                            <ul className="text-xs text-muted-foreground mt-1">
                              {prp.missingFeatures.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span>•</span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {prp.documentPath && (
                        <a
                          href={`/PRPs/${prp.documentPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      )}
                      {prp.status === 'documented' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Navigate to implementation guide
                            window.location.href = `/implementation/${prp.id}`
                          }}
                        >
                          <GitBranch className="mr-2 h-4 w-4" />
                          Implement
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Implementation Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Priorities</CardTitle>
          <CardDescription>
            Recommended order for implementing remaining PRPs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Priority 1: Complete Phase 3 (Business Logic)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• PRP-009: Customer Management - Foundation for B2B features</li>
                <li>• PRP-010: Pricing Rules Engine - Critical for accurate pricing</li>
                <li>• PRP-011: Sync Status Dashboard - Visibility into sync health</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Priority 2: Phase 4 (Integration Layer)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• PRP-012: Integration Framework - Base for all connectors</li>
                <li>• PRP-013: NetSuite Connector - Primary ERP integration</li>
                <li>• PRP-014: Shopify B2B - E-commerce platform sync</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Priority 3: Complete PRP-017 (Bulk Operations)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Add streaming processor for large files</li>
                <li>• Implement progress tracking with SSE</li>
                <li>• Add rollback functionality</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}