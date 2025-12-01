import {
  aiQueries,
  calendarQueries,
  habitQueries,
  taskQueries,
} from "@Monthly/db";
import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { getAIService } from "../ai-service";
import { protectedProcedure } from "../index";

export const aiRouter = {
  /**
   * Generate a monthly plan based on user goals
   */
  generatePlan: protectedProcedure
    .input(
      z.object({
        userGoals: z.string().min(10, "Please provide more detailed goals"),
        workHours: z.string().optional(),
        energyPatterns: z.string().optional(),
        preferredTimes: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        // Check if there's already a recent plan suggestion
        const recentPlans = await aiQueries.getRecentByType(userId, "plan", 2);
        if (recentPlans.length > 0) {
          const recentPlan = recentPlans[0]!;
          return {
            suggestionId: recentPlan.id,
            content: recentPlan.content,
            isRecent: true,
            message:
              "Using recently generated plan. Generate new plan in 2 hours if needed.",
          };
        }

        // Gather user context
        const currentTasks = await taskQueries.findToday(userId);
        const habits = await habitQueries.findByUser(userId);
        const todayEvents = await calendarQueries.findToday(userId);

        // Prepare context for AI
        const currentDate: string = new Date().toISOString().split("T")[0]!;
        const currentMonth = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });

        const existingCommitments = [
          ...currentTasks.map((t) => t.title),
          ...todayEvents.map((e) => e.title),
          ...habits.filter((h) => h.frequency === "daily").map((h) => h.title),
        ];

        // Generate plan using AI service
        const aiService = getAIService();
        const planContent = await aiService.generatePlan({
          userGoals: input.userGoals,
          currentMonth,
          currentDate,
          existingCommitments,
          workHours: input.workHours,
          energyPatterns: input.energyPatterns,
          preferredTimes: input.preferredTimes,
        });

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "plan",
          planContent
        );

        return {
          suggestionId: suggestion.id,
          content: planContent,
          isRecent: false,
          message: "Monthly plan generated successfully",
        };
      } catch (error) {
        console.error("Generate plan error:", error);
        throw new Error(
          `Failed to generate plan: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Generate a daily briefing
   */
  generateBriefing: protectedProcedure
    .input(
      z.object({
        date: z.string().optional(),
        includeYesterdayProgress: z.boolean().default(true),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        // Check if there's already a recent briefing for today
        const recentBriefings = await aiQueries.getRecentByType(
          userId,
          "briefing",
          1
        );
        if (recentBriefings.length > 0) {
          const recentBriefing = recentBriefings[0]!;
          return {
            suggestionId: recentBriefing.id,
            content: recentBriefing.content,
            isRecent: true,
            message:
              "Using today's briefing. Generate new one in 1 hour if needed.",
          };
        }

        // Gather today's context
        const targetDate = input.date ? new Date(input.date) : new Date();
        const tomorrow = new Date(targetDate);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaysTasks = await taskQueries.findByDateRange(
          userId,
          targetDate,
          tomorrow
        );

        const upcomingDeadlines = (
          await taskQueries.findByUser(userId, {
            status: "pending",
          })
        )
          .filter(
            (task) =>
              task.dueDate &&
              new Date(task.dueDate) <=
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          )
          .map((task) => ({
            title: task.title,
            dueDate: new Date(task.dueDate!).toISOString().split("T")[0],
          })) as Array<{
          title: string;
          dueDate: string;
        }>;

        // Get fixed commitments
        const fixedCommitments = await calendarQueries
          .findToday(userId)
          .then((events) =>
            events.map(
              (e) => `${e.title} at ${e.startTime.toLocaleTimeString()}`
            )
          );

        // Generate reschedule suggestions using AI service
        const aiService = getAIService();
        const rescheduleContent = await aiService.generateReschedule({
          currentWeek: `Week of ${new Date().toLocaleDateString()}`,
          backlogTasks,
          completionHistory,
          deadlinePressure,
          stressLevel: "medium", // Could be determined from user behavior
          energyTrends: "Not specified", // Could be tracked over time
          fixedCommitments,
        });

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "reschedule",
          rescheduleContent
        );

        return {
          suggestionId: suggestion.id,
          content: rescheduleContent,
          message: "Rescheduling suggestions generated successfully",
        };
      } catch (error) {
        console.error("Generate reschedule error:", error);
        throw new Error(
          `Failed to generate reschedule: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get user's AI suggestions
   */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        type: z.enum(["plan", "briefing", "reschedule"]).optional(),
        isApplied: z.boolean().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const suggestions = await aiQueries.getUserSuggestions(userId, {
          type: input.type,
          isApplied: input.isApplied,
          limit: input.limit,
        });

        return {
          suggestions,
          count: suggestions.length,
        };
      } catch (error) {
        console.error("Get suggestions error:", error);
        throw new Error(
          `Failed to get suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Apply an AI suggestion
   */
  applySuggestion: protectedProcedure
    .input(
      z.object({
        suggestionId: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        // Get the suggestion
        const suggestion = await aiQueries.getSuggestionById(
          input.suggestionId
        );
        if (!suggestion) {
          throw new Error("Suggestion not found");
        }

        if (suggestion.userId !== userId) {
          throw new Error("Access denied");
        }

        if (suggestion.isApplied) {
          return {
            message: "Suggestion already applied",
            suggestion,
          };
        }

        // Mark as applied
        await aiQueries.markAsApplied(input.suggestionId);

        // Here you would implement the actual application logic
        // For example, creating tasks/goals from a plan suggestion
        // This would depend on your specific business logic

        return {
          message: "Suggestion applied successfully",
          suggestion: { ...suggestion, isApplied: true },
        };
      } catch (error) {
        console.error("Apply suggestion error:", error);
        throw new Error(
          `Failed to apply suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get AI usage statistics
   */
  getStats: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      const stats = await aiQueries.getUserStats(userId);
      return stats;
    } catch (error) {
      console.error("Get stats error:", error);
      throw new Error(
        `Failed to get stats: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }),

  /**
   * Clean up old suggestions
   */
  cleanupSuggestions: protectedProcedure
    .input(
      z.object({
        daysOld: z.number().min(1).max(365).default(30),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        await aiQueries.deleteOldSuggestions(userId, input.daysOld);
        return {
          message: `Cleaned up suggestions older than ${input.daysOld} days`,
        };
      } catch (error) {
        console.error("Cleanup error:", error);
        throw new Error(
          `Failed to cleanup: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
};

export type AIRouter = typeof aiRouter;
export type AIRouterClient = RouterClient<typeof aiRouter>;
