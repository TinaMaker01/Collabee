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
import { DepartmentsIcon, PlusIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface Department {
  id: number
  name: string
  description: string | null
  managerId: number | null
}

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function Departments() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Department | null>(null)
  const [deletingItem, setDeletingItem] = useState<Department | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['departments'], queryFn: () => get<Department[]>('/departments') })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '', managerId: '' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/departments', {
        name: data.name,
        description: data.description || undefined,
        managerId: data.managerId ? parseInt(data.managerId, 10) : undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/departments/${editingItem?.id ?? 0}`, {
        name: data.name,
        description: data.description || undefined,
        managerId: data.managerId ? parseInt(data.managerId, 10) : undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/departments/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    form.reset({ name: '', description: '', managerId: '' })
    setIsModalOpen(true)
  }

  function openEditModal(item: Department) {
    setEditingItem(item)
    form.reset({
      name: item.name,
      description: item.description ?? '',
      managerId: item.managerId?.toString() ?? '',
    })
    setIsModalOpen(true)
  }

  function openDeleteModal(item: Department) {
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

  const columns = [
    { key: 'name', label: t('department.name') },
    { key: 'description', label: t('department.description') },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <DepartmentsIcon className="w-6 h-6 text-amber-500" />
          {t('page.departments')}
        </h1>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={openAddModal}
              aria-label={t('action.add')}
              className="w-full sm:w-auto bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 inline-flex items-center"
            >
              <PlusIcon className="inline-block w-4 h-4 mr-1.5" />
              {t('action.add')}
            </button>
          )}
          <button
            onClick={() =>
              exportCsv(data ?? [], 'departments', {
                name: t('department.name'),
                description: t('department.description'),
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
        aria-label={t('page.departments')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.departments')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('action.edit') : t('action.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" label={t('department.name')} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('department.description')}
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
                {...form.register('description')}
              />
            </div>
            <FormField name="managerId" label={t('department.manager')} type="number" />
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
        title={t('action.delete')}
        message={t('common.confirm_delete')}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
