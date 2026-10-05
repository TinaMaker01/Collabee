export function exportCsv<T extends object>(data: T[], filename: string, columnLabels: Record<string, string>): void {
  const dataObj = data as Record<string, unknown>[]
  const keys = Object.keys(columnLabels)
  const header = keys.map((k) => columnLabels[k]).join(',')
  const rows = dataObj.map((item) =>
    keys
      .map((key) => {
        const val = item[key]
        if (val === null || val === undefined) return ''
        const str = typeof val === 'object' ? JSON.stringify(val) : `${val as string | number | boolean}`
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
