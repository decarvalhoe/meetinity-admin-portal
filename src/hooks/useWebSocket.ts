import { useCallback, useEffect, useRef, useState } from 'react'

export type WebSocketMessageHandler = (event: MessageEvent) => void

export interface UseWebSocketOptions {
  enabled?: boolean
  protocols?: string | string[]
  reconnectInterval?: number
  maxReconnectInterval?: number
  shouldReconnect?: (event: CloseEvent) => boolean
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
}

export interface UseWebSocketResult {
  readyState: number
  connectionAttempts: number
  subscribe: (handler: WebSocketMessageHandler) => () => void
  send: (data: Parameters<WebSocket['send']>[0]) => void
  close: () => void
}

const READY_STATE_UNINSTANTIATED = typeof WebSocket === 'undefined' ? 3 : WebSocket.CLOSED
const WS_OPEN_STATE = typeof WebSocket === 'undefined' ? 1 : WebSocket.OPEN

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    enabled = true,
    protocols,
    reconnectInterval = 2000,
    maxReconnectInterval = 15000,
    shouldReconnect,
    onOpen,
    onClose,
    onError
  } = options

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualCloseRef = useRef(false)
  const attemptsRef = useRef(0)
  const handlersRef = useRef(new Set<WebSocketMessageHandler>())
  const [readyState, setReadyState] = useState<number>(READY_STATE_UNINSTANTIATED)
  const [connectionAttempts, setConnectionAttempts] = useState(0)

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }

  const subscribe = useCallback((handler: WebSocketMessageHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const send = useCallback((data: Parameters<WebSocket['send']>[0]) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WS_OPEN_STATE) {
      throw new Error('Cannot send message while socket is not open')
    }
    socket.send(data)
  }, [])

  const close = useCallback(() => {
    manualCloseRef.current = true
    clearReconnectTimeout()
    socketRef.current?.close()
  }, [])

  useEffect(() => {
    if (!url || !enabled || typeof WebSocket === 'undefined') {
      return undefined
    }

    manualCloseRef.current = false

    const connect = () => {
      clearReconnectTimeout()

      try {
        const socket = new WebSocket(url, protocols)
        socketRef.current = socket
        setReadyState(socket.readyState)
        attemptsRef.current += 1
        setConnectionAttempts(attemptsRef.current)

        socket.onopen = event => {
          attemptsRef.current = 0
          setReadyState(socket.readyState)
          setConnectionAttempts(0)
          onOpen?.(event)
        }

        socket.onmessage = event => {
          handlersRef.current.forEach(handler => handler(event))
        }

        socket.onerror = event => {
          onError?.(event)
        }

        socket.onclose = event => {
          setReadyState(socket.readyState)
          onClose?.(event)

          const allowReconnect =
            !manualCloseRef.current &&
            enabled &&
            (shouldReconnect ? shouldReconnect(event) : event.code !== 1000)

          if (!allowReconnect) {
            return
          }

          const nextDelay = Math.min(
            maxReconnectInterval,
            reconnectInterval * Math.max(1, attemptsRef.current)
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            if (manualCloseRef.current) {
              return
            }
            connect()
          }, nextDelay)
        }
      } catch (error) {
        console.error('Failed to initialise WebSocket connection', error)
      }
    }

    connect()

    return () => {
      manualCloseRef.current = true
      clearReconnectTimeout()
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [url, enabled, protocols, reconnectInterval, maxReconnectInterval, shouldReconnect, onOpen, onClose, onError])

  return {
    readyState,
    connectionAttempts,
    subscribe,
    send,
    close
  }
}

