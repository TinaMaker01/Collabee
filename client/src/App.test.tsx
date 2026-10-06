import { describe, it, expect, vi } from 'vitest'
import './i18n'
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
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
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
    spy.mockRestore()
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

describe('React Component Unit Tests', () => {
  it('LoadingSpinner renders with role=status and accessible text', async () => {
    const { default: LoadingSpinner } = await import('./components/LoadingSpinner')
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(<LoadingSpinner size="lg" />)
    })

    const statusEl = container.querySelector('[role="status"]')
    expect(statusEl).not.toBeNull()
    expect(container.textContent).toContain('Loading...')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('NotFound renders 404 header and link', async () => {
    const { default: NotFound } = await import('./pages/NotFound')
    const { MemoryRouter } = await import('react-router-dom')
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('404')
    expect(container.textContent).toContain('Page Not Found')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})

