// Entry point for Template auto-discovery and Remotion bundling
import { templateRegistry } from '../core/TemplateRegistry'
import { DocumentaryTemplate } from './ken-burns/DocumentaryTemplate'
import { StickmanTemplate } from './character-rig/StickmanTemplate'

// Auto-register available templates
templateRegistry.register(new DocumentaryTemplate())
templateRegistry.register(new StickmanTemplate())

// This file is also the entryPoint for the Remotion bundler
// In a full implementation, we export the React components Remotion expects here
// export const RemotionRoot = () => { ... }
