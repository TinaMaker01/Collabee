import { useFormContext } from 'react-hook-form'
import type { FieldValues, Path } from 'react-hook-form'
import type { ReactNode } from 'react'

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  children?: ReactNode
}

export default function FormField<T extends FieldValues>({
  name,
  label,
  type = 'text',
  placeholder,
  required,
  children,
}: FormFieldProps<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>()
  const error = errors[name]?.message as string | undefined

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children ?? (
        <input
          id={name}
          type={type}
          placeholder={placeholder}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          {...register(name)}
        />
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-sm text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
