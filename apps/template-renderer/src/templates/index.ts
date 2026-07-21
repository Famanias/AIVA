// Entry point for Template auto-discovery and Remotion bundling
import { registerRoot } from 'remotion'
import { templateRegistry } from '../core/TemplateRegistry'
import { DocumentaryTemplate } from './ken-burns/DocumentaryTemplate'
import { StickmanTemplate } from './character-rig/StickmanTemplate'
import { Root } from './Root'

// Auto-register available templates
templateRegistry.register(new DocumentaryTemplate())
templateRegistry.register(new StickmanTemplate())

// This file is also the entryPoint for the Remotion bundler
registerRoot(Root)
