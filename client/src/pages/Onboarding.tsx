import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { get, post, patch, del } from '../api/client'
import { toast } from 'sonner'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import {
  RocketIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  DocumentIcon,
  OrgChartIcon,
  TasksIcon,
  SettingsIcon,
  AttendanceIcon,
} from '../components/icons'

interface OnboardingTask {
  id: number
  employeeId: number
  title: string
  description: string | null
  category: string
  isCompleted: boolean
  completedAt: string | null
  dueDays: number | null
  sortOrder: number
}

interface OnboardingData {
  employee?: {
    id: number
    firstName: string
    lastName: string
    email: string
    departmentId: number | null
  }
  tasks: OnboardingTask[]
  stats: {
    total: number
    completed: number
    percentage: number
  }
}

interface OverviewItem {
  employeeId: number
  name: string
  email: string
  department: string | null
  totalTasks: number
  completedTasks: number
  percentage: number
  tasks: OnboardingTask[]
}

interface OverviewData {
  overview: OverviewItem[]
}

interface EmployeeOption {
  id: number
  firstName: string
  lastName: string
  email: string
}

export default function Onboarding() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'checklist' | 'overview'>('checklist')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Form state for creating custom task
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState('general')
  const [newTaskDueDays, setNewTaskDueDays] = useState('7')
  const [newTaskEmployeeId, setNewTaskEmployeeId] = useState<string>('')

  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager'

  // User checklist query
  const {
    data: checklistData,
    isLoading: isLoadingChecklist,
    error: checklistError,
  } = useQuery<OnboardingData>({
    queryKey: ['onboarding', 'checklist'],
    queryFn: () => get<OnboardingData>('/onboarding'),
  })

  // Admin/Manager overview query
  const { data: overviewData, isLoading: isLoadingOverview } = useQuery<OverviewData>({
    queryKey: ['onboarding', 'overview'],
    queryFn: () => get<OverviewData>('/onboarding?view=overview'),
    enabled: isManagerOrAdmin && activeTab === 'overview',
  })

  // Employees query for assignment dropdown
  const { data: employeesData } = useQuery<
    { data?: EmployeeOption[]; employees?: EmployeeOption[] } | EmployeeOption[]
  >({
    queryKey: ['employees', 'list'],
    queryFn: () => get('/employees'),
    enabled: isManagerOrAdmin && isModalOpen,
  })

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    if (!employeesData) return []
    if (Array.isArray(employeesData)) return employeesData
    if (Array.isArray(employeesData.data)) return employeesData.data
    if (Array.isArray(employeesData.employees)) return employeesData.employees
    return []
  }, [employeesData])

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (taskId: number) =>
      patch<{
        task: OnboardingTask
        allCompleted: boolean
        stats: { total: number; completed: number; percentage: number }
      }>(`/onboarding/${taskId}/toggle`),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      if (data.allCompleted) {
        toast.success(t('onboarding.all_done_title'), {
          description: t('onboarding.all_done_desc'),
        })
      } else {
        toast.success(t('common.save_success'))
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'))
    },
  })

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      title: string
      description?: string
      category: string
      dueDays: number
      employeeId?: number
    }) => post('/onboarding', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      toast.success(t('common.save_success'))
      setIsModalOpen(false)
      setNewTaskTitle('')
      setNewTaskDesc('')
      setNewTaskCategory('general')
      setNewTaskDueDays('7')
      setNewTaskEmployeeId('')
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'))
    },
  })

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => del(`/onboarding/${taskId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      toast.success(t('common.delete_success'))
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'))
    },
  })

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      category: newTaskCategory,
      dueDays: parseInt(newTaskDueDays, 10) || 7,
      employeeId: newTaskEmployeeId ? parseInt(newTaskEmployeeId, 10) : undefined,
    })
  }

  const tasks = useMemo(() => checklistData?.tasks ?? [], [checklistData?.tasks])
  const stats = checklistData?.stats || { total: 0, completed: 0, percentage: 0 }

  const filteredTasks = useMemo(() => {
    if (selectedCategory === 'all') return tasks
    return tasks.filter((t) => t.category === selectedCategory)
  }, [tasks, selectedCategory])

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'profile':
        return t('onboarding.category_profile')
      case 'documents':
        return t('onboarding.category_documents')
      case 'team':
        return t('onboarding.category_team')
      case 'tools':
        return t('onboarding.category_tools')
      default:
        return t('onboarding.category_general')
    }
  }

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'profile':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      case 'documents':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      case 'team':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
      case 'tools':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RocketIcon className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('onboarding.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('onboarding.subtitle')}</p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'checklist'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('onboarding.my_checklist')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'overview'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('onboarding.team_overview')}
            </button>
            {activeTab === 'overview' && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                {t('onboarding.add_task')}
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'checklist' && (
        <>
          {isLoadingChecklist ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : checklistError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
              {t('common.error')}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Summary Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('onboarding.progress')}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('onboarding.completed_tasks', {
                        completed: stats.completed,
                        total: stats.total,
                        percent: stats.percentage,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.percentage}%</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        stats.percentage === 100
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {stats.percentage === 100 ? t('onboarding.completed_badge') : t('onboarding.pending_badge')}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={stats.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                    style={{ width: `${stats.percentage}%` }}
                  />
                </div>

                {stats.percentage === 100 && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-full text-emerald-600 dark:text-emerald-300">
                      <CheckIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">
                        {t('onboarding.all_done_title')}
                      </h3>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {t('onboarding.all_done_desc')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Navigation Cards */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  {t('onboarding.quick_nav')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Link
                    to="/settings"
                    className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700 transition group"
                  >
                    <SettingsIcon className="w-6 h-6 text-gray-500 group-hover:text-amber-600 dark:text-gray-400 dark:group-hover:text-amber-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 mt-2">
                      {t('nav.settings')}
                    </span>
                  </Link>
                  <Link
                    to="/documents"
                    className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700 transition group"
                  >
                    <DocumentIcon className="w-6 h-6 text-gray-500 group-hover:text-amber-600 dark:text-gray-400 dark:group-hover:text-amber-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 mt-2">
                      {t('nav.documents')}
                    </span>
                  </Link>
                  <Link
                    to="/org-chart"
                    className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700 transition group"
                  >
                    <OrgChartIcon className="w-6 h-6 text-gray-500 group-hover:text-amber-600 dark:text-gray-400 dark:group-hover:text-amber-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 mt-2">
                      {t('nav.org_chart')}
                    </span>
                  </Link>
                  <Link
                    to="/tasks"
                    className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700 transition group"
                  >
                    <TasksIcon className="w-6 h-6 text-gray-500 group-hover:text-amber-600 dark:text-gray-400 dark:group-hover:text-amber-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 mt-2">
                      {t('nav.tasks')}
                    </span>
                  </Link>
                  <Link
                    to="/attendance"
                    className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700 transition group"
                  >
                    <AttendanceIcon className="w-6 h-6 text-gray-500 group-hover:text-amber-600 dark:text-gray-400 dark:group-hover:text-amber-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 mt-2">
                      {t('nav.attendance')}
                    </span>
                  </Link>
                </div>
              </div>

              {/* Category Filter & Task List */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                      selectedCategory === 'all'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t('common.filter_all')} ({tasks.length})
                  </button>
                  {['profile', 'documents', 'team', 'tools', 'general'].map((cat) => {
                    const count = tasks.filter((t) => t.category === cat).length
                    if (count === 0 && selectedCategory !== cat) return null
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                          selectedCategory === cat
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {getCategoryLabel(cat)} ({count})
                      </button>
                    )
                  })}
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">{t('onboarding.no_tasks')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-start justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border transition ${
                          task.isCompleted
                            ? 'border-gray-200 dark:border-gray-700/60 opacity-80 bg-gray-50/50 dark:bg-gray-800/50'
                            : 'border-gray-200 dark:border-gray-700 shadow-sm hover:border-amber-300 dark:hover:border-amber-700'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                          <button
                            type="button"
                            onClick={() => toggleMutation.mutate(task.id)}
                            disabled={toggleMutation.isPending}
                            className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center border transition ${
                              task.isCompleted
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400'
                            }`}
                            aria-label={`Toggle ${task.title}`}
                          >
                            {task.isCompleted && <CheckIcon className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                className={`text-sm font-semibold transition ${
                                  task.isCompleted
                                    ? 'line-through text-gray-500 dark:text-gray-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {task.title}
                              </h4>
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getCategoryColor(
                                  task.category,
                                )}`}
                              >
                                {getCategoryLabel(task.category)}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                            )}
                            {task.isCompleted && task.completedAt && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                                ✓ {t('onboarding.completed_badge')} {new Date(task.completedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-md transition"
                            title={t('action.delete')}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin/Manager Team Overview Tab */}
      {isManagerOrAdmin && activeTab === 'overview' && (
        <div className="space-y-4">
          {isLoadingOverview ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3">{t('onboarding.overview_employee')}</th>
                      <th className="px-6 py-3">{t('onboarding.overview_department')}</th>
                      <th className="px-6 py-3">{t('onboarding.overview_progress')}</th>
                      <th className="px-6 py-3">{t('onboarding.overview_tasks')}</th>
                      <th className="px-6 py-3">{t('onboarding.overview_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(overviewData?.overview || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          {t('common.no_data')}
                        </td>
                      </tr>
                    ) : (
                      (overviewData?.overview || []).map((item) => (
                        <tr key={item.employeeId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.email}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                            {item.department || t('common.not_available')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {item.percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                            {item.completedTasks} / {item.totalTasks}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.percentage === 100
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}
                            >
                              {item.percentage === 100
                                ? t('onboarding.completed_badge')
                                : t('onboarding.pending_badge')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('onboarding.add_task')}>
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('onboarding.select_employee')}
            </label>
            <select
              value={newTaskEmployeeId}
              onChange={(e) => setNewTaskEmployeeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">{t('common.select_option')}</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('onboarding.task_title')} *
            </label>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="e.g. Set up workstation and dev environment"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('onboarding.task_desc')}
            </label>
            <textarea
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Detailed instructions or resources..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('onboarding.task_category')}
              </label>
              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="profile">{t('onboarding.category_profile')}</option>
                <option value="documents">{t('onboarding.category_documents')}</option>
                <option value="team">{t('onboarding.category_team')}</option>
                <option value="tools">{t('onboarding.category_tools')}</option>
                <option value="general">{t('onboarding.category_general')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('onboarding.task_due_days')}
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={newTaskDueDays}
                onChange={(e) => setNewTaskDueDays(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
            >
              {t('action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
