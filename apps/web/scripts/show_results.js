const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Polyfill WebSocket for Supabase client in Node 20
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

// Manually parse .env file
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
  // Get the most recently updated project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*, jobs(*)')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return;
  }

  console.log('\n====================================');
  console.log('PROJECT STATUS:', project.status);
  console.log('TOPIC:', project.topic);
  console.log('====================================\n');
  
  if (project.jobs && project.jobs.length > 0) {
    const job = project.jobs[0];
    const state = job.state_payload;
    
    if (state) {
      console.log('RAW STATE PAYLOAD:');
      console.log(JSON.stringify(state, null, 2));
    } else {
      console.log('No state payload found.');
    }
  }
}

run();
