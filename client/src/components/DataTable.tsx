import { useTranslation } from 'react-i18next'
import LoadingSpinner from './LoadingSpinner'
import { EditIcon, TrashIcon, InfoIcon } from './icons'

interface Column<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  keyExtractor: (item: T) => string | number
  ariaLabel?: string
}

export default function DataTable<T>({
  columns,
  data,
  isLoading,
  onEdit,
  onDelete,
  keyExtractor,
  ariaLabel,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  if (isLoading) return <LoadingSpinner />

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-gray-400 dark:text-gray-500" role="status">
        <InfoIcon className="w-12 h-12 mb-3" />
        <p className="text-gray-500 dark:text-gray-300">{t('common.no_data')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto" role="region" aria-label={ariaLabel}>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th scope="col" className="px-4 py-3 font-medium">
                {t('common.actions')}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="dark:text-gray-200">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render
                    ? col.render(item)
                    : (() => {
                        const val = (item as Record<string, unknown>)[col.key]
                        if (typeof val === 'string') return val
                        if (val == null) return ''
                        return JSON.stringify(val)
                      })()}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 flex gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="text-amber-600 hover:text-amber-800 p-1 focus:ring-2 focus:ring-amber-500 rounded"
                      aria-label={t('action.edit')}
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(item)}
                      className="text-red-600 hover:text-red-800 p-1 focus:ring-2 focus:ring-red-400 rounded"
                      aria-label={t('action.delete')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
