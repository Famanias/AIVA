const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Queue } = require('bullmq');
const Redis = require('ioredis');

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

const envPath = path.join(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    console.error('Error fetching job:', error);
    return;
  }

  console.log(`Resuming job ${job.id} at rendering stage...`);

  const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const pipelineQueue = new Queue('pipeline-queue', { connection });

  // Update DB back to rendering state
  await supabase.from('projects').update({ status: 'generating' }).eq('id', job.project_id);
  await supabase.from('jobs').update({ current_step: 'rendering' }).eq('id', job.id);

  const bullMqJobId = `${job.id}_rendering`;
  await pipelineQueue.add(
    'pipeline-job',
    { jobId: job.id, stepId: 'rendering' },
    {
      jobId: bullMqJobId,
      removeOnComplete: true,
      removeOnFail: false
    }
  );

  console.log('Enqueued rendering step in BullMQ.');
  process.exit(0);
}

run();
