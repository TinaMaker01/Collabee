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
import { LeaveIcon, PlusIcon, CheckIcon, XIcon, ClockIcon, DownloadIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface LeaveRequest {
  id: number
  employeeId: number
  type: string
  startDate: string
  endDate: string
  reason: string | null
  status: string
}

interface Employee {
  id: number
  name: string
  email: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const formSchema = z.object({
  employeeId: z.string().min(1),
  type: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function Leave() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LeaveRequest | null>(null)
  const [deletingItem, setDeletingItem] = useState<LeaveRequest | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['leave'], queryFn: () => get<LeaveRequest[]>('/leave') })
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { employeeId: '', type: '', startDate: '', endDate: '', reason: '' },
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => put(`/leave/${id}/approve`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['leave'] }),
    onError: (error: Error) => toast.error(error.message),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) => put(`/leave/${id}/reject`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['leave'] }),
    onError: (error: Error) => toast.error(error.message),
  })

  const statusUpdateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => put(`/leave/${id}`, { status }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/leave', {
        employeeId: parseInt(data.employeeId, 10),
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/leave/${editingItem?.id ?? 0}`, {
        employeeId: parseInt(data.employeeId, 10),
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/leave/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    const currentEmp = employees?.find((emp) => emp.email === user?.email)
    form.reset({
      employeeId: currentEmp ? String(currentEmp.id) : employees?.[0] ? String(employees[0].id) : '',
      type: 'annual',
      startDate: '',
      endDate: '',
      reason: '',
    })
    setIsModalOpen(true)
  }

  function openEditModal(item: LeaveRequest) {
    setEditingItem(item)
    form.reset({
      employeeId: String(item.employeeId),
      type: item.type,
      startDate: item.startDate ? item.startDate.split('T')[0] : '',
      endDate: item.endDate ? item.endDate.split('T')[0] : '',
      reason: item.reason || '',
    })
    setIsModalOpen(true)
  }

  function handleClose() {
    setIsModalOpen(false)
    setEditingItem(null)
  }

  function openDeleteModal(item: LeaveRequest) {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  function handleDelete() {
    if (deletingItem) {
      deleteMutation.mutate(deletingItem.id)
      setIsDeleteOpen(false)
      setDeletingItem(null)
    }
  }

  function onSubmit(data: FormData) {
    if (editingItem) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      key: 'employeeId',
      label: t('leave.employee'),
      render: (item: LeaveRequest) => {
        const emp = employees?.find((e) => e.id === item.employeeId)
        return emp?.name || `Employee #${item.employeeId}`
      },
    },
    {
      key: 'type',
      label: t('leave.type'),
      render: (item: LeaveRequest) => t(`leave.${item.type}`),
    },
    {
      key: 'startDate',
      label: t('leave.start_date'),
      render: (item: LeaveRequest) => new Date(item.startDate).toLocaleDateString(),
    },
    {
      key: 'endDate',
      label: t('leave.end_date'),
      render: (item: LeaveRequest) => new Date(item.endDate).toLocaleDateString(),
    },
    { key: 'reason', label: t('leave.reason'), render: (item: LeaveRequest) => item.reason || '-' },
    {
      key: 'status',
      label: t('status.status'),
      render: (item: LeaveRequest) =>
        canEdit ? (
          <select
            value={item.status}
            onChange={(e) => statusUpdateMutation.mutate({ id: item.id, status: e.target.value })}
            className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer ${statusColors[item.status] || 'bg-gray-100 text-gray-600'}`}
          >
            <option value="pending">{t('status.pending')}</option>
            <option value="approved">{t('status.approved')}</option>
            <option value="rejected">{t('status.rejected')}</option>
          </select>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusColors[item.status] || 'bg-gray-100 text-gray-600'}`}
          >
            {item.status === 'approved' ? (
              <CheckIcon className="w-3 h-3" />
            ) : item.status === 'rejected' ? (
              <XIcon className="w-3 h-3" />
            ) : item.status === 'pending' ? (
              <ClockIcon className="w-3 h-3" />
            ) : null}
            {t(`status.${item.status}`)}
          </span>
        ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <LeaveIcon className="w-6 h-6 text-amber-500" />
          {t('page.leave')}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openAddModal}
            aria-label={t('action.add')}
            className="w-full sm:w-auto bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 inline-flex items-center"
          >
            <PlusIcon className="inline-block w-4 h-4 mr-1.5" />
            {t('action.add')}
          </button>
          <button
            onClick={() =>
              exportCsv(data ?? [], 'leave', {
                type: t('leave.type'),
                startDate: t('leave.start_date'),
                endDate: t('leave.end_date'),
                reason: t('leave.reason'),
                status: t('status.pending'),
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
        aria-label={t('page.leave')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.leave')}
        />
        {data
          ?.filter((l) => l.status === 'pending')
          .map((item) => (
            <div
              key={item.id}
              className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t(`leave.${item.type}`)} - {new Date(item.startDate).toLocaleDateString()} →{' '}
                {new Date(item.endDate).toLocaleDateString()}
              </span>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(item.id)}
                    disabled={approveMutation.isPending}
                    aria-label={`${t('action.approve')} ${t(`leave.${item.type}`)}`}
                    className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium hover:bg-green-200 disabled:opacity-50 focus:ring-2 focus:ring-green-400"
                  >
                    <CheckIcon className="w-3 h-3" />
                    {t('action.approve')}
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(item.id)}
                    disabled={rejectMutation.isPending}
                    aria-label={`${t('action.reject')} ${t(`leave.${item.type}`)}`}
                    className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium hover:bg-red-200 disabled:opacity-50 focus:ring-2 focus:ring-red-400"
                  >
                    <XIcon className="w-3 h-3" />
                    {t('action.reject')}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('action.edit') : t('action.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {canEdit ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leave.employee')} <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  {...form.register('employeeId')}
                >
                  <option value="">{t('common.select_option')}</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" {...form.register('employeeId')} />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('leave.type')} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('type')}
              >
                <option value="">{t('common.select_option')}</option>
                <option value="annual">{t('leave.annual')}</option>
                <option value="sick">{t('leave.sick')}</option>
                <option value="personal">{t('leave.personal')}</option>
                <option value="unpaid">{t('leave.unpaid')}</option>
              </select>
            </div>
            <FormField name="startDate" label={t('leave.start_date')} type="date" required />
            <FormField name="endDate" label={t('leave.end_date')} type="date" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('leave.reason')}
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
                {...form.register('reason')}
              />
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
