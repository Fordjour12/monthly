import type {
  AISuggestion,
  BriefingSuggestionContent,
  PlanSuggestionContent,
  RescheduleSuggestionContent,
} from "@Monthly/db";
import { db, goalQueries, taskQueries, eq } from "@Monthly/db";
import { calendarEvents, goals, tasks } from "@Monthly/db";

export type ApplySuggestionOptions = {
  applyAll: boolean;
  selectedItems?: string[];
  dryRun?: boolean;
};

export type ApplySuggestionResult = {
  success: boolean;
  message: string;
  appliedItems: string[];
  skippedItems: string[];
  errors: string[];
  createdGoals?: number;
  createdTasks?: number;
  updatedTasks?: number;
  updatedEvents?: number;
};

/**
 * Service for applying different types of AI suggestions
 */
export class SuggestionApplicator {
  /**
   * Apply a suggestion based on its type
   */
  async applySuggestion(
    suggestion: AISuggestion,
    options: ApplySuggestionOptions = { applyAll: true }
  ): Promise<ApplySuggestionResult> {
    try {
      switch (suggestion.type) {
        case "plan":
          return this.applyPlanSuggestion(suggestion, options);
        case "briefing":
          return this.applyBriefingSuggestion(suggestion, options);
        case "reschedule":
          return this.applyRescheduleSuggestion(suggestion, options);
        default:
          throw new Error(`Unknown suggestion type: ${suggestion.type}`);
      }
    } catch (error) {
      console.error("Apply suggestion error:", error);
      return {
        success: false,
        message: `Failed to apply suggestion: ${error instanceof Error ? error.message : "Unknown error"}`,
        appliedItems: [],
        skippedItems: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply a plan suggestion - creates goals and tasks
   */
  private async applyPlanSuggestion(
    suggestion: AISuggestion,
    options: ApplySuggestionOptions
  ): Promise<ApplySuggestionResult> {
    const content = suggestion.content as PlanSuggestionContent;
    const result: ApplySuggestionResult = {
      success: true,
      message: "Plan suggestion applied successfully",
      appliedItems: [],
      skippedItems: [],
      errors: [],
      createdGoals: 0,
      createdTasks: 0,
    };

    try {
      if (options.dryRun) {
        result.message =
          "Dry run: Would create " + content.goals.length + " goals";
        return result;
      }

      // Create goals and their associated tasks
      for (const goalData of content.goals) {
        try {
          // Check if this goal should be applied
          if (
            !options.applyAll &&
            options.selectedItems &&
            !options.selectedItems.includes(goalData.title)
          ) {
            result.skippedItems.push(goalData.title);
            continue;
          }

          // Create the goal
          const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.insert(goals).values({
            id: goalId,
            userId: suggestion.userId,
            title: goalData.title,
            description: goalData.description,
            category: goalData.category,
            status: "active",
            progress: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          result.createdGoals = (result.createdGoals || 0) + 1;
          result.appliedItems.push(goalData.title);

          // Create tasks for this goal
          for (const taskData of goalData.tasks) {
            const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(tasks).values({
              id: taskId,
              userId: suggestion.userId,
              goalId,
              title: taskData.title,
              priority: taskData.priority,
              status: "pending",
              dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            result.createdTasks = (result.createdTasks || 0) + 1;
          }
        } catch (error) {
          const errorMsg = `Failed to create goal "${goalData.title}": ${error instanceof Error ? error.message : "Unknown error"}`;
          result.errors.push(errorMsg);
          result.skippedItems.push(goalData.title);
        }
      }

      // Update goal progress after creating tasks
      for (const goalData of content.goals) {
        if (result.appliedItems.includes(goalData.title)) {
          try {
            // Find the created goal (this is a simplified approach)
            const createdGoals = await db.query.goals.findMany({
              where: eq(goals.userId, suggestion.userId),
              limit: 50, // Recent goals
            });

            const matchingGoal = createdGoals.find(
              (g) => g.title === goalData.title
            );
            if (matchingGoal) {
              await goalQueries.updateProgress(matchingGoal.id);
            }
          } catch (error) {
            console.error("Failed to update goal progress:", error);
          }
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
        result.message = `Plan applied with ${result.errors.length} errors`;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = `Failed to apply plan suggestion: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      return result;
    }
  }

  /**
   * Apply a briefing suggestion - updates task priorities and schedules
   */
  private async applyBriefingSuggestion(
    suggestion: AISuggestion,
    options: ApplySuggestionOptions
  ): Promise<ApplySuggestionResult> {
    const content = suggestion.content as BriefingSuggestionContent;
    const result: ApplySuggestionResult = {
      success: true,
      message: "Briefing suggestion applied successfully",
      appliedItems: [],
      skippedItems: [],
      errors: [],
      updatedTasks: 0,
    };

    try {
      if (options.dryRun) {
        result.message =
          "Dry run: Would update " + content.todaysTasks.length + " tasks";
        return result;
      }

      // Update task priorities based on briefing
      for (const taskUpdate of content.todaysTasks) {
        try {
          if (
            !options.applyAll &&
            options.selectedItems &&
            !options.selectedItems.includes(taskUpdate.taskId)
          ) {
            result.skippedItems.push(taskUpdate.taskId);
            continue;
          }

          if (taskUpdate.taskId) {
            // Update existing task
            await db
              .update(tasks)
              .set({
                priority: taskUpdate.priority as "low" | "medium" | "high",
                updatedAt: new Date(),
              })
              .where(eq(tasks.id, taskUpdate.taskId));

            result.updatedTasks = (result.updatedTasks || 0) + 1;
            result.appliedItems.push(taskUpdate.taskId);
          } else {
            // Find task by title (fallback)
            const userTasks = await taskQueries.findByUser(suggestion.userId);
            const matchingTask = userTasks.find(
              (t) => t.title === taskUpdate.title
            );

            if (matchingTask) {
              await db
                .update(tasks)
                .set({
                  priority: taskUpdate.priority as "low" | "medium" | "high",
                  updatedAt: new Date(),
                })
                .where(eq(tasks.id, matchingTask.id));

              result.updatedTasks = (result.updatedTasks || 0) + 1;
              result.appliedItems.push(taskUpdate.title);
            } else {
              result.skippedItems.push(taskUpdate.title);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to update task "${taskUpdate.title}": ${error instanceof Error ? error.message : "Unknown error"}`;
          result.errors.push(errorMsg);
          result.skippedItems.push(taskUpdate.title);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
        result.message = `Briefing applied with ${result.errors.length} errors`;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = `Failed to apply briefing suggestion: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      return result;
    }
  }

  /**
   * Apply a reschedule suggestion - updates task due dates and calendar events
   */
  private async applyRescheduleSuggestion(
    suggestion: AISuggestion,
    options: ApplySuggestionOptions
  ): Promise<ApplySuggestionResult> {
    const content = suggestion.content as RescheduleSuggestionContent;
    const result: ApplySuggestionResult = {
      success: true,
      message: "Reschedule suggestion applied successfully",
      appliedItems: [],
      skippedItems: [],
      errors: [],
      updatedTasks: 0,
      updatedEvents: 0,
    };

    try {
      if (options.dryRun) {
        result.message =
          "Dry run: Would update " + content.affectedTasks.length + " tasks";
        return result;
      }

      // Update task due dates
      for (const taskUpdate of content.affectedTasks) {
        try {
          if (
            !options.applyAll &&
            options.selectedItems &&
            !options.selectedItems.includes(taskUpdate.taskId)
          ) {
            result.skippedItems.push(taskUpdate.taskId);
            continue;
          }

          if (taskUpdate.taskId) {
            // Update existing task
            await db
              .update(tasks)
              .set({
                dueDate: taskUpdate.suggestedDueDate
                  ? new Date(taskUpdate.suggestedDueDate)
                  : null,
                updatedAt: new Date(),
              })
              .where(eq(tasks.id, taskUpdate.taskId));

            result.updatedTasks = (result.updatedTasks || 0) + 1;
            result.appliedItems.push(taskUpdate.taskId);
          } else {
            result.skippedItems.push("Unknown task");
          }
        } catch (error) {
          const errorMsg = `Failed to reschedule task: ${error instanceof Error ? error.message : "Unknown error"}`;
          result.errors.push(errorMsg);
          result.skippedItems.push(taskUpdate.taskId || "Unknown task");
        }
      }

      // Update calendar events (if any)
      for (const eventUpdate of content.affectedEvents) {
        try {
          if (
            !options.applyAll &&
            options.selectedItems &&
            !options.selectedItems.includes(eventUpdate.eventId)
          ) {
            result.skippedItems.push(eventUpdate.eventId);
            continue;
          }

          if (eventUpdate.eventId) {
            // Update existing event
            await db
              .update(calendarEvents)
              .set({
                startTime: eventUpdate.suggestedStartTime
                  ? new Date(eventUpdate.suggestedStartTime)
                  : undefined,
                endTime: eventUpdate.suggestedEndTime
                  ? new Date(eventUpdate.suggestedEndTime)
                  : undefined,
                updatedAt: new Date(),
              })
              .where(eq(calendarEvents.id, eventUpdate.eventId));

            result.updatedEvents = (result.updatedEvents || 0) + 1;
            result.appliedItems.push(eventUpdate.eventId);
          } else {
            result.skippedItems.push("Unknown event");
          }
        } catch (error) {
          const errorMsg = `Failed to reschedule event: ${error instanceof Error ? error.message : "Unknown error"}`;
          result.errors.push(errorMsg);
          result.skippedItems.push(eventUpdate.eventId || "Unknown event");
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
        result.message = `Reschedule applied with ${result.errors.length} errors`;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = `Failed to apply reschedule suggestion: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      return result;
    }
  }

  /**
   * Preview what would be applied without actually applying changes
   */
  async previewSuggestion(
    suggestion: AISuggestion,
    options: Omit<ApplySuggestionOptions, "dryRun"> = { applyAll: true }
  ): Promise<ApplySuggestionResult> {
    return this.applySuggestion(suggestion, { ...options, dryRun: true });
  }
}

// Singleton instance
let suggestionApplicatorInstance: SuggestionApplicator | null = null;

export function getSuggestionApplicator(): SuggestionApplicator {
  if (!suggestionApplicatorInstance) {
    suggestionApplicatorInstance = new SuggestionApplicator();
  }
  return suggestionApplicatorInstance;
}
