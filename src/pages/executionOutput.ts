export function hasRenderableExecutionOutput(output: unknown): boolean {
  return output !== undefined && output !== null
}
