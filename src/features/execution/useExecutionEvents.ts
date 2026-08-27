import { useEffect, useRef, useState } from 'react'
import { streamExecutionEvents } from '../../entities/execution/api'
import type { ExecutionStreamEvent } from '../../entities/execution/api'

interface UseExecutionEventsOptions {
  executionId: string
  refetch: () => Promise<unknown>
  terminal: boolean
}

export type ExecutionConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

const reconnectDelayMs = 1_000

function isTerminalExecutionEvent(type: string | undefined): boolean {
  return type === 'EXECUTION_COMPLETED'
    || type === 'EXECUTION_FAILED'
    || type === 'EXECUTION_RECONCILIATION_REQUIRED'
}

export interface ExecutionStreamLoopOptions {
  onConnection: (status: Exclude<ExecutionConnectionStatus, 'idle'>, error?: unknown) => void
  onEvent: (event: ExecutionStreamEvent) => void
  onSessionEnd?: () => void
  signal: AbortSignal
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timeout = window.setTimeout(finish, milliseconds)
    signal.addEventListener('abort', finish, { once: true })
  })
}

export async function runExecutionStreamLoop(
  executionId: string,
  options: ExecutionStreamLoopOptions,
): Promise<void> {
  let cursor: string | undefined
  let reconnecting = false
  const sleep = options.sleep ?? abortableDelay

  while (!options.signal.aborted) {
    options.onConnection(reconnecting ? 'reconnecting' : 'connecting')
    let latestType: string | undefined
    let streamError: unknown
    try {
      options.onConnection('connected')
      await streamExecutionEvents(executionId, {
        afterEventId: cursor,
        signal: options.signal,
        onError: (error) => { streamError = error },
        onEvent: (event) => {
          latestType = event.type
          if (event.id) cursor = event.id
          options.onEvent(event)
        },
      })
    } catch (error) {
      streamError = error
    }

    if (options.signal.aborted) return
    options.onSessionEnd?.()
    if (isTerminalExecutionEvent(latestType)) {
      options.onConnection('closed')
      return
    }

    reconnecting = true
    options.onConnection(streamError ? 'error' : 'reconnecting', streamError)
    await sleep(reconnectDelayMs, options.signal)
  }
}

/**
 * SSE is only an invalidation signal. ExecutionDto (including quoteSnapshot) remains
 * the single authoritative execution projection; event payloads never become UI state.
 */
export function useExecutionEvents({ executionId, refetch, terminal }: UseExecutionEventsOptions): ExecutionConnectionStatus {
  const streamGeneration = useRef(0)
  const [connection, setConnection] = useState<ExecutionConnectionStatus>('idle')

  useEffect(() => {
    const generation = ++streamGeneration.current
    if (terminal) return

    const controller = new AbortController()
    let refreshInFlight = false
    let refreshQueued = false
    const seenEventIds = new Set<string>()

    async function refreshCurrentExecution() {
      if (refreshInFlight) {
        refreshQueued = true
        return
      }
      refreshInFlight = true
      try {
        do {
          refreshQueued = false
          await refetch()
        } while (!controller.signal.aborted && streamGeneration.current === generation && refreshQueued)
      } finally {
        refreshInFlight = false
      }
    }

    void runExecutionStreamLoop(executionId, {
      signal: controller.signal,
      onEvent: (event) => {
        if (streamGeneration.current !== generation) return
        if (event.id && seenEventIds.has(event.id)) return
        if (event.id) seenEventIds.add(event.id)
        void refreshCurrentExecution()
      },
      onConnection: (status) => {
        if (streamGeneration.current !== generation) return
        setConnection(status)
      },
    })
    return () => {
      streamGeneration.current += 1
      controller.abort()
    }
  }, [executionId, refetch, terminal])

  return terminal ? 'closed' : connection
}
