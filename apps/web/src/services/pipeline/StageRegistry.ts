import { BaseHandler } from './handlers/BaseHandler'
import { ResearchHandler } from './handlers/ResearchHandler'
import { OutlineHandler } from './handlers/OutlineHandler'
import { ScriptHandler } from './handlers/ScriptHandler'
import { VoiceoverHandler } from './handlers/VoiceoverHandler'
import { SubtitleHandler } from './handlers/SubtitleHandler'
import { RenderHandler } from './handlers/RenderHandler'
import { AssetHandler } from './handlers/AssetHandler'
import { CompositionHandler } from './handlers/CompositionHandler'

/**
 * StageRegistry replaces massive switch statements.
 * It maps the `job_step` string from the database to the specific handler class.
 * Adding a new stage is as simple as creating the handler and adding it here.
 */
class StageRegistry {
  private handlers = new Map<string, BaseHandler>()

  constructor() {
    // Register all known handlers
    this.handlers.set('research', new ResearchHandler())
    this.handlers.set('outline', new OutlineHandler())
    this.handlers.set('script_direction', new ScriptHandler())
    this.handlers.set('voiceover', new VoiceoverHandler())
    this.handlers.set('subtitle_extraction', new SubtitleHandler())
    this.handlers.set('assets', new AssetHandler())
    this.handlers.set('rendering', new RenderHandler())
    this.handlers.set('composition', new CompositionHandler())
  }

  getHandler(step: string): BaseHandler {
    const handler = this.handlers.get(step)
    if (!handler) {
      throw new Error(`No handler registered for pipeline step: ${step}`)
    }
    return handler
  }
}

export const stageRegistry = new StageRegistry()
