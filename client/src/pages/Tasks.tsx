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
import { TasksIcon, PlusIcon, CheckIcon, XIcon, ClockIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface Task {
  id: number
  title: string
  description: string | null
  assignedTo: number | null
  departmentId: number | null
  status: string
  priority: string
  dueDate: string | null
}

interface Employee {
  id: number
  name: string
}

interface Department {
  id: number
  name: string
}

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const formSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function Tasks() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Task | null>(null)
  const [deletingItem, setDeletingItem] = useState<Task | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['tasks'], queryFn: () => get<Task[]>('/tasks') })
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => get<Department[]>('/departments'),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedTo: '',
      departmentId: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/tasks', {
        title: data.title,
        description: data.description || undefined,
        assignedTo: data.assignedTo ? parseInt(data.assignedTo, 10) : undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        status: data.status || undefined,
        priority: data.priority || undefined,
        dueDate: data.dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/tasks/${editingItem?.id ?? 0}`, {
        title: data.title,
        description: data.description || undefined,
        assignedTo: data.assignedTo ? parseInt(data.assignedTo, 10) : undefined,
        departmentId: data.departmentId ? parseInt(data.departmentId, 10) : undefined,
        status: data.status || undefined,
        priority: data.priority || undefined,
        dueDate: data.dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/tasks/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    form.reset({
      title: '',
      description: '',
      assignedTo: '',
      departmentId: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
    })
    setIsModalOpen(true)
  }

  function openEditModal(item: Task) {
    setEditingItem(item)
    form.reset({
      title: item.title,
      description: item.description ?? '',
      assignedTo: item.assignedTo?.toString() ?? '',
      departmentId: item.departmentId?.toString() ?? '',
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
    })
    setIsModalOpen(true)
  }

  function openDeleteModal(item: Task) {
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
    { key: 'title', label: t('task.title') },
    { key: 'description', label: t('task.description') },
    {
      key: 'status',
      label: t('task.status'),
      render: (item: Task) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusColors[item.status] || ''}`}
        >
          {item.status === 'done' ? (
            <CheckIcon className="w-3 h-3" />
          ) : item.status === 'blocked' ? (
            <XIcon className="w-3 h-3" />
          ) : item.status === 'in_progress' ? (
            <ClockIcon className="w-3 h-3" />
          ) : null}
          {t(`status.${item.status}`)}
        </span>
      ),
    },
    {
      key: 'priority',
      label: t('task.priority'),
      render: (item: Task) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${priorityColors[item.priority] || ''}`}
        >
          {t(`status.${item.priority}`)}
        </span>
      ),
    },
    {
      key: 'assignedTo',
      label: t('task.assigned_to') || 'Assignee',
      render: (item: Task) => {
        if (!item.assignedTo) return '-'
        const emp = employees?.find((e) => e.id === item.assignedTo)
        return emp ? emp.name : `#${item.assignedTo}`
      },
    },
    {
      key: 'departmentId',
      label: t('task.department') || 'Department',
      render: (item: Task) => {
        if (!item.departmentId) return '-'
        const dept = departments?.find((d) => d.id === item.departmentId)
        return dept ? dept.name : `#${item.departmentId}`
      },
    },
    {
      key: 'dueDate',
      label: t('task.due_date'),
      render: (item: Task) => (item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <TasksIcon className="w-6 h-6 text-amber-500" />
          {t('page.tasks')}
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
              exportCsv(data ?? [], 'tasks', {
                title: t('task.title'),
                description: t('task.description'),
                status: t('task.status'),
                priority: t('task.priority'),
                dueDate: t('task.due_date'),
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
        aria-label={t('page.tasks')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.tasks')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('action.edit') : t('action.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="title" label={t('task.title')} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.description')}
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
                {...form.register('description')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.assigned_to')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('assignedTo')}
              >
                <option value="">{t('common.select_option')}</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.department')}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.status')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('status')}
              >
                <option value="todo">{t('status.todo')}</option>
                <option value="in_progress">{t('status.in_progress')}</option>
                <option value="done">{t('status.done')}</option>
                <option value="blocked">{t('status.blocked')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.priority')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('priority')}
              >
                <option value="low">{t('status.low')}</option>
                <option value="medium">{t('status.medium')}</option>
                <option value="high">{t('status.high')}</option>
                <option value="urgent">{t('status.urgent')}</option>
              </select>
            </div>
            <FormField name="dueDate" label={t('task.due_date')} type="date" />
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
