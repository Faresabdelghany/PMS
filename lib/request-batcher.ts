/**
 * Request Batcher - Batches multiple requests into a single request
 * Improves INP by reducing network overhead and main thread blocking
 */

type BatchedRequest<T> = {
  id: string
  resolve: (value: T) => void
  reject: (error: Error) => void
}

class RequestBatcher<TInput, TOutput> {
  private readonly queue: Map<string, BatchedRequest<TOutput>> = new Map()
  private timer: NodeJS.Timeout | null = null
  private readonly batchFn: (inputs: Map<string, TInput>) => Promise<Map<string, TOutput>>
  private readonly wait: number

  constructor(
    batchFn: (inputs: Map<string, TInput>) => Promise<Map<string, TOutput>>,
    wait = 50 // 50ms debounce
  ) {
    this.batchFn = batchFn
    this.wait = wait
  }

  /**
   * Add a request to the batch queue
   */
  add(id: string, input: TInput): Promise<TOutput> {
    return new Promise<TOutput>((resolve, reject) => {
      // Add to queue
      this.queue.set(id, { id, resolve, reject })

      // Store input for later (we need to access it in flush)
      const inputsMap = this.getInputsMap()
      inputsMap.set(id, input)

      // Restart timer
      if (this.timer) {
        clearTimeout(this.timer)
      }

      this.timer = setTimeout(() => {
        this.flush(inputsMap)
      }, this.wait)
    })
  }

  /**
   * Flush the batch queue
   */
  private async flush(inputs: Map<string, TInput>) {
    if (this.queue.size === 0) return

    const currentQueue = new Map(this.queue)
    this.queue.clear()
    this.clearInputsMap()

    try {
      const results = await this.batchFn(inputs)

      // Resolve all promises with their results
      for (const [id, request] of currentQueue) {
        const result = results.get(id)
        if (result === undefined) {
          request.reject(new Error(`No result for ${id}`))
        } else {
          request.resolve(result)
        }
      }
    } catch (error) {
      // Reject all promises with the error
      for (const request of currentQueue.values()) {
        request.reject(error as Error)
      }
    }
  }

  // Temporary storage for inputs (cleared after flush)
  private readonly inputsStorage = new Map<string, TInput>()

  private getInputsMap() {
    return this.inputsStorage
  }

  private clearInputsMap() {
    this.inputsStorage.clear()
  }
}

// Task status update batcher
type TaskStatusInput = { taskId: string; status: "todo" | "in-progress" | "done" }
type TaskStatusOutput = { success: boolean; error?: string }

let taskStatusBatcher: RequestBatcher<TaskStatusInput, TaskStatusOutput> | null = null

/**
 * Get or create the task status update batcher
 */
export function getTaskStatusBatcher() {
  taskStatusBatcher ??= new RequestBatcher<TaskStatusInput, TaskStatusOutput>(
    async (inputs) => {
      // Batch update all tasks in a single request
      const updates = Array.from(inputs.values())

      // Call the batch update API endpoint
      const response = await fetch("/api/tasks/batch-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        throw new Error("Batch update failed")
      }

      const data = await response.json()

      // Convert array result back to map
      const results = new Map<string, TaskStatusOutput>()
      for (const update of updates) {
        results.set(update.taskId, {
          success: data.success?.includes(update.taskId) ?? false,
          error: data.errors?.[update.taskId],
        })
      }

      return results
    },
    50 // Wait 50ms to batch requests
  )

  return taskStatusBatcher
}

/**
 * Batch update a task status
 * Multiple calls within 50ms will be batched into a single request
 */
export async function batchUpdateTaskStatus(
  taskId: string,
  status: "todo" | "in-progress" | "done"
): Promise<TaskStatusOutput> {
  const batcher = getTaskStatusBatcher()
  return batcher.add(taskId, { taskId, status })
}
