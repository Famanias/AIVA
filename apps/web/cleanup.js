const Redis = require('ioredis');
const fs = require('fs');

const envFile = fs.readFileSync('../../.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.join('=').trim().replace(/(^'|'$|^"|"$)/g, '');
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function query(table) {
  const url = `${supabaseUrl}/rest/v1/${table}?id=not.is.null`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to delete ${table}:`, res.status, err);
  } else {
    console.log(`Deleted ${table} successfully`);
  }
}

async function run() {
  console.log("Cleaning database...");
  await query('job_events');
  await query('jobs');
  await query('projects');
  
  console.log("Database cleaned.");
  
  const redis = new Redis({ host: env.REDIS_HOST || '127.0.0.1', port: env.REDIS_PORT || 6379 });
  console.log("Flushing Redis queues...");
  await redis.flushall();
  console.log("Redis flushed.");
  
  process.exit(0);
}

run();
