export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting background BullMQ worker...')
    const { startWorker } = await import('./lib/queue/worker')
    startWorker()
  }
}
