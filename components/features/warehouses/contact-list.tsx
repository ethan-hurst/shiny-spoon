'use client'

import { Plus, Trash2, User } from 'lucide-react'
import { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ContactListProps {
  fields: UseFieldArrayReturn['fields']
  append: UseFieldArrayReturn['append']
  remove: UseFieldArrayReturn['remove']
  form: UseFormReturn<any>
}

const CONTACT_ROLES = [
  'Manager',
  'Supervisor',
  'Warehouse Coordinator',
  'Shipping Manager',
  'Receiving Manager',
  'Operations Manager',
  'Other',
]

export function ContactList({
  fields,
  append,
  remove,
  form,
}: ContactListProps) {
  const addContact = () => {
    append({
      name: '',
      role: 'Manager',
      email: '',
      phone: '',
      isPrimary: fields.length === 0,
    })
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <Card key={field.id} className="p-4">
          <div className="flex items-start gap-4">
            <User className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex-1 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`contacts.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`contacts.${index}.role`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTACT_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`contacts.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="john@example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`contacts.${index}.phone`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 (555) 123-4567" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name={`contacts.${index}.isPrimary`}
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Primary Contact</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          // Set all contacts to non-primary
                          fields.forEach((_, i) => {
                            form.setValue(`contacts.${i}.isPrimary`, false)
                          })
                          // Set this contact as primary
                          field.onChange(value === 'true')
                        }}
                        value={field.value ? 'true' : 'false'}
                        className="flex items-center gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="true"
                            id={`primary-${index}`}
                          />
                          <label
                            htmlFor={`primary-${index}`}
                            className="text-sm"
                          >
                            Yes, this is the primary contact
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addContact}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Contact
      </Button>
    </div>
  )
}
