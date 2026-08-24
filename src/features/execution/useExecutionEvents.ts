import { useEffect, useReducer, useRef } from 'react'
import { streamExecutionEvents } from '../../entities/execution/api'
import { applyExecutionEvents, executionTimelineReducer } from './reducer'
import type { ExecutionEvent, ExecutionTimelineState } from './model'
import { isTerminalExecutionEvent, toTimelineEvent, type StepLabelResolver } from './eventAdapter'
import type { ExecutionStreamEvent } from '../../entities/execution/api'

interface UseExecutionEventsOptions {
  executionId: string
  initialEvents: readonly ExecutionEvent[]
  labelForVersion?: StepLabelResolver
  onEvent?: () => void
  onSessionEnd?: () => void
}

const reconnectDelayMs = 1_000

export interface ExecutionStreamLoopOptions {
  onConnection: (status: 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error', error?: unknown) => void
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

export function useExecutionEvents({
  executionId,
  initialEvents,
  labelForVersion,
  onEvent,
  onSessionEnd,
}: UseExecutionEventsOptions): ExecutionTimelineState {
  const timelineExecutionId = useRef(executionId)
  const streamGeneration = useRef(0)
  const [timeline, dispatch] = useReducer(
    executionTimelineReducer,
    undefined,
    () => applyExecutionEvents(initialEvents),
  )
  useEffect(() => {
    if (timelineExecutionId.current !== executionId) {
      timelineExecutionId.current = executionId
      dispatch({ type: 'reset', state: applyExecutionEvents(initialEvents) })
      return
    }

    dispatch({ type: 'snapshot', events: initialEvents })
  }, [executionId, initialEvents])

  useEffect(() => {
    const generation = ++streamGeneration.current
    const controller = new AbortController()
    void runExecutionStreamLoop(executionId, {
      signal: controller.signal,
      onSessionEnd,
      onEvent: (event) => {
        if (streamGeneration.current !== generation) return
        dispatch({ type: 'event', event: toTimelineEvent(event, labelForVersion) })
        onEvent?.()
      },
      onConnection: (status, error) => {
        if (streamGeneration.current !== generation) return
        dispatch({
          type: 'connection',
          status,
          error: status === 'error'
            ? { code: 'SSE_CONNECTION_LOST', message: '실시간 연결이 끊겼습니다. 다시 연결합니다.', retryable: true }
            : error instanceof Error
              ? { message: error.message }
              : undefined,
        })
      },
    })
    return () => {
      streamGeneration.current += 1
      controller.abort()
    }
  }, [executionId, labelForVersion, onEvent, onSessionEnd])

  return timeline
}
