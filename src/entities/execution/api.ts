import {
  getApiExecutionsById,
  getApiExecutionsByIdEvents,
  postApiExecutions,
  type PostApiExecutionsData,
  type ExecutionResponse,
} from '../../generated'
import type { AgentResponseFormat } from '../agent/model'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

export type CreateExecutionInput = PostApiExecutionsData['body']
export type ExecutionStepDto = Omit<ExecutionResponse['steps'][number], 'responseFormat'> & {
  responseFormat?: AgentResponseFormat
}
export type ExecutionDto = Omit<ExecutionResponse, 'steps'> & { steps: ExecutionStepDto[] }

export interface ExecutionStreamEvent {
  id?: string
  type?: string
  payload: unknown
}

export interface ExecutionStreamOptions {
  afterEventId?: string
  onError?: (error: unknown) => void
  onEvent: (event: ExecutionStreamEvent) => void
  signal: AbortSignal
}

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export function createExecution(input: CreateExecutionInput): Promise<ExecutionDto> {
  return withApiError(async () => {
    const response = await postApiExecutions({
      body: input,
      client: agentStoreClient,
      throwOnError: true,
    })
    return unwrapCommonResponse<ExecutionDto>(response.data)
  })
}

export function getExecution(id: string): Promise<ExecutionDto> {
  return withApiError(async () => {
    const response = await getApiExecutionsById({
      client: agentStoreClient,
      path: { id },
      throwOnError: true,
    })
    return unwrapCommonResponse<ExecutionDto>(response.data)
  })
}

/** Opens one SSE session. Reconnect policy belongs to the execution feature hook. */
export async function streamExecutionEvents(
  id: string,
  options: ExecutionStreamOptions,
): Promise<void> {
  const result = await getApiExecutionsByIdEvents({
    client: agentStoreClient,
    headers: options.afterEventId ? { 'last-event-id': options.afterEventId } : undefined,
    onSseError: options.onError,
    onSseEvent: (event) => options.onEvent({
      id: event.id,
      type: event.event,
      payload: event.data,
    }),
    path: { id },
    signal: options.signal,
    sseMaxRetryAttempts: 1,
  })

  for await (const payload of result.stream) {
    // Consuming the generated stream drives onSseEvent, which retains event name and ID.
    void payload
  }
}
