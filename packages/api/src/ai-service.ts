import type {
  BriefingSuggestionContent,
  PlanSuggestionContent,
  RescheduleSuggestionContent,
} from "@Monthly/db";
import type OpenAI from "openai";
import simpleCache, { CACHE_TTL, SimpleCache } from "./cache/simple-cache";
import { FallbackHandler } from "./error-handling/fallback-handler";
import { SimpleRetry } from "./error-handling/simple-retry";
import simpleRateLimiter from "./rate-limiting/simple-limiter";

export type AIServiceConfig = {
  apiKey: string;
  model?: string;
};

export type GeneratePlanInput = {
  userGoals: string;
  currentMonth: string;
  currentDate: string;
  existingCommitments: string[];
  workHours?: string;
  energyPatterns?: string;
  preferredTimes?: string;
};

export type GenerateBriefingInput = {
  currentDate: string;
  todaysTasks: Array<{
    title: string;
    priority: "low" | "medium" | "high";
  }>;
  yesterdayProgress?: string;
  habitStreaks?: Record<string, number>;
  nearDeadlines?: Array<{
    title: string;
    dueDate: string;
  }>;
  energyLevels?: string;
};

export type GenerateRescheduleInput = {
  currentWeek: string;
  backlogTasks: Array<{
    title: string;
    priority: "low" | "medium" | "high";
    dueDate: string;
  }>;
  completionHistory?: Array<{
    date: string;
    completed: number;
    total: number;
  }>;
  deadlinePressure?: Array<{
    title: string;
    daysUntil: number;
  }>;
  stressLevel?: "low" | "medium" | "high";
  energyTrends?: string;
  fixedCommitments?: string[];
};

export class AIService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config?: AIServiceConfig) {
    // Initialize OpenAI client with proper configuration
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const baseURL =
      config?.baseUrl ||
      (config?.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1");

    this.client = new (require("openai").default)({
      baseURL,
      apiKey,
      defaultHeaders:
        config?.provider === "openrouter"
          ? {
              "HTTP-Referer": "https://monthly.app",
              "X-Title": "Monthly App",
            }
          : undefined,
    }) as OpenAI;

    this.model =
      config?.model ||
      (config?.provider === "openrouter"
        ? "openai/gpt-4o-mini"
        : "gpt-3.5-turbo");
  }

  async generatePlan(
    input: GeneratePlanInput,
    userId?: string
  ): Promise<PlanSuggestionContent> {
    // Check cache first
    const cacheKey = SimpleCache.generateKey("plan", {
      userGoals: input.userGoals,
      currentMonth: input.currentMonth,
      existingCommitments: input.existingCommitments,
      workHours: input.workHours,
      energyPatterns: input.energyPatterns,
      preferredTimes: input.preferredTimes,
    });

    const cached = simpleCache.get<PlanSuggestionContent>(cacheKey);
    if (cached) {
      console.log("Cache hit for plan generation");
      return cached;
    }

    // Check rate limits if userId provided
    if (userId) {
      const rateLimit = simpleRateLimiter.checkLimit(userId, "plan");
      if (!rateLimit.allowed) {
        throw new Error(
          `Rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}. Remaining: ${rateLimit.remaining}`
        );
      }
    }

    const prompt = this.buildPlanPrompt(input);

    try {
      // Use retry logic for AI call
      const retryResult = await SimpleRetry.executeWithStrategy(
        async () => {
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an intelligent monthly planning assistant. Your task is to transform user goals into a structured, actionable monthly plan. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error("No response from AI model");
          }

          return content;
        },
        "ai-service",
        {}
      );

      if (!(retryResult.success && retryResult.data)) {
        throw (
          retryResult.error ||
          new Error("Failed to generate plan after retries")
        );
      }

      // Parse JSON response
      const parsed = JSON.parse(retryResult.data);

      // Transform to match our PlanSuggestionContent interface
      const result: PlanSuggestionContent = {
        goals:
          parsed.weekly_breakdown?.map(
            (week: {
              week?: number;
              focus?: string;
              goals?: string[];
              daily_tasks?: Record<string, string[]>;
            }) => ({
              title: week.focus || `Week ${week.week} Goals`,
              description: week.goals?.join(", ") || "",
              category: "monthly",
              tasks: Object.entries(week.daily_tasks || {}).flatMap(
                ([day, tasks]: [string, string[]]) =>
                  (tasks as string[]).map((task: string) => ({
                    title: task,
                    priority: "medium" as const,
                    dueDate: this.getDueDateForDay(
                      day,
                      input.currentMonth,
                      week.week ?? 1
                    ),
                  }))
              ),
            })
          ) || [],
      };

      // Cache the result
      simpleCache.set(cacheKey, result, CACHE_TTL.PLAN_GENERATION);

      // Record usage if userId provided
      if (userId) {
        simpleRateLimiter.recordUsage(userId, "plan");
      }

      return result;
    } catch (error) {
      console.error("AI Plan Generation Error:", error);

      // Try fallback if AI service fails
      if (userId) {
        const fallbackResult =
          await FallbackHandler.handleAIError<PlanSuggestionContent>(
            error instanceof Error ? error : new Error(String(error)),
            "plan",
            input
          );

        if (fallbackResult.success && fallbackResult.data) {
          return fallbackResult.data;
        }
      }

      throw new Error(
        `Failed to generate plan: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async generateBriefing(
    input: GenerateBriefingInput,
    userId?: string
  ): Promise<BriefingSuggestionContent> {
    // Check cache first
    const cacheKey = SimpleCache.generateKey("briefing", {
      currentDate: input.currentDate,
      todaysTasks: input.todaysTasks,
      yesterdayProgress: input.yesterdayProgress,
      habitStreaks: input.habitStreaks,
      nearDeadlines: input.nearDeadlines,
      energyLevels: input.energyLevels,
    });

    const cached = simpleCache.get<BriefingSuggestionContent>(cacheKey);
    if (cached) {
      console.log("Cache hit for briefing generation");
      return cached;
    }

    // Check rate limits if userId provided
    if (userId) {
      const rateLimit = simpleRateLimiter.checkLimit(userId, "briefing");
      if (!rateLimit.allowed) {
        throw new Error(
          `Rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}. Remaining: ${rateLimit.remaining}`
        );
      }
    }

    const prompt = this.buildBriefingPrompt(input);

    try {
      // Use retry logic for AI call
      const retryResult = await SimpleRetry.executeWithStrategy(
        async () => {
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "You are a daily productivity coach. Create a personalized daily briefing based on the user's plan and progress. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.6,
            max_tokens: 2000,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error("No response from AI model");
          }

          return content;
        },
        "ai-service",
        {}
      );

      if (!(retryResult.success && retryResult.data)) {
        throw (
          retryResult.error ||
          new Error("Failed to generate briefing after retries")
        );
      }

      const parsed = JSON.parse(retryResult.data);

      const result: BriefingSuggestionContent = {
        summary: parsed.greeting || "Daily briefing ready",
        todaysTasks:
          parsed.task_priorities?.map(
            (task: { task?: string; priority?: string }) => ({
              taskId: "", // Will be filled by caller
              title: task.task,
              priority: task.priority || "medium",
            })
          ) ||
          input.todaysTasks.map((task) => ({
            taskId: "",
            title: task.title,
            priority: task.priority,
          })),
        upcomingDeadlines:
          input.nearDeadlines?.map((deadline) => ({
            title: deadline.title,
            dueDate: deadline.dueDate,
          })) || [],
        habitReminders: Object.entries(input.habitStreaks || {}).map(
          ([habitId, streak]) => ({
            habitId,
            title: `Habit ${habitId}`,
            targetValue: 1,
            currentValue: streak,
          })
        ),
      };

      // Cache the result
      simpleCache.set(cacheKey, result, CACHE_TTL.BRIEFING_GENERATION);

      // Record usage if userId provided
      if (userId) {
        simpleRateLimiter.recordUsage(userId, "briefing");
      }

      return result;
    } catch (error) {
      console.error("AI Briefing Generation Error:", error);

      // Try fallback if AI service fails
      if (userId) {
        const fallbackResult =
          await FallbackHandler.handleAIError<BriefingSuggestionContent>(
            error instanceof Error ? error : new Error(String(error)),
            "briefing",
            input
          );

        if (fallbackResult.success && fallbackResult.data) {
          return fallbackResult.data;
        }
      }

      throw new Error(
        `Failed to generate briefing: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async generateReschedule(
    input: GenerateRescheduleInput,
    userId?: string
  ): Promise<RescheduleSuggestionContent> {
    // Check cache first
    const cacheKey = SimpleCache.generateKey("reschedule", {
      currentWeek: input.currentWeek,
      backlogTasks: input.backlogTasks,
      completionHistory: input.completionHistory,
      deadlinePressure: input.deadlinePressure,
      stressLevel: input.stressLevel,
      energyTrends: input.energyTrends,
      fixedCommitments: input.fixedCommitments,
    });

    const cached = simpleCache.get<RescheduleSuggestionContent>(cacheKey);
    if (cached) {
      console.log("Cache hit for reschedule generation");
      return cached;
    }

    // Check rate limits if userId provided
    if (userId) {
      const rateLimit = simpleRateLimiter.checkLimit(userId, "reschedule");
      if (!rateLimit.allowed) {
        throw new Error(
          `Rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}. Remaining: ${rateLimit.remaining}`
        );
      }
    }

    const prompt = this.buildReschedulePrompt(input);

    try {
      // Use retry logic for AI call
      const retryResult = await SimpleRetry.executeWithStrategy(
        async () => {
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an intelligent schedule optimizer. Automatically reschedule incomplete tasks and adapt the plan based on progress patterns. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.5,
            max_tokens: 3000,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error("No response from AI model");
          }

          return content;
        },
        "ai-service",
        {}
      );

      if (!(retryResult.success && retryResult.data)) {
        throw (
          retryResult.error ||
          new Error("Failed to generate reschedule after retries")
        );
      }

      const parsed = JSON.parse(retryResult.data);

      const result: RescheduleSuggestionContent = {
        reason:
          parsed.rescheduling_strategy ||
          "Optimizing schedule based on progress",
        affectedTasks:
          parsed.task_movements?.map(
            (movement: { original_date?: string; new_date?: string }) => ({
              taskId: "", // Will be filled by caller
              currentDueDate: movement.original_date,
              suggestedDueDate: movement.new_date,
            })
          ) || [],
        affectedEvents: [],
      };

      // Cache the result
      simpleCache.set(cacheKey, result, CACHE_TTL.RESCHEDULE_GENERATION);

      // Record usage if userId provided
      if (userId) {
        simpleRateLimiter.recordUsage(userId, "reschedule");
      }

      return result;
    } catch (error) {
      console.error("AI Reschedule Generation Error:", error);

      // Try fallback if AI service fails
      if (userId) {
        const fallbackResult =
          await FallbackHandler.handleAIError<RescheduleSuggestionContent>(
            error instanceof Error ? error : new Error(String(error)),
            "reschedule",
            input
          );

        if (fallbackResult.success && fallbackResult.data) {
          return fallbackResult.data;
        }
      }

      throw new Error(
        `Failed to generate reschedule: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private buildPlanPrompt(input: GeneratePlanInput): string {
    return `You are an intelligent monthly planning assistant. Your task is to transform user goals into a structured, actionable monthly plan.

**User Input:**
${input.userGoals}

**Context:**
- Current month: ${input.currentMonth}
- Current date: ${input.currentDate}
- User's known commitments: ${input.existingCommitments.join(", ")}
- User's preferences: Work hours: ${input.workHours || "Not specified"}, Energy patterns: ${input.energyPatterns || "Not specified"}, Preferred times: ${input.preferredTimes || "Not specified"}

**Your Responsibilities:**
1. Parse and understand the user's goals
2. Break down large goals into weekly milestones
3. Create daily tasks that are realistic and achievable
4. Identify potential conflicts or overload situations
5. Suggest optimal timing based on user patterns

**Output Format (JSON):**
{
  "monthly_summary": "Brief overview of the plan",
  "weekly_breakdown": [
    {
      "week": 1,
      "focus": "Main theme for this week",
      "goals": ["Weekly goal 1", "Weekly goal 2"],
      "daily_tasks": {
        "Monday": ["Task 1", "Task 2"],
        "Tuesday": ["Task 1", "Task 2"]
      }
    }
  ],
  "potential_conflicts": ["Any identified issues"],
  "success_metrics": ["How to measure progress"]
}

**Constraints:**
- Maximum 3-4 major tasks per day
- Include buffer time for unexpected delays
- Consider weekends differently based on user preferences
- Flag any unrealistic timelines`;
  }

  private buildBriefingPrompt(input: GenerateBriefingInput): string {
    return `You are a daily productivity coach. Create a personalized daily briefing based on the user's plan and progress.

**Context:**
- Today's date: ${input.currentDate}
- Today's planned tasks: ${input.todaysTasks.map((t) => `${t.title} (${t.priority})`).join(", ")}
- Yesterday's completion status: ${input.yesterdayProgress || "Not available"}
- Current streaks: ${JSON.stringify(input.habitStreaks || {})}
- Upcoming deadlines: ${input.nearDeadlines?.map((d) => `${d.title} (${d.dueDate})`).join(", ") || "None"}
- User's energy patterns: ${input.energyLevels || "Not specified"}

**Your Role:**
1. Prioritize today's tasks based on importance and energy levels
2. Provide motivational context
3. Alert about any deadline pressures
4. Suggest the best order for task completion

**Output Format (JSON):**
{
  "greeting": "Personalized morning message",
  "today_focus": "Main priority for today",
  "task_priorities": [
    {
      "task": "Task name",
      "priority": "high/medium/low",
      "best_time": "Morning/Afternoon/Evening",
      "estimated_duration": "30 min",
      "context": "Why this matters today"
    }
  ],
  "motivation": "Encouraging message",
  "warnings": ["Any urgent alerts"],
  "tips": ["Productivity suggestions for today"]
}`;
  }

  private buildReschedulePrompt(input: GenerateRescheduleInput): string {
    return `You are an intelligent schedule optimizer. Automatically reschedule incomplete tasks and adapt the plan based on progress patterns.

**Context:**
- Current week: ${input.currentWeek}
- Incomplete tasks: ${input.backlogTasks.map((t) => `${t.title} (${t.priority})`).join(", ")}
- Recent completion patterns: ${JSON.stringify(input.completionHistory || [])}
- Upcoming deadlines: ${input.deadlinePressure?.map((d) => `${d.title} (${d.daysUntil} days)`).join(", ") || "None"}
- User's capacity indicators: Stress level: ${input.stressLevel || "Not specified"}, Energy trends: ${input.energyTrends || "Not specified"}
- Calendar constraints: ${input.fixedCommitments?.join(", ") || "None"}

**Optimization Rules:**
1. Preserve deadlines and hard commitments
2. Balance workload across available days
3. Consider user's energy patterns and productivity times
4. Maintain habit continuity
5. Prevent task accumulation

**Output Format (JSON):**
{
  "rescheduling_strategy": "Overall approach explanation",
  "task_movements": [
    {
      "task": "Task name",
      "original_date": "Planned date",
      "new_date": "Rescheduled date",
      "reason": "Why this move makes sense",
      "priority_adjustment": "Any priority changes"
    }
  ],
  "workload_balance": {
    "overloaded_days": ["Days with too many tasks"],
    "underutilized_days": ["Days with capacity"],
    "recommendations": ["How to balance better"]
  },
  "deadline_risks": ["Tasks at risk of missing deadlines"],
  "adaptation_suggestions": [
    "Consider breaking down large tasks",
    "Delegate or eliminate low-priority items",
    "Adjust expectations for this week"
  ]
}`;
  }

  private getDueDateForDay(day: string, _month: string, week: number): string {
    // This is a simplified implementation - in production, you'd want proper date calculation
    const dayMap: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 0,
    };

    const dayOffset = (week - 1) * 7 + (dayMap[day] || 1);
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().split("T")[0] ?? "";
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

// Enhanced wrapper functions that include userId
export async function generatePlanWithCache(
  input: GeneratePlanInput,
  userId: string
): Promise<PlanSuggestionContent> {
  const aiService = getAIService();
  return await aiService.generatePlan(input, userId);
}

export async function generateBriefingWithCache(
  input: GenerateBriefingInput,
  userId: string
): Promise<BriefingSuggestionContent> {
  const aiService = getAIService();
  return await aiService.generateBriefing(input, userId);
}

export async function generateRescheduleWithCache(
  input: GenerateRescheduleInput,
  userId: string
): Promise<RescheduleSuggestionContent> {
  const aiService = getAIService();
  return await aiService.generateReschedule(input, userId);
}
