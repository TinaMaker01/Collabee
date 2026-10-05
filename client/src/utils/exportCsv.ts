function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return ''
  let str = typeof val === 'object' ? JSON.stringify(val) : `${val as string | number | boolean}`
  // Prevent CSV formula injection in spreadsheet software
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportCsv<T extends object>(data: T[], filename: string, columnLabels: Record<string, string>): void {
  const dataObj = data as Record<string, unknown>[]
  const keys = Object.keys(columnLabels)
  const header = keys.map((k) => sanitizeCsvField(columnLabels[k])).join(',')
  const rows = dataObj.map((item) => keys.map((key) => sanitizeCsvField(item[key])).join(','))
  const csv = [header, ...rows].join('\n')
  // \uFEFF is the UTF-8 BOM, ensuring correct accent rendering in Excel
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
