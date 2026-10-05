const BASE_URL: string = (import.meta.env.VITE_API_URL as string) || '/api'

class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  if (res.status === 204) {
    return undefined as unknown as T
  }

  const contentType = res.headers.get('content-type') || ''
  let data: unknown
  if (contentType.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  } else {
    data = await res.text()
  }

  if (!res.ok) {
    if (typeof data === 'object' && data !== null) {
      const err = data as { error?: { code?: string; message?: string; details?: unknown } }
      throw new ApiError(
        res.status,
        err.error?.code || 'UNKNOWN',
        err.error?.message || res.statusText,
        err.error?.details,
      )
    }
    throw new ApiError(res.status, 'HTTP_ERROR', typeof data === 'string' && data ? data : res.statusText)
  }

  return data as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body)
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body)
}

export function del<T>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}

export { ApiError }
