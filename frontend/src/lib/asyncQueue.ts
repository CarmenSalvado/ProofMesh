/**
 * Queue system for asynchronous operations in the canvas
 * Ensures that operations are executed sequentially and errors are handled
 */

export interface QueuedOperation<T> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export class AsyncQueue {
  private queue: QueuedOperation<any>[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  /**
   * Adds an operation to the queue
   */
  async enqueue<T>(operation: QueuedOperation<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedOperation: QueuedOperation<T> = {
        ...operation,
        onSuccess: (result) => {
          operation.onSuccess?.(result);
          resolve(result);
        },
        onError: (error) => {
          operation.onError?.(error);
          reject(error);
        },
      };

      this.queue.push(wrappedOperation);
      this.processQueue();
    });
  }

  /**
   * Processes the operation queue
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      await this.executeWithRetry(operation);
    }

    this.isProcessing = false;
  }

  /**
   * Executes an operation with automatic retries
   */
  private async executeWithRetry<T>(operation: QueuedOperation<T>) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation.execute();
        operation.onSuccess?.(result);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(
          `[AsyncQueue] Operation "${operation.name}" failed (attempt ${attempt + 1}/${this.maxRetries + 1}):`,
          lastError.message
        );

        if (attempt < this.maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    console.error(
      `[AsyncQueue] Operation "${operation.name}" failed after ${this.maxRetries + 1} attempts:`,
      lastError
    );
    operation.onError?.(lastError!);
  }

  /**
   * Utility to wait
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clears the pending operations queue
   */
  clear() {
    this.queue.forEach((op) => {
      const error = new Error('Queue cleared');
      op.onError?.(error);
    });
    this.queue = [];
  }

  /**
   * Returns the number of pending operations
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Returns true if there are operations in progress
   */
  get isRunning(): boolean {
    return this.isProcessing;
  }
}

// Global canvas queue instance
export const canvasQueue = new AsyncQueue();

/**
 * Wrapper to execute operations in the global canvas queue
 */
export function queueCanvasOperation<T>(
  name: string,
  execute: () => Promise<T>,
  options?: {
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
  }
): Promise<T> {
  return canvasQueue.enqueue<T>({
    id: `${name}-${Date.now()}-${Math.random()}`,
    name,
    execute,
    ...options,
  });
}