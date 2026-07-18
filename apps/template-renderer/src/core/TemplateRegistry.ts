import { IRenderingTemplate } from '../templates/IRenderingTemplate'

class TemplateRegistry {
  private templates = new Map<string, IRenderingTemplate>()

  register(template: IRenderingTemplate) {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with ID ${template.id} is already registered.`)
    }
    this.templates.set(template.id, template)
  }

  resolve(templateId: string): IRenderingTemplate {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}. Available templates: ${Array.from(this.templates.keys()).join(', ')}`)
    }
    return template
  }
}

export const templateRegistry = new TemplateRegistry()
