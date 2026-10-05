import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { get, put, post, del } from '../api/client'
import DataTable from '../components/DataTable'
import FormField from '../components/FormField'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdminIcon, PlusIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface AdminUser {
  id: number
  name: string
  email: string
  role: 'user' | 'manager' | 'admin'
  createdAt: string | null
  updatedAt: string | null
}

const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.string(),
})

type FormData = z.infer<typeof formSchema>

export default function Admin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => get<AdminUser[]>('/admin/users'),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/admin/users', {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('common.save_success'))
      handleClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/admin/users/${editingUser?.id ?? 0}`, {
        name: data.name,
        email: data.email,
        role: data.role,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('common.save_success'))
      handleClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/admin/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('common.delete_success'))
      setDeletingUser(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function openAddModal() {
    setEditingUser(null)
    form.reset({ name: '', email: '', password: '', role: 'user' })
    setIsModalOpen(true)
  }

  function openEditModal(item: AdminUser) {
    setEditingUser(item)
    form.reset({ name: item.name, email: item.email, password: '', role: item.role })
    setIsModalOpen(true)
  }

  function handleClose() {
    setIsModalOpen(false)
    setEditingUser(null)
  }

  function onSubmit(data: FormData) {
    if (editingUser) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('auth.name') },
    { key: 'email', label: t('auth.email') },
    {
      key: 'role',
      label: t('admin.role'),
      render: (item: AdminUser) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.role === 'admin'
              ? 'bg-purple-100 text-purple-700'
              : item.role === 'manager'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {t(`admin.role_${item.role}`)}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <AdminIcon className="w-6 h-6 text-amber-500" />
          {t('page.admin')}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openAddModal}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 inline-flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            {t('admin.add_user')}
          </button>
          <button
            onClick={() =>
              exportCsv(data ?? [], 'admin-users', {
                id: 'ID',
                name: t('auth.name'),
                email: t('auth.email'),
                role: t('admin.role'),
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
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 dark:text-gray-200"
        role="region"
        aria-label={t('page.admin')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={openEditModal}
          onDelete={(item) => setDeletingUser(item)}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.admin')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingUser ? t('admin.edit_user') : t('admin.add_user')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" label={t('auth.name')} required />
            <FormField name="email" label={t('auth.email')} type="email" required />
            {!editingUser && <FormField name="password" label={t('auth.password')} type="password" required />}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.role')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('role')}
              >
                <option value="user">{t('admin.role_user')}</option>
                <option value="manager">{t('admin.role_manager')}</option>
                <option value="admin">{t('admin.role_admin')}</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-400"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500"
              >
                {createMutation.isPending || updateMutation.isPending ? t('common.loading') : t('action.save')}
              </button>
            </div>
          </form>
        </FormProvider>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
        title={t('admin.delete_user')}
        message={t('admin.confirm_delete', { name: deletingUser?.name ?? '' })}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
