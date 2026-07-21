const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
    .select('*, projects(*)')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    console.error('Error fetching job:', error);
    return;
  }

  const state = job.state_payload || {};
  
  if (!state.voice?.subtitles || !state.scenes) {
    console.error('Missing subtitles or scenes in job state!');
    return;
  }

  let style = job.projects?.video_style || 'stickman';
  if (style === 'stickman_animation') style = 'stickman';

  const ir = {
    version: 1,
    templateFamily: style,
    metadata: {
      projectId: job.project_id,
      jobId: job.id,
      topic: job.projects?.topic || ''
    },
    voice: {
      wordTimings: state.voice.subtitles,
      audioUrl: state.voice.audioUrl
    },
    scenes: state.scenes.map(s => ({
      id: s.id,
      text: s.text,
      visual_type: s.visual_type,
      action: s.action,
      transition: s.transition,
      assetUrl: s.assetUrl
    }))
  };

  console.log('Sending IR payload to Template Renderer...');
  
  try {
    const res = await fetch('http://localhost:3001/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ir)
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Renderer failed: ${res.status} ${text}`);
    }
    
    const data = await res.json();
    console.log('Rendering completed!');
    console.log('Output Video URL:', data.result.outputs?.video);
    
    // Update state payload manually to include the render URL
    state.render = {
      outputUrl: data.result.outputs?.video,
      metrics: data.result.metrics,
      completedAt: new Date().toISOString()
    };
    
    await supabase.from('jobs').update({
      state_payload: state,
      current_step: 'completed',
      progress: 100,
      updated_at: new Date().toISOString()
    }).eq('id', job.id);
    
    await supabase.from('projects').update({
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', job.project_id);
    
    console.log('Successfully saved render state to database!');
  } catch (err) {
    console.error('Error rendering:', err);
  }
}

run();
