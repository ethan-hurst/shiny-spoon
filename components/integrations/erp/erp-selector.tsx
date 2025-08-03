'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { ERPType, ERP_METADATA } from '@/lib/integrations/erp/types'
import Image from 'next/image'

interface ERPSelectorProps {
  selectedERP?: ERPType
  onSelectERP: (erp: ERPType) => void
}

const erpLogos: Record<ERPType, string> = {
  SAP: '/images/erp/sap-logo.svg',
  NETSUITE: '/images/erp/netsuite-logo.svg',
  DYNAMICS365: '/images/erp/dynamics365-logo.svg',
  ORACLE_CLOUD: '/images/erp/oracle-logo.svg',
  INFOR: '/images/erp/infor-logo.svg',
  EPICOR: '/images/erp/epicor-logo.svg',
  SAGE: '/images/erp/sage-logo.svg',
}

export function ERPSelector({ selectedERP, onSelectERP }: ERPSelectorProps) {
  const erpSystems = Object.entries(ERP_METADATA).map(([type, metadata]) => ({
    type: type as ERPType,
    ...metadata,
    logo: erpLogos[type as ERPType],
  }))

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Choose Your ERP System</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select the ERP platform you want to integrate with
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {erpSystems.map((erp) => {
          const isSelected = selectedERP === erp.type
          
          return (
            <Card
              key={erp.type}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelectERP(erp.type)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {erp.logo && (
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        <Image
                          src={erp.logo}
                          alt={erp.name}
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{erp.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {erp.type}
                      </CardDescription>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Supported Features
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {erp.features.slice(0, 4).map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {erp.features.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{erp.features.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {erp.requiredFields.length} required fields
                    </span>
                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectERP(erp.type)
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Make sure you have the necessary credentials and permissions 
          to access your ERP system's API before proceeding.
        </p>
      </div>
    </div>
  )
}