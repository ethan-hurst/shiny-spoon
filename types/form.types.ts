import { FieldError, Path, UseFormRegister } from 'react-hook-form'

export interface FormFieldProps<TFieldValues> {
  name: Path<TFieldValues>
  register: UseFormRegister<TFieldValues>
  error?: FieldError
  label: string
  required?: boolean
}

export interface FormState<T> {
  data: T
  errors: Record<string, string>
  isSubmitting: boolean
  isValid: boolean
}