import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { post } from '../api/client'
import { MailIcon } from '../components/icons'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // Request Reset State
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Set New Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    try {
      await post('/auth/forgot-password', { email })
      setSubmitted(true)
      toast.success(t('auth.forgot_password_desc'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error requesting password reset')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsResetting(true)
    try {
      await post('/auth/reset-password', { token, newPassword })
      toast.success(t('auth.reset_password_success'))
      void navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid or expired reset token')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-2xl font-bold text-center text-amber-600 mb-2">Collabee</h1>

        {token ? (
          <>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('auth.reset_password_title')}</p>
            <form onSubmit={(e) => { void handleSetPassword(e) }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {isResetting ? t('common.loading') : t('auth.reset_password_title')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('auth.forgot_password_title')}</p>
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-lg text-sm">
                  If an account exists for <span className="font-semibold">{email}</span>, a password reset link has been
                  sent.
                </div>
                <Link to="/login" className="inline-block text-sm text-amber-600 hover:underline">
                  {t('auth.back_to_login')}
                </Link>
              </div>
            ) : (
              <form onSubmit={(e) => { void handleRequestReset(e) }} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.email_placeholder')}
                      required
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  {isSubmitting ? t('common.loading') : t('auth.forgot_password_title')}
                </button>

                <div className="text-center pt-2">
                  <Link to="/login" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                    {t('auth.back_to_login')}
                  </Link>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
