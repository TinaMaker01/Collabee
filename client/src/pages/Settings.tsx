import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { put, get, patch } from '../api/client'
import { toast } from 'sonner'
import {
  SettingsIcon,
  UserIcon,
  MailIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  OrgChartIcon,
} from '../components/icons'

interface OrgData {
  organization: {
    id: number
    name: string
    slug: string
    domain: string | null
  }
  stats: {
    departmentsCount: number
    usersCount: number
    employeesCount: number
  }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: orgData } = useQuery<OrgData>({
    queryKey: ['organization'],
    queryFn: () => get('/organization'),
  })

  const [orgName, setOrgName] = useState('')
  const [orgDomain, setOrgDomain] = useState('')
  const [isEditingOrg, setIsEditingOrg] = useState(false)

  const updateOrgMutation = useMutation({
    mutationFn: (payload: { name?: string; domain?: string }) => patch('/organization', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization'] })
      toast.success(t('settings.org_updated'))
      setIsEditingOrg(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'))
    },
  })

  const handleStartEditOrg = () => {
    setOrgName(orgData?.organization?.name || '')
    setOrgDomain(orgData?.organization?.domain || '')
    setIsEditingOrg(true)
  }

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault()
    updateOrgMutation.mutate({
      name: orgName.trim() || undefined,
      domain: orgDomain.trim() || undefined,
    })
  }

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function handlePasswordChange(data: PasswordForm) {
    try {
      await put('/auth/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success(t('settings.password_updated'))
      passwordForm.reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('settings.password_error')
      toast.error(msg)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-amber-500" />
        {t('page.settings')}
      </h1>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div role="region" aria-label={t('settings.profile')}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-amber-500" /> {t('settings.profile')}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const nameEntry = fd.get('name')
              const avatarEntry = fd.get('avatarUrl')
              const name = typeof nameEntry === 'string' ? nameEntry : ''
              const avatarUrl = typeof avatarEntry === 'string' ? avatarEntry : ''
              void put('/auth/profile', { name, avatarUrl: avatarUrl || undefined })
                .then(() => {
                  toast.success(t('common.save_success'))
                })
                .catch((err: unknown) => {
                  toast.error(err instanceof Error ? err.message : 'Error updating profile')
                })
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('settings.name_label')}
              </label>
              <input
                name="name"
                defaultValue={user?.name}
                required
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Avatar URL</label>
              <input
                name="avatarUrl"
                defaultValue={user?.avatarUrl ?? ''}
                placeholder="https://..."
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-500">
              {t('settings.email_label')} {user?.email} • {t('settings.role_label')} {user?.role}
            </p>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 focus:ring-2 focus:ring-amber-500"
            >
              {t('action.save') || 'Save Profile'}
            </button>
          </form>
        </div>
        <div className="border-t dark:border-gray-700 pt-4" role="region" aria-label="Language">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <MailIcon className="w-5 h-5 text-amber-500" /> Language
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => void i18n.changeLanguage('en')}
              aria-label="Switch to English"
              className={`px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 ${
                i18n.language === 'en'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              English
            </button>
            <button
              onClick={() => void i18n.changeLanguage('fr')}
              aria-label="Passer au français"
              className={`px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 ${
                i18n.language === 'fr'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Français
            </button>
          </div>
        </div>
        <div className="border-t dark:border-gray-700 pt-4" role="region" aria-label="Theme">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            {theme === 'dark' ? (
              <MoonIcon className="w-5 h-5 text-amber-500" />
            ) : (
              <SunIcon className="w-5 h-5 text-amber-500" />
            )}{' '}
            {t('action.theme')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 ${
                theme === 'light'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <SunIcon className="w-4 h-4" />
              {t('action.theme_light')}
            </button>
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 ${
                theme === 'dark'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <MoonIcon className="w-4 h-4" />
              {t('action.theme_dark')}
            </button>
          </div>
        </div>
        <div className="border-t dark:border-gray-700 pt-4" role="region" aria-label="Change Password">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <LockIcon className="w-5 h-5 text-amber-500" /> {t('settings.change_password')}
          </h2>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4" noValidate>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                placeholder={t('settings.current_password')}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...passwordForm.register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-xs text-red-500">{passwordForm.formState.errors.currentPassword.message}</p>
            )}
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                placeholder={t('settings.new_password')}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...passwordForm.register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.formState.errors.newPassword && (
              <p className="text-xs text-red-500">{passwordForm.formState.errors.newPassword.message}</p>
            )}
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder={t('settings.confirm_password')}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                {...passwordForm.register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
            <button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              {passwordForm.formState.isSubmitting ? t('common.loading') : t('settings.change_password')}
            </button>
          </form>
        </div>

        {/* Organization / Workspace Section */}
        <div
          role="region"
          aria-label={t('settings.organization')}
          className="border-t border-gray-200 dark:border-gray-700 pt-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <OrgChartIcon className="w-5 h-5 text-amber-500" /> {t('settings.organization')}
            </h2>
            {user?.role === 'admin' && !isEditingOrg && (
              <button
                type="button"
                onClick={handleStartEditOrg}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
              >
                {t('action.edit')}
              </button>
            )}
          </div>

          {isEditingOrg ? (
            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('settings.org_name')}
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('settings.org_domain')}
                </label>
                <input
                  type="text"
                  value={orgDomain}
                  onChange={(e) => setOrgDomain(e.target.value)}
                  placeholder="e.g. yourcompany.com"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updateOrgMutation.isPending}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition"
                >
                  {t('action.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingOrg(false)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  {t('action.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">{t('settings.org_name')}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {orgData?.organization?.name || 'Collabee HQ'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">{t('settings.org_slug')}</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {orgData?.organization?.slug || 'collabee-hq'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">{t('settings.org_domain')}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {orgData?.organization?.domain || t('common.not_available')}
                  </span>
                </div>
              </div>

              {orgData?.stats && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      {t('settings.org_departments')}
                    </span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {orgData.stats.departmentsCount}
                    </span>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">{t('settings.org_members')}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {orgData.stats.usersCount}
                    </span>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      {t('settings.org_employees')}
                    </span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      {orgData.stats.employeesCount}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
