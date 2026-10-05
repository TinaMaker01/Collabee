import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { get, patch } from '../api/client'
import { toast } from 'sonner'
import LoadingSpinner from './LoadingSpinner'
import {
  DashboardIcon,
  EmployeesIcon,
  DepartmentsIcon,
  AttendanceIcon,
  LeaveIcon,
  TasksIcon,
  AdminIcon,
  SettingsIcon,
  BellIcon,
  BellDotIcon,
  LoaderIcon,
  LeaveBalanceIcon,
  DocumentIcon,
  SearchIcon,
  XIcon,
} from './icons'

interface Notification {
  id: number
  userId: number
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

function relativeTime(t: TFunction, dateStr: string, now: number) {
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('notification.minutes_ago', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('notification.hours_ago', { count: hours })
  const days = Math.floor(hours / 24)
  return t('notification.days_ago', { count: days })
}

const navItems = [
  { label: 'nav.dashboard', icon: DashboardIcon, href: '/dashboard' },
  { label: 'nav.employees', icon: EmployeesIcon, href: '/employees' },
  { label: 'nav.departments', icon: DepartmentsIcon, href: '/departments' },
  { label: 'nav.attendance', icon: AttendanceIcon, href: '/attendance' },
  { label: 'nav.leave', icon: LeaveIcon, href: '/leave' },
  { label: 'nav.leave_balance', icon: LeaveBalanceIcon, href: '/leave-balance' },
  { label: 'nav.tasks', icon: TasksIcon, href: '/tasks' },
  { label: 'nav.documents', icon: DocumentIcon, href: '/documents' },
  { label: 'nav.admin', icon: AdminIcon, href: '/admin' },
  { label: 'nav.settings', icon: SettingsIcon, href: '/settings' },
]

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const filteredNavItems = useMemo(() => {
    const available = navItems.filter((item) => item.href !== '/admin' || user?.role === 'admin')
    if (!searchQuery.trim()) return available
    const q = searchQuery.toLowerCase().trim()
    return available.filter((item) => t(item.label).toLowerCase().includes(q) || item.href.toLowerCase().includes(q))
  }, [searchQuery, user?.role, t])

  const notifQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<Notification[]>('/notifications'),
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => patch(`/notifications/${id}/read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueryData<Notification[]>(['notifications'])
      queryClient.setQueryData<Notification[]>(
        ['notifications'],
        (old) => old?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? [],
      )
      return { previous }
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(['notifications'], context?.previous)
      toast.error(t('notification.error'))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error(t('notification.error')),
  })

  const notifications = notifQuery.data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length
  const recent = notifications.slice(0, 5)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const recentWithTime = useMemo(() => {
    return recent.map((n) => ({ ...n, timeAgo: relativeTime(t, n.createdAt, now) }))
  }, [recent, now, t])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-600 focus:text-white focus:rounded-lg"
      >
        {t('action.skip_to_content')}
      </a>
      <header
        role="banner"
        className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 focus:ring-2 focus:ring-amber-500"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={t('action.toggle_sidebar')}
            aria-expanded={sidebarOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-amber-600">Collabee</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 ml-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Quick search (Cmd+K)"
          >
            <SearchIcon className="w-3.5 h-3.5" />
            <span>{t('action.search')}...</span>
            <kbd className="font-mono text-[10px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label={t('action.toggle_theme')}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-amber-500"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                aria-label={t('notification.title')}
                className="relative p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-amber-500"
              >
                {unreadCount > 0 ? <BellDotIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                {unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} unread notifications`}
                    className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50"
                >
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('notification.title')}</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifQuery.isLoading ? (
                      <div className="p-4 flex justify-center">
                        <LoaderIcon className="w-5 h-5 text-gray-400 animate-spin" />
                      </div>
                    ) : notifQuery.isError ? (
                      <div className="p-4 text-center">
                        <p className="text-sm text-red-500">{t('notification.load_error')}</p>
                        <p className="text-xs text-gray-400 mt-1">{t('common.retry')}</p>
                      </div>
                    ) : recent.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        {t('notification.empty')}
                      </p>
                    ) : (
                      recentWithTime.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markRead.mutate(n.id)
                          }}
                          aria-label={n.read ? t('notification.title') : t('notification.mark_read')}
                          className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 ${!n.read ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                        >
                          {n.type === 'warning' ? (
                            <svg
                              className="w-4 h-4 mt-0.5 text-amber-500 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 mt-0.5 text-blue-500 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{n.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{n.timeAgo}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  {recent.length > 0 && unreadCount > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                      <button
                        onClick={() => markAllRead.mutate()}
                        className="w-full text-center text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 py-1 focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        {t('notification.mark_all_read')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {languages.map((lang) => {
            const isActive = i18n.language === lang.code
            return (
              <button
                key={lang.code}
                onClick={() => void i18n.changeLanguage(lang.code)}
                disabled={isActive}
                aria-label={`${t('action.switch_language')} ${lang.label}`}
                aria-current={isActive ? 'true' : undefined}
                className={`text-xs font-medium px-2 py-1 rounded focus:ring-2 focus:ring-amber-500 ${
                  isActive
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 cursor-default'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {lang.label}
              </button>
            )
          })}
          {user && (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-200 hidden sm:inline">{user.name}</span>
              <button
                onClick={logout}
                aria-label={t('action.logout')}
                className="text-sm text-red-600 hover:text-red-800 font-medium focus:ring-2 focus:ring-red-400 rounded px-2 py-1"
              >
                {t('action.logout')}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
            tabIndex={sidebarOpen ? 0 : -1}
            aria-hidden={!sidebarOpen}
          />
        )}

        <aside
          role="navigation"
          aria-label={t('nav.main_navigation')}
          className={`
            fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          <nav className="p-4 pt-16 lg:pt-4">
            <ul className="space-y-1" role="list">
              {navItems
                .filter((item) => item.label !== 'nav.admin' || user?.role === 'admin')
                .map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.label} role="listitem">
                      <NavLink
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-amber-500 ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400'
                          }`
                        }
                        aria-current={undefined}
                      >
                        <Icon className="w-5 h-5" aria-hidden="true" />
                        <span className="text-sm font-medium">{t(item.label)}</span>
                      </NavLink>
                    </li>
                  )
                })}
            </ul>
          </nav>
        </aside>

        <main id="main-content" role="main" className="flex-1 p-4 sm:p-6 lg:p-10 dark:text-gray-200">
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 gap-3">
              <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredNavItems.length > 0) {
                    void navigate(filteredNavItems[0].href)
                    setSearchOpen(false)
                    setSearchQuery('')
                  }
                }}
                placeholder={`${t('action.search')}...`}
                className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded"
                aria-label={t('common.close')}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredNavItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  {t('common.no_data')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <button
                          type="button"
                          onClick={() => {
                            void navigate(item.href)
                            setSearchOpen(false)
                            setSearchQuery('')
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                        >
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{t(item.label)}</span>
                          <span className="ml-auto text-xs text-gray-400 font-mono">{item.href}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
              <span>Navigate with Enter</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
