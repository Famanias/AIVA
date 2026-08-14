import { spawn } from 'child_process'
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

const workerProcess = spawn(
  pythonExe,
  ['-m', 'uvicorn', 'app.main:create_app', '--factory', '--host', '0.0.0.0', '--port', '8000', '--reload'],
  {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, PYTHONPATH: __dirname }
  }
)

workerProcess.on('error', (err) => {
  console.error('[aiva-workers] Failed to start Python worker:', err)
})

workerProcess.on('exit', (code, signal) => {
  console.log(`[aiva-workers] Worker exited with code ${code}, signal ${signal}`)
})

process.on('SIGINT', () => {
  workerProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  workerProcess.kill('SIGTERM')
  process.exit(0)
})
