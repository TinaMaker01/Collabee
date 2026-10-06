import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { get, post, put, del } from '../api/client'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/DataTable'
import FormField from '../components/FormField'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTranslation } from 'react-i18next'
import { DocumentIcon, PlusIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface Document {
  id: number
  employeeId: number
  title: string
  url: string
  type: string | null
  createdAt: string
}

interface Employee {
  id: number
  name: string
}

const formSchema = z.object({
  employeeId: z.string().min(1),
  title: z.string().min(1),
  type: z.string().optional(),
  url: z
    .string()
    .min(1)
    .refine((val) => val.startsWith('https://') || val.startsWith('/api/documents/file/'), {
      message: 'URL must use secure HTTPS protocol or be an uploaded document',
    }),
})

type FormData = z.infer<typeof formSchema>

export default function Documents() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Document | null>(null)
  const [deletingItem, setDeletingItem] = useState<Document | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['documents'], queryFn: () => get<Document[]>('/documents') })
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { employeeId: '', title: '', type: '', url: '' },
  })

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fd = new window.FormData()
      fd.append('file', file)
      const res = await post<{ url: string; filename: string }>('/documents/upload', fd)
      form.setValue('url', res.url, { shouldValidate: true })
      if (!form.getValues('title')) {
        form.setValue('title', file.name.replace(/\.[^/.]+$/, ''))
      }
      toast.success('File uploaded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/documents', {
        employeeId: parseInt(data.employeeId, 10),
        title: data.title,
        type: data.type || undefined,
        url: data.url,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/documents/${editingItem?.id ?? 0}`, {
        employeeId: parseInt(data.employeeId, 10),
        title: data.title,
        type: data.type || undefined,
        url: data.url,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/documents/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    form.reset({ employeeId: '', title: '', type: '', url: '' })
    setIsModalOpen(true)
  }

  function openEditModal(item: Document) {
    setEditingItem(item)
    form.reset({
      employeeId: item.employeeId.toString(),
      title: item.title,
      type: item.type ?? '',
      url: item.url,
    })
    setIsModalOpen(true)
  }

  function openDeleteModal(item: Document) {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  function handleClose() {
    setIsModalOpen(false)
    setEditingItem(null)
  }

  function onSubmit(data: FormData) {
    try {
      if (editingItem) {
        updateMutation.mutate(data)
      } else {
        createMutation.mutate(data)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  function handleDelete() {
    if (!deletingItem) return
    deleteMutation.mutate(deletingItem.id, {
      onSettled: () => {
        setIsDeleteOpen(false)
        setDeletingItem(null)
      },
    })
  }

  function getEmployeeName(employeeId: number): string {
    const emp = employees?.find((e) => e.id === employeeId)
    return emp?.name ?? `#${employeeId}`
  }

  const columns = [
    { key: 'title', label: t('document.title') },
    { key: 'type', label: t('document.type') },
    {
      key: 'employeeId',
      label: t('document.employee'),
      render: (item: Document) => getEmployeeName(item.employeeId),
    },
    {
      key: 'url',
      label: 'Document',
      render: (item: Document) => (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 underline text-sm font-medium"
        >
          {t('common.view') || 'View'}
        </a>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <DocumentIcon className="w-6 h-6 text-amber-500" />
          {t('page.documents')}
        </h1>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={openAddModal}
              aria-label={t('document.add')}
              className="w-full sm:w-auto bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 inline-flex items-center"
            >
              <PlusIcon className="inline-block w-4 h-4 mr-1.5" />
              {t('document.add')}
            </button>
          )}
          <button
            onClick={() =>
              exportCsv(data ?? [], 'documents', {
                title: t('document.title'),
                type: t('document.type'),
                employeeId: t('document.employee'),
              })
            }
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <DownloadIcon className="w-4 h-4 mr-1.5" />
            CSV
          </button>
        </div>
      </div>
      <div
        className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        role="region"
        aria-label={t('page.documents')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.documents')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('document.edit') : t('document.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('document.employee')} *
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('employeeId')}
              >
                <option value="">{t('common.select_option')}</option>
                {employees?.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <FormField name="title" label={t('document.title')} required />
            <FormField name="type" label={t('document.type')} />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload File (PDF, Image, Office Doc)
              </label>
              <input
                type="file"
                onChange={(e) => {
                  void handleFileUpload(e)
                }}
                disabled={isUploading}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900/40 dark:file:text-amber-300 border border-gray-300 dark:border-gray-600 rounded-lg p-1.5"
              />
              {isUploading && <p className="text-xs text-amber-600 mt-1">Uploading file...</p>}
            </div>

            <FormField name="url" label="Document URL or Path" required />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-400"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t('common.loading')
                  : editingItem
                    ? t('action.edit')
                    : t('action.add')}
              </button>
            </div>
          </form>
        </FormProvider>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false)
          setDeletingItem(null)
        }}
        onConfirm={handleDelete}
        title={t('document.delete')}
        message={t('document.confirm_delete')}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
