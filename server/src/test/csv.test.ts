import { describe, it, expect } from 'vitest'
import { parseCsv } from '../utils/csv.js'

describe('RFC 4180 CSV Parser', () => {
  it('should parse standard comma-separated values', () => {
    const csv = 'name,email,position\nAlice,alice@example.com,Developer\nBob,bob@example.com,Designer'
    const result = parseCsv<{ name: string; email: string; position: string }>(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Alice', email: 'alice@example.com', position: 'Developer' })
    expect(result[1]).toEqual({ name: 'Bob', email: 'bob@example.com', position: 'Designer' })
  })

  it('should handle quoted fields containing commas', () => {
    const csv = 'name,notes\n"Dupont, Jean","Note with, comma"'
    const result = parseCsv<{ name: string; notes: string }>(csv)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Dupont, Jean')
    expect(result[0].notes).toBe('Note with, comma')
  })

  it('should handle escaped double quotes', () => {
    const csv = 'name,quote\nAlice,"She said ""Hello world!"""'
    const result = parseCsv<{ name: string; quote: string }>(csv)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
    expect(result[0].quote).toBe('She said "Hello world!"')
  })

  it('should handle CRLF (Windows) and LF (Unix) newlines', () => {
    const csv = 'name,email\r\nAlice,alice@test.com\r\nBob,bob@test.com\n'
    const result = parseCsv<{ name: string; email: string }>(csv)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
  })

  it('should ignore empty lines and whitespace lines', () => {
    const csv = '\n\nname,email\n\nAlice,alice@test.com\n   \nBob,bob@test.com\n\n'
    const result = parseCsv<{ name: string; email: string }>(csv)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
  })

  it('should return empty array for empty string', () => {
    const result = parseCsv('')
    expect(result).toEqual([])
  })
})
