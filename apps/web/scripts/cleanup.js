const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Polyfill WebSocket for Supabase client in Node 20 (since we only use REST)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

// Manually parse .env file
const envPath = 'd:\\repos\\AIVA\\.env';
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    // Ignore comments
    if (line.trim().startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} else {
  console.log(`Could not find .env at ${envPath}`);
}

async function cleanup() {
  console.log('Starting cleanup...');
  
  // 1. Clear Redis (BullMQ queue)
  try {
    console.log('Connecting to Redis at localhost:6379...');
    const redis = new Redis({ host: 'localhost', port: 6379 });
    await redis.flushall();
    console.log('✅ Flushed all Redis queues.');
    redis.disconnect();
  } catch (err) {
    console.error('❌ Failed to clear Redis:', err.message);
  }

  // 2. Clear Supabase Database
  try {
    console.log('Connecting to Supabase...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env. URL: ${supabaseUrl}, KEY: ${supabaseKey}`);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    console.log('Deleting all projects (and cascading child records)...');
    
    await supabase.from('pipeline_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('job_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('scene_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('scenes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('cost_ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data, error } = await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error('❌ Failed to delete projects:', error.message);
    } else {
      console.log('✅ Cleaned up database tables.');
    }
  } catch (err) {
    console.error('❌ Failed to clean up database:', err.message);
  }
  
  console.log('Cleanup complete!');
}

cleanup();
