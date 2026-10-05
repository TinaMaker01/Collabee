import { describe, it, expect } from 'vitest'
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
