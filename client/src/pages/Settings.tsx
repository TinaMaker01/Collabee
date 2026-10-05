import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { put } from '../api/client'
import { toast } from 'sonner'
import { SettingsIcon, UserIcon, MailIcon, SunIcon, MoonIcon, EyeIcon, EyeOffIcon, LockIcon } from '../components/icons'

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
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-amber-500" /> {t('settings.profile')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('settings.name_label')} {user?.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('settings.email_label')} {user?.email}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('settings.role_label')} {user?.role}
          </p>
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
      </div>
    </div>
  )
}
