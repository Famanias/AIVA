const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 });

async function run() {
  console.log("Cleaning job_events...");
  const res1 = await supabase.from('job_events').delete().not('id', 'is', null);
  if (res1.error) console.error(res1.error);
  
  console.log("Cleaning jobs...");
  const res2 = await supabase.from('jobs').delete().not('id', 'is', null);
  if (res2.error) console.error(res2.error);
  
  console.log("Cleaning projects...");
  const res3 = await supabase.from('projects').delete().not('id', 'is', null);
  if (res3.error) console.error(res3.error);
  
  console.log("Database cleaned.");
  
  console.log("Flushing Redis queues...");
  await redis.flushall();
  console.log("Redis flushed.");
  
  process.exit(0);
}

run();
