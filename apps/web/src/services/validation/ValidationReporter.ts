import fs from 'fs'
import path from 'path'

export interface StageMetrics {
  durationMs: number
  retries: number
  errors: string[]
  passed: boolean
}

export class ValidationReporter {
  static writeReport(jobId: string, topic: string, metrics: Record<string, StageMetrics>, totalDurationMs: number) {
    const reportPath = path.join(process.cwd(), '.artifacts', jobId, 'validation_report.md')
    
    let totalErrors = 0
    let markdown = `# Pipeline Validation Report\n\n`
    markdown += `**Job ID**: ${jobId}\n`
    markdown += `**Topic**: ${topic}\n`
    markdown += `**Total Runtime**: ${(totalDurationMs / 1000).toFixed(1)} sec\n\n`
    
    markdown += `## Stage Metrics\n\n`
    markdown += `| Stage | Status | Duration (s) | Retries | Errors |\n`
    markdown += `|-------|--------|--------------|---------|--------|\n`

    const stages = ['research', 'outline', 'script_direction', 'voiceover', 'subtitle_extraction', 'assets', 'renderer_compatibility']
    
    stages.forEach(stage => {
      const metric = metrics[stage]
      if (metric) {
        const status = metric.passed ? '✅ PASS' : '❌ FAIL'
        markdown += `| ${stage} | ${status} | ${(metric.durationMs / 1000).toFixed(1)} | ${metric.retries} | ${metric.errors.length} |\n`
        totalErrors += metric.errors.length
      } else {
        markdown += `| ${stage} | ⏭️ SKIP | - | - | - |\n`
      }
    })

    markdown += `\n## Summary\n`
    markdown += `- **Errors**: ${totalErrors}\n`
    
    if (totalErrors > 0) {
      markdown += `\n### Error Details\n`
      stages.forEach(stage => {
        const metric = metrics[stage]
        if (metric && metric.errors.length > 0) {
          markdown += `**${stage}**\n`
          metric.errors.forEach(e => markdown += `- ${e}\n`)
          markdown += `\n`
        }
      })
    }

    fs.writeFileSync(reportPath, markdown, 'utf8')
    console.log(`Validation Report generated at: ${reportPath}`)
  }
}
