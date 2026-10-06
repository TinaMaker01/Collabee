import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { get } from '../api/client'
import { OrgChartIcon, UserIcon, SearchIcon } from '../components/icons'

interface Employee {
  id: number
  name: string
  email: string
  position: string
  departmentId: number | null
  avatarUrl: string | null
  status: string
}

interface Department {
  id: number
  name: string
  description: string | null
  managerId: number | null
}

export default function OrgChart() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all')
  const [collapsedDepts, setCollapsedDepts] = useState<Record<number, boolean>>({})

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => get<Employee[]>('/employees'),
  })

  const { data: departments, isLoading: loadingDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => get<Department[]>('/departments'),
  })

  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>()
    employees?.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  function toggleCollapse(deptId: number) {
    setCollapsedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  function expandAll() {
    setCollapsedDepts({})
  }

  function collapseAll() {
    const collapsed: Record<number, boolean> = {}
    departments?.forEach((d) => {
      collapsed[d.id] = true
    })
    setCollapsedDepts(collapsed)
  }

  const filteredDepts = useMemo(() => {
    if (!departments) return []
    if (selectedDeptId !== 'all') {
      return departments.filter((d) => d.id.toString() === selectedDeptId)
    }
    return departments
  }, [departments, selectedDeptId])

  const unassignedEmployees = useMemo(() => {
    if (!employees) return []
    return employees.filter((e) => e.departmentId === null)
  }, [employees])

  const searchFilteredDepts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return filteredDepts

    return filteredDepts.filter((dept) => {
      if (dept.name.toLowerCase().includes(term)) return true
      const manager = dept.managerId ? employeeMap.get(dept.managerId) : null
      if (manager && manager.name.toLowerCase().includes(term)) return true
      const deptEmployees = employees?.filter((e) => e.departmentId === dept.id) ?? []
      return deptEmployees.some((e) => e.name.toLowerCase().includes(term) || e.position.toLowerCase().includes(term))
    })
  }, [filteredDepts, searchTerm, employeeMap, employees])

  const searchFilteredUnassigned = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return unassignedEmployees
    return unassignedEmployees.filter(
      (e) => e.name.toLowerCase().includes(term) || e.position.toLowerCase().includes(term),
    )
  }, [unassignedEmployees, searchTerm])

  const isLoading = loadingEmployees || loadingDepartments

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <OrgChartIcon className="w-6 h-6 text-amber-500" />
            {t('page.org_chart')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Company hierarchy, departmental teams, and reporting lines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-60">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${t('action.search')}...`}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Departments</option>
            {departments?.map((dept) => (
              <option key={dept.id} value={dept.id.toString()}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Expand/Collapse */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-700 text-xs">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading organization tree...</div>
      ) : (
        <div className="space-y-8">
          {/* Top Level: Company Headquarters */}
          <div className="flex flex-col items-center">
            <div className="px-6 py-3.5 bg-amber-500 text-white font-semibold rounded-2xl shadow-md border-2 border-amber-600 text-center max-w-sm">
              <div className="text-base font-bold tracking-wide">Collabee Executive Leadership</div>
              <div className="text-xs text-amber-100 mt-0.5">
                {employees?.length ?? 0} Team Members across {departments?.length ?? 0} Departments
              </div>
            </div>
            <div className="w-0.5 h-8 bg-amber-400 dark:bg-amber-600 my-1"></div>
          </div>

          {/* Department Branches */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchFilteredDepts.map((dept) => {
              const manager = dept.managerId ? employeeMap.get(dept.managerId) : null
              const deptMembers = (employees ?? []).filter(
                (e) => e.departmentId === dept.id && e.id !== dept.managerId,
              )
              const isCollapsed = collapsedDepts[dept.id] ?? false

              return (
                <div
                  key={dept.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
                >
                  {/* Department Banner */}
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-amber-50/30 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">{dept.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {deptMembers.length + (manager ? 1 : 0)} members
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCollapse(dept.id)}
                      className="text-xs px-2.5 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                      aria-label="Toggle department team members"
                    >
                      {isCollapsed ? 'Show' : 'Hide'}
                    </button>
                  </div>

                  {/* Manager Card */}
                  <div className="p-4 border-b border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                      Department Lead / Manager
                    </div>
                    {manager ? (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
                        {manager.avatarUrl ? (
                          <img
                            src={manager.avatarUrl}
                            alt={manager.name}
                            className="w-10 h-10 rounded-full object-cover border border-amber-300"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                            {manager.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {manager.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{manager.position}</p>
                          <p className="text-[11px] text-gray-400 truncate">{manager.email}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg text-center">
                        No manager assigned
                      </div>
                    )}
                  </div>

                  {/* Team Members */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-2 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        Team Members ({deptMembers.length})
                      </div>
                      {deptMembers.length === 0 ? (
                        <div className="text-xs text-gray-400 italic text-center py-3">No other team members</div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {deptMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 text-xs"
                            >
                              {member.avatarUrl ? (
                                <img
                                  src={member.avatarUrl}
                                  alt={member.name}
                                  className="w-7 h-7 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center font-medium text-xs">
                                  {member.name[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{member.position}</p>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  member.status === 'active'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {member.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Unassigned Employees section if any */}
          {searchFilteredUnassigned.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-dashed border-gray-300 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-3 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                Unassigned Members ({searchFilteredUnassigned.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {searchFilteredUnassigned.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold">
                      {emp.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{emp.position}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
