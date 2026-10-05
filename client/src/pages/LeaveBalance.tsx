import { useQuery } from '@tanstack/react-query'
import { get } from '../api/client'
import DataTable from '../components/DataTable'
import { useTranslation } from 'react-i18next'
import { LeaveBalanceIcon } from '../components/icons'

interface LeaveBalanceRecord {
  employeeId: number
  employeeName: string
  annualRemaining: number
  sickRemaining: number
  personalRemaining: number
}

function RemainingBadge({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? remaining / total : 0
  let color = 'text-green-600 dark:text-green-400'
  if (pct <= 0.25) color = 'text-red-600 dark:text-red-400'
  else if (pct <= 0.5) color = 'text-amber-600 dark:text-amber-400'
  return <span className={color}>{remaining}</span>
}

export default function LeaveBalance() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => get<LeaveBalanceRecord[]>('/leave-balance'),
  })

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
          <LeaveBalanceIcon className="w-6 h-6 text-amber-500" />
          {t('page.leave_balance')}
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-700 dark:text-red-400">{t('common.error')}</p>
        </div>
      </div>
    )
  }

  const columns = [
    { key: 'employeeName', label: t('leave_balance.employee') },
    {
      key: 'annual',
      label: t('leave_balance.annual'),
      render: (item: LeaveBalanceRecord) => <RemainingBadge remaining={item.annualRemaining} total={20} />,
    },
    {
      key: 'sick',
      label: t('leave_balance.sick'),
      render: (item: LeaveBalanceRecord) => <RemainingBadge remaining={item.sickRemaining} total={10} />,
    },
    {
      key: 'personal',
      label: t('leave_balance.personal'),
      render: (item: LeaveBalanceRecord) => <RemainingBadge remaining={item.personalRemaining} total={5} />,
    },
    {
      key: 'unpaid',
      label: t('leave_balance.unpaid'),
      render: () => <span className="text-gray-400">N/A</span>,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        <LeaveBalanceIcon className="w-6 h-6 text-amber-500" />
        {t('page.leave_balance')}
      </h1>
      <div
        className="bg-white dark:bg-gray-800 dark:text-gray-200 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        role="region"
        aria-label={t('page.leave_balance')}
      >
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          keyExtractor={(item) => item.employeeId}
          ariaLabel={t('page.leave_balance')}
        />
      </div>
    </div>
  )
}
