'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerWithStats, ContactRecord, CustomerActivity } from '@/types/customer.types'
import { useCustomerDetailRealtime } from '@/hooks/use-customer-realtime'
import { CustomerOverview } from '@/components/features/customers/tabs/customer-overview'
import { CustomerContacts } from '@/components/features/customers/tabs/customer-contacts'
import { CustomerActivityTimeline } from '@/components/features/customers/tabs/customer-activity-timeline'
import { CustomerOrders } from '@/components/features/customers/tabs/customer-orders'
import { FileText, Users, Activity, Package } from 'lucide-react'

interface CustomerTabsProps {
  customer: CustomerWithStats
  contacts: ContactRecord[]
  activities: CustomerActivity[]
}

export function CustomerTabs({ customer, contacts, activities }: CustomerTabsProps) {
  // Enable real-time updates for this customer
  useCustomerDetailRealtime(customer.id, customer.organization_id)
  
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">
          <FileText className="mr-2 h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="contacts">
          <Users className="mr-2 h-4 w-4" />
          Contacts ({contacts.length})
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Activity className="mr-2 h-4 w-4" />
          Activity
        </TabsTrigger>
        <TabsTrigger value="orders">
          <Package className="mr-2 h-4 w-4" />
          Orders
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <CustomerOverview customer={customer} />
      </TabsContent>

      <TabsContent value="contacts" className="space-y-4">
        <CustomerContacts 
          customerId={customer.id} 
          contacts={contacts} 
        />
      </TabsContent>

      <TabsContent value="activity" className="space-y-4">
        <CustomerActivityTimeline 
          customerId={customer.id}
          activities={activities} 
        />
      </TabsContent>

      <TabsContent value="orders" className="space-y-4">
        <CustomerOrders customerId={customer.id} />
      </TabsContent>
    </Tabs>
  )
}