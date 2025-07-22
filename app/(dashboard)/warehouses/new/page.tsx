import { WarehouseForm } from '@/components/features/warehouses/warehouse-form'

export default function NewWarehousePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add Warehouse</h1>
        <p className="text-muted-foreground">
          Create a new warehouse location for inventory storage
        </p>
      </div>

      <WarehouseForm />
    </div>
  )
}
