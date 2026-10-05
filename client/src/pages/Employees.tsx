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
import { BriefcaseIcon, PlusIcon, CheckIcon, XIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface Employee {
  id: number
  name: string
  email: string
  position: string | null
  phone: string | null
  departmentId: number | null
  hireDate: string | null
  salary: string | null
  status: string | null
}

interface Department {
  id: number
  name: string
}

const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  position: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional(),
  salary: z.string().optional(),
  status: z.string().optional(),
})

// Convert salary from string (form) to number (API expects cents) or undefined
function parseSalary(salary: string | undefined): number | undefined {
  if (!salary) return undefined
  const n = Number(salary)
  return Number.isNaN(n) ? undefined : n
}

type FormData = z.infer<typeof formSchema>

export default function Employees() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Employee | null>(null)
  const [deletingItem, setDeletingItem] = useState<Employee | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => get<Department[]>('/departments'),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      position: '',
      phone: '',
      departmentId: '',
      hireDate: '',
      salary: '',
      status: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/employees', {
        name: data.name,
        email: data.email,
        position: data.position || undefined,
        phone: data.phone || undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        hireDate: data.hireDate || undefined,
        salary: parseSalary(data.salary),
        status: data.status || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/employees/${editingItem?.id ?? 0}`, {
        name: data.name,
        email: data.email,
        position: data.position || undefined,
        phone: data.phone || undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        hireDate: data.hireDate || undefined,
        salary: parseSalary(data.salary),
        status: data.status || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/employees/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    form.reset({ name: '', email: '', position: '', phone: '', departmentId: '', hireDate: '', salary: '', status: '' })
    setIsModalOpen(true)
  }

  function openEditModal(item: Employee) {
    setEditingItem(item)
    form.reset({
      name: item.name,
      email: item.email,
      position: item.position ?? '',
      phone: item.phone ?? '',
      departmentId: item.departmentId?.toString() ?? '',
      hireDate: item.hireDate ? item.hireDate.slice(0, 10) : '',
      salary: item.salary ?? '',
      status: item.status ?? '',
    })
    setIsModalOpen(true)
  }

  function openDeleteModal(item: Employee) {
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
    { key: 'name', label: t('employee.name') },
    { key: 'email', label: t('employee.email') },
    { key: 'position', label: t('employee.position') },
    {
      key: 'status',
      label: t('employee.status'),
      render: (item: Employee) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {item.status === 'active' ? <CheckIcon className="w-3 h-3" /> : <XIcon className="w-3 h-3" />}
          {item.status || t('status.active')}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BriefcaseIcon className="w-6 h-6 text-amber-500" />
          {t('page.employees')}
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
              exportCsv(data ?? [], 'employees', {
                name: t('employee.name'),
                email: t('employee.email'),
                position: t('employee.position'),
                salary: t('employee.salary'),
                status: t('employee.status'),
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
        aria-label={t('page.employees')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.employees')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('action.edit') : t('action.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" label={t('employee.name')} required />
            <FormField name="email" label={t('employee.email')} type="email" required />
            <FormField name="position" label={t('employee.position')} />
            <FormField name="phone" label={t('employee.phone')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employee.department')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('departmentId')}
              >
                <option value="">{t('common.select_option')}</option>
                {departments?.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <FormField name="hireDate" label={t('employee.hire_date')} type="date" />
            <FormField name="salary" label={t('employee.salary')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employee.status')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('status')}
              >
                <option value="">{t('common.select_option')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
              </select>
            </div>
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
