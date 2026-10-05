import Modal from './Modal'
import { useTranslation } from 'react-i18next'
import { AlertIcon } from './icons'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  isLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  isLoading,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex items-start gap-3 mb-6">
        <AlertIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-gray-600 dark:text-gray-300">{message}</p>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-400"
        >
          {t('action.cancel')}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 focus:ring-2 focus:ring-red-500"
        >
          {isLoading ? t('common.loading') : confirmLabel || t('action.delete')}
        </button>
      </div>
    </Modal>
  )
}
