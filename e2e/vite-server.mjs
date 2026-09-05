import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], {
  env: {
    ...process.env,
    VITE_API_BASE_URL: 'http://127.0.0.1:18080',
  },
  shell: true,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT', () => child.kill('SIGINT'))
