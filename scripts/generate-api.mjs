import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const input = process.env.AGENTSTORE_OPENAPI ?? '../../IdeaProjects/agent-store-be/openapi/openapi.json'
const generator = fileURLToPath(new URL('../node_modules/@hey-api/openapi-ts/bin/run.js', import.meta.url))
const child = spawn(
  process.execPath,
  [generator, '-i', input, '-o', 'src/generated', '--client', '@hey-api/client-fetch'],
  { stdio: 'inherit', shell: false },
)

child.on('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal)
  }
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(`Unable to start OpenAPI generator: ${error.message}`)
  process.exit(1)
})
