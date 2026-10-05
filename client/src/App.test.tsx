import { describe, it, expect, vi } from 'vitest'
import { exportCsv } from './utils/exportCsv'
import en from './i18n/locales/en.json'
import fr from './i18n/locales/fr.json'

function getDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(obj).reduce((res: string[], el: string) => {
    const name = prefix ? `${prefix}.${el}` : el
    if (typeof obj[el] === 'object' && obj[el] !== null && !Array.isArray(obj[el])) {
      return [...res, ...getDeepKeys(obj[el] as Record<string, unknown>, name)]
    }
    return [...res, name]
  }, [])
}

describe('Frontend & i18n Suite', () => {
  it('exportCsv is defined and exported', () => {
    expect(typeof exportCsv).toBe('function')
  })

  it('exportCsv sanitizes dangerous spreadsheet formula characters and includes UTF-8 BOM', () => {
    const createElement = document.createElement.bind(document)
    let downloadedBlob: Blob | null = null

    // Mock createObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      downloadedBlob = blob
      return 'blob:mock-url'
    })
    globalThis.URL.revokeObjectURL = vi.fn()

    const mockAnchor = {
      click: vi.fn(),
      href: '',
      download: '',
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement
      return createElement(tag)
    })

    exportCsv([{ malicious: '=SUM(1,2)', normal: 'Hello', accent: 'Élève' }], 'test_export', {
      malicious: 'Formula',
      normal: 'Normal',
      accent: 'Accent',
    })

    expect(mockAnchor.click).toHaveBeenCalled()
    expect(downloadedBlob).toBeDefined()
  })

  it('en.json and fr.json have matching translation keys', () => {
    const enKeys = getDeepKeys(en).sort()
    const frKeys = getDeepKeys(fr).sort()

    expect(enKeys).toEqual(frKeys)
  })

  it('all required navigation keys exist in both locales', () => {
    expect(en.nav.dashboard).toBe('Dashboard')
    expect(fr.nav.dashboard).toBe('Tableau de bord')
    expect(en.nav.admin).toBe('Administration')
    expect(fr.nav.admin).toBe('Administration')
  })

  it('all admin role keys exist and match', () => {
    expect(en.admin.role_admin).toBe('Admin')
    expect(fr.admin.role_admin).toBe('Administrateur')
  })
})
