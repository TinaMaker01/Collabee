import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { get } from '../api/client'
import { CalendarIcon, UserIcon } from '../components/icons'
import Modal from '../components/Modal'

interface Employee {
  id: number
  name: string
  departmentId: number | null
}

interface Department {
  id: number
  name: string
}

interface LeaveRequest {
  id: number
  employeeId: number
  type: string
  startDate: string
  endDate: string
  status: string
}

interface AttendanceRecord {
  id: number
  employeeId: number
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
}

const leaveColors: Record<string, string> = {
  annual: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300',
  sick: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300',
  personal: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300',
  unpaid: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300',
}

const attendanceColors: Record<string, string> = {
  present: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300',
  late: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300',
  half_day: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Calendar() {
  const { t } = useTranslation()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [filterType, setFilterType] = useState<'all' | 'leave' | 'attendance'>('all')
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    dateStr: string
    leaves: { empName: string; type: string }[]
    attendances: { empName: string; status: string; checkIn: string | null; checkOut: string | null }[]
  } | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => get<Employee[]>('/employees') })
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => get<Department[]>('/departments') })
  const { data: leaveRequests } = useQuery({ queryKey: ['leave'], queryFn: () => get<LeaveRequest[]>('/leave') })
  const { data: attendanceList } = useQuery({ queryKey: ['attendance'], queryFn: () => get<AttendanceRecord[]>('/attendance') })

  const empMap = useMemo(() => {
    const map = new Map<number, Employee>()
    employees?.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(currentDate)
  }, [currentDate])

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // JS getDay(): 0 is Sunday, 1 is Monday ... convert to Monday = 0
    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days = []

    // Previous month padding
    const prevMonthLastDate = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i
      const date = new Date(year, month - 1, d)
      days.push({ date, isCurrentMonth: false })
    }

    // Current month days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const date = new Date(year, month, d)
      days.push({ date, isCurrentMonth: true })
    }

    // Next month padding to fill grid
    const totalSlots = Math.ceil(days.length / 7) * 7
    const remaining = totalSlots - days.length
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d)
      days.push({ date, isCurrentMonth: false })
    }

    return days
  }, [year, month])

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function today() {
    setCurrentDate(new Date())
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-500" />
            {t('page.calendar')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{monthName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Navigation */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-700">
            <button
              onClick={prevMonth}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-md"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              onClick={today}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-md"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-md"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'leave' | 'attendance')}
            className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Events</option>
            <option value="leave">Leaves Only</option>
            <option value="attendance">Attendance Only</option>
          </select>

          {/* Filter Department */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200"
          >
            <option value="">All Departments</option>
            {departments?.map((dept) => (
              <option key={dept.id} value={dept.id.toString()}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-center py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-100 dark:divide-gray-700/60">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const dateStr = date.toISOString().slice(0, 10)
            const isToday = new Date().toISOString().slice(0, 10) === dateStr

            // Find matching leaves
            const leaves = (leaveRequests ?? []).filter((lr) => {
              if (lr.status !== 'approved') return false
              const emp = empMap.get(lr.employeeId)
              if (!emp) return false
              if (selectedDept && emp.departmentId?.toString() !== selectedDept) return false
              const start = lr.startDate.slice(0, 10)
              const end = lr.endDate.slice(0, 10)
              return dateStr >= start && dateStr <= end
            })

            // Find matching attendances
            const attendances = (attendanceList ?? []).filter((att) => {
              const emp = empMap.get(att.employeeId)
              if (!emp) return false
              if (selectedDept && emp.departmentId?.toString() !== selectedDept) return false
              return att.date.slice(0, 10) === dateStr
            })

            const hasEvents = leaves.length > 0 || attendances.length > 0

            return (
              <div
                key={idx}
                onClick={() => {
                  if (hasEvents) {
                    setSelectedDayDetails({
                      dateStr,
                      leaves: leaves.map((l) => ({ empName: empMap.get(l.employeeId)?.name ?? `ID ${l.employeeId}`, type: l.type })),
                      attendances: attendances.map((a) => ({
                        empName: empMap.get(a.employeeId)?.name ?? `ID ${a.employeeId}`,
                        status: a.status,
                        checkIn: a.checkIn,
                        checkOut: a.checkOut,
                      })),
                    })
                  }
                }}
                className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                  !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/30 text-gray-400' : 'bg-white dark:bg-gray-800'
                } ${hasEvents ? 'cursor-pointer hover:bg-amber-50/30 dark:hover:bg-amber-950/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isToday
                        ? 'bg-amber-500 text-white font-bold'
                        : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {hasEvents && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaves.length + attendances.length}
                    </span>
                  )}
                </div>

                {/* Event previews */}
                <div className="space-y-1 overflow-hidden flex-1">
                  {(filterType === 'all' || filterType === 'leave') &&
                    leaves.slice(0, 2).map((l, i) => {
                      const empName = empMap.get(l.employeeId)?.name ?? 'Emp'
                      return (
                        <div
                          key={`l-${i}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${leaveColors[l.type] || 'bg-gray-100 text-gray-800'}`}
                          title={`${empName} (${l.type})`}
                        >
                          🏖️ {empName}
                        </div>
                      )
                    })}

                  {(filterType === 'all' || filterType === 'attendance') &&
                    attendances.slice(0, 2).map((a, i) => {
                      const empName = empMap.get(a.employeeId)?.name ?? 'Emp'
                      return (
                        <div
                          key={`a-${i}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${attendanceColors[a.status] || 'bg-gray-100 text-gray-800'}`}
                          title={`${empName} (${a.status})`}
                        >
                          ⏱️ {empName}
                        </div>
                      )
                    })}

                  {leaves.length + attendances.length > 2 && (
                    <div className="text-[9px] text-gray-400 pl-1">
                      +{leaves.length + attendances.length - 2} more...
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      <Modal
        isOpen={!!selectedDayDetails}
        onClose={() => setSelectedDayDetails(null)}
        title={selectedDayDetails ? `Events for ${selectedDayDetails.dateStr}` : ''}
      >
        <div className="space-y-4">
          {selectedDayDetails && (
            <>
              {selectedDayDetails.leaves.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                    Leaves ({selectedDayDetails.leaves.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedDayDetails.leaves.map((l, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-xs"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                          {l.empName}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[11px] ${leaveColors[l.type] || ''}`}>
                          {l.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedDayDetails.attendances.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                    Attendance ({selectedDayDetails.attendances.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedDayDetails.attendances.map((a, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-xs"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                          {a.empName}
                        </span>
                        <div className="flex items-center gap-2">
                          {a.checkIn && <span className="text-gray-400 font-mono text-[11px]">{a.checkIn}</span>}
                          <span className={`px-2 py-0.5 rounded border text-[11px] ${attendanceColors[a.status] || ''}`}>
                            {a.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
