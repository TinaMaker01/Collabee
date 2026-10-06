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
import { CalendarIcon, PlusIcon, CheckIcon, XIcon, ClockIcon, DownloadIcon, PrinterIcon } from '../components/icons'
import { exportCsv } from '../utils/exportCsv'

interface AttendanceRecord {
  id: number
  employeeId: number
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
}

interface Employee {
  id: number
  name: string
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  'half-day': 'bg-blue-100 text-blue-700',
}

const formSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string().min(1),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function Attendance() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AttendanceRecord | null>(null)
  const [deletingItem, setDeletingItem] = useState<AttendanceRecord | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', employeeFilter],
    queryFn: () => get<AttendanceRecord[]>(`/attendance${employeeFilter ? `?employeeId=${employeeFilter}` : ''}`),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { employeeId: '', date: '', checkIn: '', checkOut: '', status: 'present', notes: '' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      post('/attendance', {
        employeeId: parseInt(data.employeeId, 10),
        date: data.date,
        checkIn: data.checkIn || undefined,
        checkOut: data.checkOut || undefined,
        status: data.status,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      put(`/attendance/${editingItem?.id ?? 0}`, {
        employeeId: parseInt(data.employeeId, 10),
        date: data.date,
        checkIn: data.checkIn || undefined,
        checkOut: data.checkOut || undefined,
        status: data.status,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t('common.save_success'))
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      handleClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/attendance/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete_success'))
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const canDelete = user?.role === 'admin'

  function openAddModal() {
    setEditingItem(null)
    form.reset({ employeeId: '', date: '', checkIn: '', checkOut: '', status: 'present', notes: '' })
    setIsModalOpen(true)
  }

  function openEditModal(item: AttendanceRecord) {
    setEditingItem(item)
    form.reset({
      employeeId: item.employeeId.toString(),
      date: item.date.slice(0, 10),
      checkIn: item.checkIn ? item.checkIn.slice(0, 16) : '',
      checkOut: item.checkOut ? item.checkOut.slice(0, 16) : '',
      status: item.status,
      notes: item.notes ?? '',
    })
    setIsModalOpen(true)
  }

  function openDeleteModal(item: AttendanceRecord) {
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
    {
      key: 'date',
      label: t('attendance.date'),
      render: (item: AttendanceRecord) => new Date(item.date).toLocaleDateString(),
    },
    {
      key: 'checkIn',
      label: t('attendance.check_in'),
      render: (item: AttendanceRecord) => (item.checkIn ? new Date(item.checkIn).toLocaleTimeString() : '-'),
    },
    {
      key: 'checkOut',
      label: t('attendance.check_out'),
      render: (item: AttendanceRecord) => (item.checkOut ? new Date(item.checkOut).toLocaleTimeString() : '-'),
    },
    {
      key: 'status',
      label: t('attendance.status'),
      render: (item: AttendanceRecord) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusColors[item.status] || 'bg-gray-100 text-gray-600'}`}
        >
          {item.status === 'present' ? (
            <CheckIcon className="w-3 h-3" />
          ) : item.status === 'absent' ? (
            <XIcon className="w-3 h-3" />
          ) : item.status === 'late' ? (
            <ClockIcon className="w-3 h-3" />
          ) : null}
          {t(`status.${item.status}`)}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="print-only mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collabee</h1>
            <p className="text-sm text-gray-600">
              {t('page.attendance')} — {t('common.report_generated_on')}{' '}
              {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            {employeeFilter
              ? `${t('attendance.employee')}: ${employees?.find((e) => e.id.toString() === employeeFilter)?.name || employeeFilter}`
              : t('attendance.all_employees')}
          </div>
        </div>
      </div>

      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-amber-500" />
          {t('page.attendance')}
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            aria-label={t('attendance.filter_by_employee')}
            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="">{t('attendance.all_employees')}</option>
            {employees?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
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
              exportCsv(data ?? [], 'attendance', {
                date: t('attendance.date'),
                checkIn: t('attendance.check_in'),
                checkOut: t('attendance.check_out'),
                status: t('attendance.status'),
              })
            }
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <DownloadIcon className="w-4 h-4 mr-1.5" />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            title={t('common.print_pdf')}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <PrinterIcon className="w-4 h-4 mr-1.5" />
            PDF
          </button>
        </div>
      </div>
      <div
        className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        role="region"
        aria-label={t('page.attendance')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onEdit={canEdit ? openEditModal : undefined}
          onDelete={canDelete ? openDeleteModal : undefined}
          keyExtractor={(item) => item.id}
          ariaLabel={t('page.attendance')}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingItem ? t('action.edit') : t('action.add')}>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('attendance.employee')} <span className="text-red-500 ml-0.5">*</span>
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
            <FormField name="date" label={t('attendance.date')} type="date" required />
            <FormField name="checkIn" label={t('attendance.check_in')} type="datetime-local" />
            <FormField name="checkOut" label={t('attendance.check_out')} type="datetime-local" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('attendance.status')} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...form.register('status')}
              >
                <option value="present">{t('status.present')}</option>
                <option value="absent">{t('status.absent')}</option>
                <option value="late">{t('status.late')}</option>
                <option value="half-day">{t('status.half_day')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('attendance.notes')}
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
                {...form.register('notes')}
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
