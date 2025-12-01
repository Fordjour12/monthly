/**
 * Graceful fallback handlers for AI service failures
 * Provides template responses when AI is unavailable
 */

import type {
  PlanSuggestionContent,
  BriefingSuggestionContent,
  RescheduleSuggestionContent,
} from "@Monthly/db";

export interface FallbackOptions {
  preserveInput?: boolean; // Save input for later retry
  notifyUser?: boolean; // Show user that fallback was used
  logError?: boolean; // Log the original error
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  fallbackUsed: boolean;
  message: string;
  savedForRetry?: string; // ID if input was saved
}

export class FallbackHandler {
  /**
   * Generate fallback plan when AI service fails
   */
  static generatePlanFallback(
    userGoals: string,
    options: FallbackOptions = {}
  ): FallbackResult<PlanSuggestionContent> {
    try {
      // Extract key information from user goals
      const goals = this.extractGoals(userGoals);

      const fallbackPlan: PlanSuggestionContent = {
        goals: goals.map((goal, index) => ({
          title: goal,
          description: `Goal based on your input: ${goal}`,
          category: "personal",
          tasks: this.generateTasksForGoal(goal, index + 1),
        })),
      };

      return {
        success: true,
        data: fallbackPlan,
        fallbackUsed: true,
        message:
          "AI service unavailable - Generated template plan based on your goals",
      };
    } catch (error) {
      return {
        success: false,
        fallbackUsed: true,
        message: `Failed to generate fallback plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generate fallback briefing when AI service fails
   */
  static generateBriefingFallback(
    currentDate: string,
    todaysTasks: Array<{ title: string; priority: string }>,
    options: FallbackOptions = {}
  ): FallbackResult<BriefingSuggestionContent> {
    try {
      const highPriorityTasks = todaysTasks.filter(
        (task) => task.priority === "high"
      );
      const mediumPriorityTasks = todaysTasks.filter(
        (task) => task.priority === "medium"
      );
      const lowPriorityTasks = todaysTasks.filter(
        (task) => task.priority === "low"
      );

      const fallbackBriefing: BriefingSuggestionContent = {
        summary: `Daily briefing for ${currentDate} - ${todaysTasks.length} tasks scheduled`,
        todaysTasks: todaysTasks.map((task) => ({
          taskId: "",
          title: task.title,
          priority: task.priority as "low" | "medium" | "high",
        })),
        upcomingDeadlines: [], // Would need calendar data to populate
        habitReminders: [], // Would need habit data to populate
      };

      const priorityMessage =
        highPriorityTasks.length > 0
          ? `Focus on ${highPriorityTasks.length} high-priority task(s)`
          : mediumPriorityTasks.length > 0
            ? `You have ${mediumPriorityTasks.length} medium-priority task(s) to work on`
            : "No high-priority tasks - great job staying ahead!";

      return {
        success: true,
        data: fallbackBriefing,
        fallbackUsed: true,
        message: `AI service unavailable - ${priorityMessage}`,
      };
    } catch (error) {
      return {
        success: false,
        fallbackUsed: true,
        message: `Failed to generate fallback briefing: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generate fallback reschedule when AI service fails
   */
  static generateRescheduleFallback(
    backlogTasks: Array<{ title: string; priority: string; dueDate: string }>,
    options: FallbackOptions = {}
  ): FallbackResult<RescheduleSuggestionContent> {
    try {
      // Sort tasks by priority and due date
      const sortedTasks = backlogTasks
        .map((task) => ({
          ...task,
          priority: this.getPriorityValue(
            task.priority as "low" | "medium" | "high"
          ),
          dueDate: new Date(task.dueDate),
        }))
        .sort((a, b) => {
          // First by priority (high to low)
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          // Then by due date (earliest first)
          return a.dueDate.getTime() - b.dueDate.getTime();
        });

      // Reschedule to next available days
      const rescheduledTasks = sortedTasks.map((task, index) => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + index + 1); // Spread over next days

        return {
          taskId: "",
          currentDueDate: task.dueDate,
          suggestedDueDate: newDate.toISOString().split("T")[0],
        };
      });

      const fallbackReschedule: RescheduleSuggestionContent = {
        reason: `Rescheduling ${backlogTasks.length} overdue tasks using priority-based scheduling`,
        affectedTasks: rescheduledTasks,
        affectedEvents: [],
      };

      return {
        success: true,
        data: fallbackReschedule,
        fallbackUsed: true,
        message: `AI service unavailable - Rescheduled ${backlogTasks.length} tasks based on priority`,
      };
    } catch (error) {
      return {
        success: false,
        fallbackUsed: true,
        message: `Failed to generate fallback reschedule: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Extract goals from user input text
   */
  private static extractGoals(userGoals: string): string[] {
    // Simple goal extraction - look for sentences or bullet points
    const sentences = userGoals
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const bulletPoints = userGoals
      .split(/[\n\r]+/)
      .filter((s) => s.trim().length > 0);

    let goals: string[] = [];

    // Try bullet points first
    if (bulletPoints.length > 1) {
      goals = bulletPoints
        .map((point) => point.replace(/^[-*•]\s*/, "").trim())
        .filter((goal) => goal.length > 0);
    }

    // Fallback to sentences if no bullet points found
    if (goals.length === 0 && sentences.length > 0) {
      goals = sentences.slice(0, 5); // Max 5 goals
    }

    // If still no goals, create a generic one
    if (goals.length === 0) {
      goals = ["Complete my monthly objectives"];
    }

    return goals.slice(0, 5); // Limit to 5 goals max
  }

  /**
   * Generate tasks for a goal
   */
  private static generateTasksForGoal(
    goal: string,
    weekNumber: number
  ): Array<{
    title: string;
    priority: "low" | "medium" | "high";
    dueDate?: string;
  }> {
    const taskTemplates = [
      `Research and plan ${goal.toLowerCase()}`,
      `Start working on ${goal.toLowerCase()}`,
      `Make progress on ${goal.toLowerCase()}`,
      `Complete ${goal.toLowerCase()} milestone`,
      `Review and finalize ${goal.toLowerCase()}`,
    ];

    return taskTemplates.slice(0, 3).map((template, index) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (weekNumber - 1) * 7 + index * 2);

      return {
        title: template,
        priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
        dueDate: dueDate.toISOString().split("T")[0],
      };
    });
  }

  /**
   * Convert priority string to numeric value for sorting
   */
  private static getPriorityValue(priority: "low" | "medium" | "high"): number {
    switch (priority) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 2;
    }
  }

  /**
   * Save input for retry later
   */
  static async saveInputForRetry(
    userId: string,
    type: "plan" | "briefing" | "reschedule",
    input: any
  ): Promise<string> {
    const retryId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In a real implementation, you'd save this to database
    console.log(`Saved input for retry: ${retryId} - ${type} - ${userId}`);

    return retryId;
  }

  /**
   * Get saved input for retry
   */
  static async getSavedInput(retryId: string): Promise<any> {
    // In a real implementation, you'd retrieve this from database
    console.log(`Retrieving saved input: ${retryId}`);
    return null;
  }

  /**
   * Handle AI service error with appropriate fallback
   */
  static handleAIError<T>(
    error: Error,
    type: "plan" | "briefing" | "reschedule",
    input: any,
    options: FallbackOptions = {}
  ): Promise<FallbackResult<T>> {
    const errorType = this.classifyError(error);

    // Log the error if requested
    if (options.logError !== false) {
      console.error(`AI Service Error (${type}):`, {
        message: error.message,
        type: errorType,
        input: typeof input === "string" ? input.substring(0, 100) : "object",
      });
    }

    // Save input for retry if requested
    let savedForRetry: string | undefined;
    if (options.preserveInput) {
      savedForRetry = await this.saveInputForRetry('user', type, input);
    }

    // Generate appropriate fallback
    switch (type) {
      case "plan":
        return this.generatePlanFallback(
          typeof input === "string" ? input : JSON.stringify(input),
          options
        );

      case "briefing":
        return this.generateBriefingFallback(
          input.currentDate,
          input.todaysTasks,
          options
        );

      case "reschedule":
        return this.generateRescheduleFallback(input.backlogTasks, options);

      default:
        return {
          success: false,
          fallbackUsed: true,
          message: `Unknown request type: ${type}`,
        };
    }
  }

  /**
   * Classify error type for appropriate handling
   */
  private static classifyError(
    error: Error
  ): "network" | "rate-limit" | "service" | "unknown" {
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
      return "service";
    }

    return "unknown";
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(
    errorType: "network" | "rate-limit" | "service" | "unknown"
  ): string {
    switch (errorType) {
      case "network":
        return "Having trouble connecting to AI service. Please check your internet connection and try again.";

      case "rate-limit":
        return "You've reached the request limit. Please wait a bit and try again.";

      case "service":
        return "AI service is temporarily unavailable. Using fallback responses.";

      default:
        return "Something went wrong. Please try again in a moment.";
    }
  }
}
