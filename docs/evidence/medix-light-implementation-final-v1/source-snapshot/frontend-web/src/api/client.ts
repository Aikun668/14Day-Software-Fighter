// J013 API 客户端：支持 Bearer Token 注入、401 处理、错误体解析。
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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
  const token = tokenGetter?.() ?? null
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body = await res.json().catch(() => null)

  if (res.status === 401) {
    // 登录接口自身的 401 表示账号或密码错误，不是会话失效，不能触发跳转
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
}
