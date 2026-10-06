import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FormProvider, useForm as useHookForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import FormField from '../components/FormField'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MailIcon, LockIcon } from '../components/icons'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const { t } = useTranslation()
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const form = useHookForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function handleSubmit(data: LoginForm) {
    try {
      await login(data.email, data.password)
      void navigate('/dashboard')
    } catch {
      toast.error(t('auth.login_error'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-2xl font-bold text-center text-amber-600 mb-2">Collabee</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('auth.login_title')}</p>
        <FormProvider {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
            <FormField<LoginForm>
              name="email"
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.email_placeholder')}
              required
            >
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  placeholder={t('auth.email_placeholder')}
                  required
                  aria-invalid={!!form.formState.errors.email}
                  aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  {...form.register('email')}
                />
              </div>
            </FormField>
            <FormField<LoginForm> name="password" label={t('auth.password')} required>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.password_placeholder')}
                  required
                  aria-invalid={!!form.formState.errors.password}
                  aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-10 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </FormField>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                {t('auth.forgot_password')}
              </Link>
            </div>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              {form.formState.isSubmitting ? t('common.loading') : t('auth.login_title')}
            </button>
          </form>
        </FormProvider>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          {t('auth.no_account')}{' '}
          <Link to="/register" className="text-amber-600 hover:text-amber-700 font-medium">
            {t('auth.register_link')}
          </Link>
        </p>
      </div>
    </div>
  )
}
