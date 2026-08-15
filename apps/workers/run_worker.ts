import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

function getPythonExecutable(): string {
  const winVenv = path.join(__dirname, 'venv', 'Scripts', 'python.exe')
  const unixVenv = path.join(__dirname, 'venv', 'bin', 'python')
  
  if (process.platform === 'win32' && fs.existsSync(winVenv)) {
    return winVenv
  }
  if (fs.existsSync(unixVenv)) {
    return unixVenv
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

const pythonExe = getPythonExecutable()
console.log(`[aiva-workers] Starting Python FastAPI Worker using: ${pythonExe}`)

let workerProcess: ChildProcess | null = null
let isShuttingDown = false

function startWorker() {
  if (isShuttingDown) return

  workerProcess = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'app.main:create_app', '--factory', '--host', '0.0.0.0', '--port', '8000', '--reload'],
    {
      cwd: __dirname,
      stdio: ['ignore', 'inherit', 'inherit'], // Prevent Windows "Terminate batch job (Y/N)?" stdin prompt block
      env: { ...process.env, PYTHONPATH: __dirname }
    }
  )

  workerProcess.on('error', (err) => {
    console.error('[aiva-workers] Failed to start Python worker:', err)
  })

  workerProcess.on('exit', (code, signal) => {
    console.log(`[aiva-workers] Worker exited with code ${code}, signal ${signal}`)
    if (!isShuttingDown) {
      console.log('[aiva-workers] Restarting Python worker in 1s...')
      setTimeout(startWorker, 1000)
    }
  })
}

startWorker()

process.on('SIGINT', () => {
  isShuttingDown = true
  if (workerProcess) workerProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  isShuttingDown = true
  if (workerProcess) workerProcess.kill('SIGTERM')
  process.exit(0)
})
