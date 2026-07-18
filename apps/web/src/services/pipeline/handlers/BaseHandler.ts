import { PipelineContext } from '../PipelineContext'

/**
 * The base contract for all pipeline stage handlers.
 * Ensures that every stage implements a consistent execution interface
 * and provides its own strict timeout.
 */
export abstract class BaseHandler {
  /**
   * The maximum time (in milliseconds) this specific stage is allowed to run
   * before the WorkerGateway forcibly aborts it.
   */
  abstract getTimeoutMs(): number

  /**
   * Executes the stage logic.
   * Modifies the context.state directly (which the executor will persist).
   * 
   * @param context The pipeline context for this job
   * @returns The name of the next stage to transition to, or null if complete
   */
  abstract execute(context: PipelineContext): Promise<string | null>
}
