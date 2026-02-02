/**
 * Sistema de cola para operaciones asíncronas en el canvas
 * Asegura que las operaciones se ejecuten secuencialmente y se manejen los errores
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
   * Agrega una operación a la cola
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
   * Procesa la cola de operaciones
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
   * Ejecuta una operación con reintentos automáticos
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
          // Esperar antes de reintentar con backoff exponencial
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // Todos los reintentos fallaron
    console.error(
      `[AsyncQueue] Operation "${operation.name}" failed after ${this.maxRetries + 1} attempts:`,
      lastError
    );
    operation.onError?.(lastError!);
  }

  /**
   * Utilidad para esperar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Limpia la cola de operaciones pendientes
   */
  clear() {
    this.queue.forEach((op) => {
      const error = new Error('Queue cleared');
      op.onError?.(error);
    });
    this.queue = [];
  }

  /**
   * Retorna el número de operaciones pendientes
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Retorna true si hay operaciones en proceso
   */
  get isRunning(): boolean {
    return this.isProcessing;
  }
}

// Instancia global de la cola para el canvas
export const canvasQueue = new AsyncQueue();

/**
 * Wrapper para ejecutar operaciones en la cola global del canvas
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