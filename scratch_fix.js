const fs = require('fs');
const path = require('path');

const handlersDir = path.join(__dirname, 'apps/web/src/services/pipeline/handlers');
const files = [
  'ScriptHandler.ts',
  'VoiceoverHandler.ts',
  'SubtitleHandler.ts',
  'AssetHandler.ts',
  'CompositionHandler.ts',
  'RenderHandler.ts'
];

for (const file of files) {
  const filePath = path.join(handlersDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix imports
  content = content.replace(
    /import \{ WorkerGateway \} from '\.\.\/WorkerGateway'/,
    "import { workerGateway } from '../WorkerGateway'"
  );

  // Fix BaseHandler signature
  content = content.replace(
    /async execute\(context: PipelineContext\): Promise<void> \{/,
    "async execute(context: PipelineContext): Promise<string | null> {"
  );

  // Fix context.getState()
  content = content.replace(/const state = context\.getState\(\)/g, "const state = context.state");

  // Fix context.log()
  content = content.replace(/context\.log\(/g, "await context.logger.info(");

  // Fix WorkerGateway.post
  content = content.replace(
    /await WorkerGateway\.post\(([^,]+),\s*\{([\s\S]*?)\},\s*\{\s*timeoutMs:\s*([^}]+)\s*\}\)/g,
    (match, url, payloadStr, timeout) => {
      // For RenderHandler special case where url is a template string
      if (url.includes('renderUrl')) {
        return `await workerGateway.execute<any>(${url}, {\n${payloadStr}}, ${timeout.trim()})`;
      }
      return `await workerGateway.execute<any>(${url}, {\n${payloadStr}}, ${timeout.trim()})`;
    }
  );

  // Fix state.project properties that might need fallback
  content = content.replace(/state\.project\.video_style/g, "state.project.video_style || 'stickman'");
  content = content.replace(/state\.project\.duration_target_minutes/g, "state.project.duration_target_minutes || 3");

  // Replace trace_id: state.job.id etc with proper fallback
  content = content.replace(/trace_id:\s*state\.job\.id/g, "trace_id: context.job.id");
  content = content.replace(/project_id:\s*state\.project\.id/g, "project_id: context.project.id");
  content = content.replace(/workspace_id:\s*'default'/g, "workspace_id: context.project.workspace_id");
  content = content.replace(/topic:\s*state\.project\.topic/g, "topic: context.project.topic");

  // Fix context.updateState(updatedState)
  content = content.replace(
    /context\.updateState\(([^)]+)\)/g,
    "Object.assign(context.state, $1)"
  );
  
  // Return next stage
  if (file === 'ScriptHandler.ts') content = content.replace(/}\s*$/, "  return 'voiceover'\n  }\n}");
  if (file === 'VoiceoverHandler.ts') content = content.replace(/}\s*$/, "  return 'subtitle_extraction'\n  }\n}");
  if (file === 'SubtitleHandler.ts') content = content.replace(/}\s*$/, "  return 'scene_preview'\n  }\n}"); // Or whatever is next
  if (file === 'AssetHandler.ts') content = content.replace(/}\s*$/, "  return 'composition'\n  }\n}");
  if (file === 'CompositionHandler.ts') content = content.replace(/}\s*$/, "  return 'rendering'\n  }\n}");
  if (file === 'RenderHandler.ts') content = content.replace(/}\s*$/, "  return 'thumbnail'\n  }\n}");

  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
}
