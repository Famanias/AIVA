import { execSync } from 'child_process'
import fs from 'fs'

const API_BASE = 'http://localhost:3000'

async function run() {
  console.log('=====================================================')
  console.log('🚀 AIVA Video Generation: Custom Script Pipeline Test')
  console.log('=====================================================\n')

  const customScript = 
`Think caffeine gives you energy? Think again. 
Caffeine does not create energy. It only blocks adenosine, the molecule that signals fatigue to your brain. 
While adenosine continues accumulating in the background, you feel alert. 
When caffeine inevitably metabolizes, that backlog of exhaustion crashes in all at once. 
That is why you crash.`

  const payload = {
    topic: "The Truth About Caffeine and Energy",
    style: "stickman_animation",
    input_mode: "custom_script",
    custom_script: customScript,
    aspect_ratio: "9:16",
    duration_target_seconds: 30,
    voice_id: "en-US-AriaNeural",
    persona: "Informative"
  }

  console.log('Sending request to POST /api/v1/projects...')
  const createRes = await fetch(`${API_BASE}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!createRes.ok) {
    const errorText = await createRes.text()
    throw new Error(`Failed to create project: ${createRes.status} ${errorText}`)
  }

  const { project, job } = await createRes.json()
  console.log(`✅ Project created: ${project.id}`)
  console.log(`✅ Job created:     ${job.id}`)
  console.log(`Initial Stage:     ${job.current_step}\n`)

  console.log('--- Real-time Pipeline Monitor ---')

  let seenLogs = new Set()
  let currentStage = ''
  let progress = 0
  let isDone = false
  let attempts = 0
  const maxAttempts = 240 // 4 minutes max

  while (!isDone && attempts < maxAttempts) {
    attempts++
    await new Promise(r => setTimeout(r, 1500))

    try {
      const eventsRes = await fetch(`${API_BASE}/api/v1/jobs/${job.id}/events`)
      if (!eventsRes.ok) {
        continue
      }

      const { data } = await eventsRes.json()
      const currentJob = data.job
      const currentProject = data.project
      const logs = data.logs || []

      // Print new logs in chronological order
      const sortedLogs = [...logs].reverse()
      for (const l of sortedLogs) {
        const logKey = `${l.created_at}_${l.message}`
        if (!seenLogs.has(logKey)) {
          seenLogs.add(logKey)
          const time = new Date(l.created_at).toLocaleTimeString()
          console.log(`[${time}] [${l.level.toUpperCase()}] [${l.step || 'pipeline'}] ${l.message}`)
        }
      }

      if (currentJob.current_step !== currentStage || currentJob.progress !== progress) {
        currentStage = currentJob.current_step
        progress = currentJob.progress
        console.log(`--> Status: Stage [${currentStage}] | Progress: ${progress}%`)
      }

      if (currentProject.status === 'completed' || currentJob.progress === 100) {
        isDone = true
        console.log('\n🎉 Pipeline execution completed successfully!')
        
        const statePayload = typeof currentJob.state_payload === 'string' 
          ? JSON.parse(currentJob.state_payload) 
          : currentJob.state_payload

        const outputUrl = statePayload?.composition?.outputUrl || currentProject.video_url
        console.log(`\n=====================================================`)
        console.log(`📹 FINAL OUTPUT LOCATION:`)
        console.log(`   ${outputUrl}`)
        console.log(`=====================================================\n`)

        if (outputUrl && fs.existsSync(outputUrl)) {
          const stats = fs.statSync(outputUrl)
          console.log(`File Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`)
          
          try {
            const ffprobeOut = execSync(`ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate -of json "${outputUrl}"`).toString()
            const probeData = JSON.parse(ffprobeOut)
            console.log('Video Probe Details:')
            console.log(`- Format Duration: ${probeData.format?.duration} seconds`)
            console.log(`- Streams:`)
            for (const s of probeData.streams || []) {
              console.log(`  * ${s.codec_name} (${s.width ? `${s.width}x${s.height}` : 'audio'}, fps: ${s.r_frame_rate || 'N/A'})`)
            }
          } catch (probeErr) {
            console.warn('ffprobe check skipped:', probeErr.message)
          }
        }
        break
      }

      if (currentProject.status === 'cancelled' || currentProject.status === 'failed') {
        throw new Error(`Pipeline stopped with status: ${currentProject.status}. Error log: ${currentJob.error_log || 'N/A'}`)
      }

    } catch (err) {
      if (err.message.includes('Pipeline stopped')) {
        throw err
      }
      console.warn(`[Poll Warning]: ${err.message}`)
    }
  }

  if (!isDone) {
    throw new Error('Pipeline timed out after 4 minutes.')
  }
}

run().catch(err => {
  console.error('\n❌ Execution Error:', err)
  process.exit(1)
})
