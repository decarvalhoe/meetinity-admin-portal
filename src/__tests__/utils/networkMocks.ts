import { vi } from 'vitest'

export interface WebSocketMockController {
  emit: (payload: unknown) => void
  reset: () => void
  setReadyState: (state: number) => void
  setConnectionAttempts: (attempts: number) => void
  subscriberCount: () => number
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

interface WebSocketMockOptions {
  readyState?: number
  connectionAttempts?: number
}

export function createMockWebSocket(options: WebSocketMockOptions = {}) {
  const subscribers = new Set<(event: MessageEvent) => void>()
  const send = vi.fn()
  const close = vi.fn()
  let readyState = options.readyState ?? 1
  let connectionAttempts = options.connectionAttempts ?? 0

  const module = {
    useWebSocket: () => ({
      get readyState() {
        return readyState
      },
      connectionAttempts,
      subscribe(handler: (event: MessageEvent) => void) {
        subscribers.add(handler)
        return () => {
          subscribers.delete(handler)
        }
      },
      send,
      close
    })
  }

  const emit = (payload: unknown) => {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
    subscribers.forEach(handler =>
      handler({
        data: message
      } as MessageEvent)
    )
  }

  const reset = () => {
    subscribers.clear()
    send.mockReset()
    close.mockReset()
  }

  const setReadyState = (state: number) => {
    readyState = state
  }

  const setConnectionAttempts = (attempts: number) => {
    connectionAttempts = attempts
  }

  return {
    module,
    controller: {
      emit,
      reset,
      setReadyState,
      setConnectionAttempts,
      subscriberCount: () => subscribers.size,
      send,
      close
    } satisfies WebSocketMockController
  }
}

export interface AxiosMockController {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
  reset: () => void
  createError: (message: string, response?: { status?: number; data?: Record<string, unknown> }) => Error
}

export function createMockAxios() {
  const request = vi.fn()
  const get = vi.fn()
  const post = vi.fn()
  const put = vi.fn()
  const patch = vi.fn()
  const destroy = vi.fn()

  class MockAxiosError<T = unknown> extends Error {
    public response?: { status?: number; data?: T }
    public isAxiosError = true

    constructor(message: string, response?: { status?: number; data?: T }) {
      super(message)
      this.name = 'AxiosError'
      this.response = response
    }
  }

  const isAxiosError = (error: unknown): error is MockAxiosError =>
    typeof error === 'object' && error !== null && 'isAxiosError' in error

  const axiosInstance = Object.assign(request, {
    get,
    post,
    put,
    patch,
    delete: destroy,
    request,
    isAxiosError
  })

  const create = vi.fn(() => axiosInstance)
  axiosInstance.create = create

  const module = {
    __esModule: true as const,
    default: axiosInstance,
    AxiosError: MockAxiosError,
    isAxiosError,
    get,
    post,
    put,
    patch,
    delete: destroy,
    request,
    create
  }

  const reset = () => {
    request.mockReset()
    get.mockReset()
    post.mockReset()
    put.mockReset()
    patch.mockReset()
    destroy.mockReset()
    create.mockReset()
  }

  const createError = (message: string, response?: { status?: number; data?: Record<string, unknown> }) =>
    new MockAxiosError(message, response)

  return {
    module,
    controller: {
      get,
      post,
      put,
      patch,
      delete: destroy,
      request,
      reset,
      createError
    } satisfies AxiosMockController
  }
}
