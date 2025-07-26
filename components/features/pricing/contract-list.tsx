'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Calendar,
  Clock,
  Edit,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Trash,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { format } from 'date-fns'
import { ContractDialog } from '@/components/features/pricing/contract-dialog'
import { formatCurrency } from '@/lib/utils'
import {
  ContractWithItems,
  getContractStatusColor,
  isContractExpiring,
} from '@/types/customer-pricing.types'
import { CustomerRecord } from '@/types/customer.types'
import { cancelContract, renewContract } from '@/app/actions/customer-pricing'

interface ContractListProps {
  customerId: string
  contracts: ContractWithItems[]
  customer: CustomerRecord
}

export function ContractList({ customerId, contracts, customer }: ContractListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleCancel = async (contractId: string) => {
    if (!confirm('Are you sure you want to cancel this contract?')) return

    setLoading(contractId)
    try {
      const formData = new FormData()
      formData.append('id', contractId)
      
      await cancelContract(formData)
      toast.success('Contract cancelled successfully')
      router.refresh()
    } catch (error) {
      toast.error('Failed to cancel contract')
    } finally {
      setLoading(null)
    }
  }

  const handleRenew = async (contractId: string, monthsToAdd: number) => {
    setLoading(contractId)
    try {
      const formData = new FormData()
      formData.append('id', contractId)
      formData.append('months_to_add', monthsToAdd.toString())
      
      await renewContract(formData)
      toast.success('Contract renewed successfully')
      router.refresh()
    } catch (error) {
      toast.error('Failed to renew contract')
    } finally {
      setLoading(null)
    }
  }

  const getContractValue = (contract: ContractWithItems): number => {
    if (!contract.contract_items) return 0
    return contract.contract_items.reduce((sum, item) => {
      return sum + (item.contract_price || 0)
    }, 0)
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No contracts found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first pricing contract for this customer
        </p>
        <ContractDialog customerId={customerId}>
          <Button>Create Contract</Button>
        </ContractDialog>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contract Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => {
            const isExpiring = contract.status === 'active' && 
              isContractExpiring(contract.end_date, contract.expiry_notification_days)

            return (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">
                  {contract.contract_number}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{contract.contract_name}</p>
                    {contract.description && (
                      <p className="text-sm text-muted-foreground">
                        {contract.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">
                        {(() => {
                          try {
                            const date = new Date(contract.start_date)
                            return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM d, yyyy')
                          } catch {
                            return 'Invalid date'
                          }
                        })()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        to {(() => {
                          try {
                            const date = new Date(contract.end_date)
                            return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM d, yyyy')
                          } catch {
                            return 'Invalid date'
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Badge
                      variant="outline"
                      className={getContractStatusColor(contract.status)}
                    >
                      {contract.status}
                    </Badge>
                    {isExpiring && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Expiring soon
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {contract.auto_renew && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Auto-renewal enabled
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {contract.contract_items?.length || 0}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(getContractValue(contract))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === contract.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ContractDialog 
                        customerId={customerId} 
                        contract={contract}
                      >
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Contract
                        </DropdownMenuItem>
                      </ContractDialog>
                      
                      {contract.document_url && (
                        <DropdownMenuItem 
                          onClick={() => window.open(contract.document_url!, '_blank')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Document
                        </DropdownMenuItem>
                      )}
                      
                      {contract.status === 'active' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRenew(
                              contract.id, 
                              contract.renewal_period_months || 12
                            )}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Renew Contract
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {contract.status !== 'cancelled' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleCancel(contract.id)}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Cancel Contract
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}