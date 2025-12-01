/**
 * Simple retry logic with exponential backoff
 * Handles AI service failures gracefully
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffFactor: number; // Multiplier for each retry
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

export class SimpleRetry {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10_000, // 10 seconds
    backoffFactor: 2,
  };

  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const opts = { ...SimpleRetry.DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const data = await fn();
        return {
          success: true,
          data,
          attempts: attempt,
          totalDelay,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain error types
        if (SimpleRetry.shouldNotRetry(lastError)) {
          break;
        }

        // Don't wait after last attempt
        if (attempt === opts.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.baseDelay * opts.backoffFactor ** (attempt - 1),
          opts.maxDelay
        );

        totalDelay += delay;

        console.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message
        );
        await SimpleRetry.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: opts.maxAttempts,
      totalDelay,
    };
  }

  /**
   * Execute with different strategy for different error types
   */
  static async executeWithStrategy<T>(
    fn: () => Promise<T>,
    errorType: "network" | "rate-limit" | "ai-service" | "unknown",
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const strategyOptions = SimpleRetry.getStrategyOptions(errorType, options);
    return SimpleRetry.execute(fn, strategyOptions);
  }

  /**
   * Check if error should not be retried
   */
  private static shouldNotRetry(error: Error): boolean {
    const noRetryMessages = [
      "invalid api key",
      "insufficient credits",
      "invalid request format",
      "authentication failed",
      "unauthorized",
    ];

    const message = error.message.toLowerCase();
    return noRetryMessages.some((noRetryMsg) => message.includes(noRetryMsg));
  }

  /**
   * Get retry options based on error type
   */
  private static getStrategyOptions(
    errorType: "network" | "rate-limit" | "ai-service" | "unknown",
    baseOptions: Partial<RetryOptions>
  ): Partial<RetryOptions> {
    switch (errorType) {
      case "network":
        return {
          ...baseOptions,
          maxAttempts: 5, // More retries for network issues
          baseDelay: 500, // Shorter initial delay
          backoffFactor: 1.5, // Gentler backoff
        };

      case "rate-limit":
        return {
          ...baseOptions,
          maxAttempts: 2, // Fewer retries for rate limits
          baseDelay: 5000, // Longer initial delay
          backoffFactor: 2, // Standard backoff
        };

      case "ai-service":
        return {
          ...baseOptions,
          maxAttempts: 3, // Standard retries for AI service
          baseDelay: 2000, // Moderate initial delay
          backoffFactor: 2, // Standard backoff
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Simple delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Classify error type
   */
  static classifyError(
    error: Error
  ): "network" | "rate-limit" | "ai-service" | "unknown" {
    const message = error.message.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("connection")
    ) {
      return "network";
    }

    if (
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return "rate-limit";
    }

    if (
      message.includes("openai") ||
      message.includes("ai") ||
      message.includes("model")
    ) {
      return "ai-service";
    }

    return "unknown";
  }

  /**
   * Create a retryable function wrapper
   */
  static wrap<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): () => Promise<RetryResult<T>> {
    return () => SimpleRetry.execute(fn, options);
  }

  /**
   * Execute multiple functions in parallel with retry
   */
  static async executeParallel<T>(
    functions: Array<() => Promise<T>>,
    options: Partial<RetryOptions> = {}
  ): Promise<Array<RetryResult<T>>> {
    const promises = functions.map((fn) => SimpleRetry.execute(fn, options));
    return Promise.all(promises);
  }

  /**
   * Get retry statistics
   */
  static getRetryStats(results: Array<RetryResult<any>>): {
    totalAttempts: number;
    successRate: number;
    averageDelay: number;
    totalDelay: number;
  } {
    const totalAttempts = results.reduce(
      (sum, result) => sum + result.attempts,
      0
    );
    const successes = results.filter((result) => result.success).length;
    const totalDelay = results.reduce(
      (sum, result) => sum + result.totalDelay,
      0
    );

    return {
      totalAttempts,
      successRate: successes / results.length,
      averageDelay: totalDelay / results.length,
      totalDelay,
    };
  }
}
