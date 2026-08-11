/**
 * Thin fetch wrapper for the app's own API.
 *
 * Session tokens live in httpOnly cookies, so nothing here touches a token —
 * the browser attaches them. The wrapper's job is to normalise errors and to
 * transparently refresh an expired access token once before giving up.
 */

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Internal: prevents a refreshed request from refreshing again. */
  skipRefresh?: boolean
}

/** Endpoints that must never trigger a refresh attempt of their own. */
const NO_REFRESH_PATHS = ['/api/auth/refresh', '/api/auth/sign-in', '/api/auth/sign-up']

/**
 * Concurrent 401s share one refresh call, so a page issuing several requests
 * at once does not rotate the token pair several times over.
 */
let inFlightRefresh: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        inFlightRefresh = null
      })
  }
  return inFlightRefresh
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data.error === 'string') return data.error
  } catch {
    // Fall through to the generic message below.
  }
  return `Request failed with status ${response.status}.`
}

export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, skipRefresh = false }: ApiFetchOptions = {}
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (
    response.status === 401 &&
    !skipRefresh &&
    !NO_REFRESH_PATHS.includes(path)
  ) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiFetch<T>(path, { method, body, skipRefresh: true })
    }
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
