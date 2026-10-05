import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { get, post } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import {
  DashboardIcon,
  EmployeesIcon,
  DepartmentsIcon,
  ClockIcon,
  LeaveIcon,
  AttendanceIcon,
  TasksIcon,
  CheckIcon,
} from '../components/icons'

interface DashboardStats {
  employeesCount: number
  departmentsCount: number
  pendingLeavesCount: number
  myTasksCount: number
  usersCount: number
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => get<DashboardStats>('/dashboard/stats'),
  })

  const checkInMutation = useMutation({
    mutationFn: () => post('/attendance/check-in', {}),
    onSuccess: () => {
      toast.success(t('attendance.check_in_success') || 'Checked in successfully!')
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkOutMutation = useMutation({
    mutationFn: () => post('/attendance/check-out', {}),
    onSuccess: () => {
      toast.success(t('attendance.check_out_success') || 'Checked out successfully!')
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <DashboardIcon className="w-8 h-8 text-amber-600" aria-hidden="true" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('page.dashboard')}
          </h2>
          <p className="text-gray-500 dark:text-gray-300 mb-8 max-w-md">
            {t('dashboard.welcome', { name: user?.name ?? '' })}
          </p>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-2xl">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <EmployeesIcon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.employeesCount ?? 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('nav.employees')}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <DepartmentsIcon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.departmentsCount ?? 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('nav.departments')}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <ClockIcon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats?.pendingLeavesCount ?? 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.pending_approvals')}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <TasksIcon className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.myTasksCount ?? 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.my_tasks')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('dashboard.quick_actions')}</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <CheckIcon className="w-4 h-4" />
            {checkInMutation.isPending ? t('common.loading') : 'Clock In'}
          </button>
          <button
            onClick={() => checkOutMutation.mutate()}
            disabled={checkOutMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <ClockIcon className="w-4 h-4" />
            {checkOutMutation.isPending ? t('common.loading') : 'Clock Out'}
          </button>
          <Link
            to="/leave"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <LeaveIcon className="w-4 h-4" />
            {t('nav.leave')}
          </Link>
          <Link
            to="/attendance"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <AttendanceIcon className="w-4 h-4" />
            {t('nav.attendance')}
          </Link>
          <Link
            to="/tasks"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <TasksIcon className="w-4 h-4" />
            {t('nav.tasks')}
          </Link>
        </div>
      </div>
    </div>
  )
}
