import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { get } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  DashboardIcon,
  EmployeesIcon,
  DepartmentsIcon,
  ClockIcon,
  LeaveIcon,
  AttendanceIcon,
  TasksIcon,
} from '../components/icons'

interface Employee {
  id: number
  name: string
  email: string
}

interface LeaveRequest {
  id: number
  status: string
}

interface Department {
  id: number
  name: string
}

interface Task {
  id: number
  assignedTo: number | null
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })
  const leaveQuery = useQuery({ queryKey: ['leave'], queryFn: () => get<LeaveRequest[]>('/leave') })
  const deptQuery = useQuery({ queryKey: ['departments'], queryFn: () => get<Department[]>('/departments') })
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: () => get<Task[]>('/tasks') })

  const isLoading = employeesQuery.isLoading || leaveQuery.isLoading || deptQuery.isLoading || tasksQuery.isLoading
  const pendingLeaves = leaveQuery.data?.filter((l) => l.status === 'pending').length ?? 0
  const currentEmployee = employeesQuery.data?.find((emp) => emp.email === user?.email)
  const myTasks = tasksQuery.data?.filter((task) => currentEmployee && task.assignedTo === currentEmployee.id).length ?? 0

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
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {employeesQuery.data?.length ?? 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('employee.name')}s</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <DepartmentsIcon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{deptQuery.data?.length ?? 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('nav.departments')}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <ClockIcon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingLeaves}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.pending_approvals')}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <TasksIcon className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{myTasks}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.my_tasks')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('dashboard.quick_actions')}</h3>
        <div className="flex flex-wrap gap-3">
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
