// J014 API 客户端：Bearer Token 注入、超时、断网拦截、401 清内存跳登录。
const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.233.77.4:8010'
const TIMEOUT_MS = 15000

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let tokenGetter: (() => string | null) | null = null
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn
}

// 401 时触发：清内存 token 并跳登录（由 AuthContext 注册）
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { skipAuthRedirect?: boolean },
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const token = tokenGetter?.() ?? null
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    if (res.status === 204) return undefined as T
    const body = await res.json().catch(() => null)
    if (res.status === 401) {
      // 登录接口自身的 401 表示账号或密码错误，不是会话失效
      if (!init?.skipAuthRedirect) {
        unauthorizedHandler?.()
      }
      const msg = body?.detail?.message || '未登录或会话已过期'
      const code = body?.detail?.code || 'UNAUTHORIZED'
      throw new ApiError(401, code, msg)
    }
    if (!res.ok) {
      const code = body?.detail?.code || body?.code || 'ERROR'
      const message = body?.detail?.message || body?.message || `请求失败（${res.status}）`
      throw new ApiError(res.status, code, message)
    }
    return body as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if ((e as Error).name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', '请求超时，请检查网络后重试')
    }
    // 断网：fetch 抛 TypeError，不假报成功
    throw new ApiError(0, 'NETWORK', '网络不可用，请检查连接后重试')
  } finally {
    clearTimeout(timer)
  }
}
