import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { AgentResponseFormat } from '../../entities/agent/model'
import { JsonCodeBlock } from '../../shared/ui/JsonCodeBlock'

interface ExecutionResultProps {
  output: unknown
  responseFormat?: AgentResponseFormat
}

interface StructuredSection {
  label: string
  value: string | number | boolean
}

interface StructuredOutput {
  title: string
  summary?: string
  sections: StructuredSection[]
}

export function ExecutionResult({ output, responseFormat }: ExecutionResultProps) {
  switch (responseFormat) {
    case 'TEXT':
      return typeof output === 'string' ? <p className="execution-result__text">{output}</p> : <JsonResult output={output} />
    case 'MARKDOWN':
      return typeof output === 'string' ? (
        <div className="execution-result__markdown">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
        </div>
      ) : <JsonResult output={output} />
    case 'STRUCTURED': {
      const structured = parseStructured(output)
      return structured ? <StructuredResult output={structured} /> : <JsonResult output={output} />
    }
    case 'JSON':
    default:
      return <JsonResult output={output} />
  }
}

function parseStructured(output: unknown): StructuredOutput | undefined {
  if (!isRecord(output) || typeof output.title !== 'string' || output.title.trim() === '' || !Array.isArray(output.sections) || output.sections.length === 0) {
    return undefined
  }
  if (output.summary !== undefined && typeof output.summary !== 'string') return undefined
  const sections: StructuredSection[] = []
  for (const section of output.sections) {
    if (!isRecord(section) || typeof section.label !== 'string' || section.label.trim() === '' || !isScalar(section.value)) {
      return undefined
    }
    sections.push({ label: section.label, value: section.value })
  }
  return {
    title: output.title,
    summary: typeof output.summary === 'string' ? output.summary : undefined,
    sections,
  }
}

function StructuredResult({ output }: { output: StructuredOutput }) {
  return (
    <article className="execution-result__structured">
      <h3>{output.title}</h3>
      {output.summary ? <p>{output.summary}</p> : null}
      <dl>
        {output.sections.map((section) => <div key={section.label}><dt>{section.label}</dt><dd>{String(section.value)}</dd></div>)}
      </dl>
    </article>
  )
}

function JsonResult({ output }: { output: unknown }) {
  return <JsonCodeBlock className="execution-result__json" label="JSON 결과" value={output} />
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
