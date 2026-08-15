import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let rendererProcess: ChildProcess | null = null
let isShuttingDown = false

function startRenderer() {
  if (isShuttingDown) return

  console.log('[aiva-template-renderer] Starting Remotion Render Server on port 3001...')

  rendererProcess = spawn(
    'npx',
    ['ts-node', 'src/render-server.ts'],
    {
      cwd: __dirname,
      shell: true,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, PORT: '3001' }
    }
  )

  rendererProcess.on('error', (err) => {
    console.error('[aiva-template-renderer] Process error:', err)
  })

  rendererProcess.on('exit', (code, signal) => {
    console.log(`[aiva-template-renderer] Process exited with code ${code}, signal ${signal}`)
    if (!isShuttingDown) {
      console.log('[aiva-template-renderer] Restarting Render Server in 1.5s...')
      setTimeout(startRenderer, 1500)
    }
  })
}

startRenderer()

process.on('SIGINT', () => {
  isShuttingDown = true
  if (rendererProcess) rendererProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  isShuttingDown = true
  if (rendererProcess) rendererProcess.kill('SIGTERM')
  process.exit(0)
})
