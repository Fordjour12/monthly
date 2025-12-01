/**
 * Simple rate limiting for personal use
 * Prevents accidental overuse of AI services
 */

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  limit: number;
  currentUsage: number;
}

export interface UserRateLimit {
  daily: number;
  monthly: number;
  plan: number; // Per day
  briefing: number; // Per day
  reschedule: number; // Per day
}

export class SimpleRateLimiter {
  private userLimits = new Map<string, UserRateLimit>();
  private dailyUsage = new Map<string, Map<string, number>>();
  private monthlyUsage = new Map<string, number>();

  constructor(private defaultLimits: UserRateLimit) {}

  /**
   * Check if user is allowed to make a request
   */
  checkLimit(
    userId: string,
    endpoint: keyof Omit<UserRateLimit, "daily" | "monthly">
  ): RateLimitStatus {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const thisMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

    // Get or initialize user limits
    const limits = this.userLimits.get(userId) || this.defaultLimits;
    this.userLimits.set(userId, limits);

    // Get daily usage
    if (!this.dailyUsage.has(userId)) {
      this.dailyUsage.set(userId, new Map());
    }
    const dailyUsage = this.dailyUsage.get(userId)!;

    // Get monthly usage
    const monthlyUsage = this.monthlyUsage.get(userId) || 0;

    // Check specific endpoint limits
    const endpointLimit = limits[endpoint];
    const endpointUsage = dailyUsage.get(endpoint) || 0;

    // Check daily limits
    const totalDailyUsage = Array.from(dailyUsage.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const dailyLimitExceeded = totalDailyUsage >= limits.daily;

    // Check monthly limits
    const monthlyLimitExceeded = monthlyUsage >= limits.monthly;

    // Check endpoint-specific limits
    const endpointLimitExceeded = endpointUsage >= endpointLimit;

    const allowed =
      !dailyLimitExceeded && !monthlyLimitExceeded && !endpointLimitExceeded;
    const remaining = Math.min(
      limits.daily - totalDailyUsage,
      limits.monthly - monthlyUsage,
      endpointLimit - endpointUsage
    );

    // Calculate reset time (midnight for daily, start of next month for monthly)
    const resetTime = dailyLimitExceeded
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);

    return {
      allowed,
      remaining: Math.max(0, remaining),
      resetTime,
      limit: endpointLimit,
      currentUsage: endpointUsage,
    };
  }

  /**
   * Record a usage event
   */
  recordUsage(
    userId: string,
    endpoint: keyof Omit<UserRateLimit, "daily" | "monthly">
  ): void {
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, "0")}`;

    // Update daily usage
    if (!this.dailyUsage.has(userId)) {
      this.dailyUsage.set(userId, new Map());
    }
    const dailyUsage = this.dailyUsage.get(userId)!;
    const currentCount = dailyUsage.get(endpoint) || 0;
    dailyUsage.set(endpoint, currentCount + 1);

    // Update monthly usage
    const currentMonthly = this.monthlyUsage.get(userId) || 0;
    this.monthlyUsage.set(userId, currentMonthly + 1);

    // Log usage for monitoring
    console.log(
      `Usage recorded: ${userId} - ${endpoint} - Daily: ${currentCount + 1}/${this.userLimits.get(userId)?.[endpoint] || this.defaultLimits[endpoint]}`
    );
  }

  /**
   * Reset daily usage (called at midnight)
   */
  resetDailyUsage(): void {
    const today = new Date().toISOString().split("T")[0];
    console.log(`Resetting daily usage for ${this.dailyUsage.size} users`);
    this.dailyUsage.clear();
  }

  /**
   * Reset monthly usage (called on first day of month)
   */
  resetMonthlyUsage(): void {
    console.log(`Resetting monthly usage for ${this.monthlyUsage.size} users`);
    this.monthlyUsage.clear();
  }

  /**
   * Get user's current usage statistics
   */
  getUserStats(userId: string): {
    daily: Record<string, number>;
    monthly: number;
    limits: UserRateLimit;
  } {
    const dailyUsage = this.dailyUsage.get(userId) || new Map();
    const monthlyUsage = this.monthlyUsage.get(userId) || 0;
    const limits = this.userLimits.get(userId) || this.defaultLimits;

    return {
      daily: Object.fromEntries(dailyUsage),
      monthly: monthlyUsage,
      limits,
    };
  }

  /**
   * Set custom limits for a user
   */
  setUserLimits(userId: string, limits: Partial<UserRateLimit>): void {
    const currentLimits = this.userLimits.get(userId) || this.defaultLimits;
    this.userLimits.set(userId, { ...currentLimits, ...limits });
  }

  /**
   * Get all users' statistics (for monitoring)
   */
  getAllStats(): Array<{
    userId: string;
    daily: Record<string, number>;
    monthly: number;
    limits: UserRateLimit;
  }> {
    const stats = [];
    for (const userId of this.userLimits.keys()) {
      stats.push(this.getUserStats(userId));
    }
    return stats;
  }
}

// Default rate limits for personal use
export const DEFAULT_RATE_LIMITS: UserRateLimit = {
  daily: 20, // 20 AI requests per day
  monthly: 300, // 300 AI requests per month
  plan: 5, // 5 plans per day
  briefing: 10, // 10 briefings per day
  reschedule: 5, // 5 reschedules per day
};

// Global rate limiter instance
const globalRateLimiter = new SimpleRateLimiter(DEFAULT_RATE_LIMITS);

// Schedule daily reset at midnight
const scheduleDailyReset = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    globalRateLimiter.resetDailyUsage();
    scheduleDailyReset(); // Schedule next day's reset
  }, msUntilMidnight);
};

// Schedule monthly reset on 1st of each month
const scheduleMonthlyReset = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);

  const msUntilFirst = nextMonth.getTime() - now.getTime();

  setTimeout(() => {
    globalRateLimiter.resetMonthlyUsage();
    scheduleMonthlyReset(); // Schedule next month's reset
  }, msUntilFirst);
};

// Start the scheduling
scheduleDailyReset();
scheduleMonthlyReset();

export default globalRateLimiter;
