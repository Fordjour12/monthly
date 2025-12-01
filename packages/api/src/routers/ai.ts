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
import { getSuggestionApplicator } from "../suggestion-applicator";

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
   * Generate a monthly plan with streaming progress updates
   */
  generatePlanStream: protectedProcedure
    .input(
      z.object({
        userGoals: z.string().min(10, "Please provide more detailed goals"),
        workHours: z.string().optional(),
        energyPatterns: z.string().optional(),
        preferredTimes: z.string().optional(),
      })
    )
    .handler(async function* ({ input, context }) {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        yield {
          type: "progress",
          stage: "validation",
          message: "Validating input...",
        };

        // Check if there's already a recent plan suggestion
        yield {
          type: "progress",
          stage: "checking",
          message: "Checking for recent plans...",
        };
        const recentPlans = await aiQueries.getRecentByType(userId, "plan", 2);
        if (recentPlans.length > 0) {
          const recentPlan = recentPlans[0]!;
          yield {
            type: "complete",
            suggestionId: recentPlan.id,
            content: recentPlan.content,
            isRecent: true,
            message:
              "Using recently generated plan. Generate new plan in 2 hours if needed.",
          };
          return;
        }

        // Gather user context
        yield {
          type: "progress",
          stage: "context",
          message: "Gathering your current context...",
        };
        const currentTasks = await taskQueries.findToday(userId);
        yield {
          type: "progress",
          stage: "context",
          message: "Loading habits...",
        };
        const habits = await habitQueries.findByUser(userId);
        yield {
          type: "progress",
          stage: "context",
          message: "Checking calendar events...",
        };
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

        yield {
          type: "progress",
          stage: "generating",
          message: "Generating your personalized monthly plan...",
          context: {
            currentTasksCount: currentTasks.length,
            habitsCount: habits.length,
            eventsCount: todayEvents.length,
            commitmentsCount: existingCommitments.length,
          },
        };

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

        yield {
          type: "progress",
          stage: "saving",
          message: "Saving your plan...",
        };

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "plan",
          planContent
        );

        yield {
          type: "complete",
          suggestionId: suggestion.id,
          content: planContent,
          isRecent: false,
          message: "Monthly plan generated successfully",
        };
      } catch (error) {
        console.error("Generate plan stream error:", error);
        yield {
          type: "error",
          message: `Failed to generate plan: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
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
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);
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

        // Get yesterday's progress if requested
        let yesterdayProgress = "";
        if (input.includeYesterdayProgress) {
          const yesterdaysTasks = await taskQueries.findByDateRange(
            userId,
            yesterday,
            targetDate
          );
          const completedCount = yesterdaysTasks.filter(
            (t) => t.status === "completed"
          ).length;
          const totalCount = yesterdaysTasks.length;
          yesterdayProgress = `Completed ${completedCount} of ${totalCount} tasks yesterday`;
        }

        // Get habit streaks
        const habits = await habitQueries.findByUser(userId);
        const habitStreaks: Record<string, number> = {};
        for (const habit of habits) {
          const streak = await habitQueries.updateStreak(habit.id);
          habitStreaks[habit.id] = streak;
        }

        // Generate briefing using AI service
        const aiService = getAIService();
        const briefingContent = await aiService.generateBriefing({
          currentDate: targetDate.toISOString().split("T")[0]!,
          todaysTasks: todaysTasks.map((t) => ({
            title: t.title,
            priority: t.priority,
          })),
          yesterdayProgress,
          habitStreaks,
          nearDeadlines: upcomingDeadlines,
          energyLevels: "Not specified", // Could be tracked over time
        });

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "briefing",
          briefingContent
        );

        return {
          suggestionId: suggestion.id,
          content: briefingContent,
          isRecent: false,
          message: "Daily briefing generated successfully",
        };
      } catch (error) {
        console.error("Generate briefing error:", error);
        throw new Error(
          `Failed to generate briefing: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Generate a daily briefing with streaming progress updates
   */
  generateBriefingStream: protectedProcedure
    .input(
      z.object({
        date: z.string().optional(),
        includeYesterdayProgress: z.boolean().default(true),
      })
    )
    .handler(async function* ({ input, context }) {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        yield {
          type: "progress",
          stage: "validation",
          message: "Validating request...",
        };

        // Check if there's already a recent briefing for today
        yield {
          type: "progress",
          stage: "checking",
          message: "Checking for recent briefings...",
        };
        const recentBriefings = await aiQueries.getRecentByType(
          userId,
          "briefing",
          1
        );
        if (recentBriefings.length > 0) {
          const recentBriefing = recentBriefings[0]!;
          yield {
            type: "complete",
            suggestionId: recentBriefing.id,
            content: recentBriefing.content,
            isRecent: true,
            message:
              "Using today's briefing. Generate new one in 1 hour if needed.",
          };
          return;
        }

        // Gather today's context
        const targetDate = input.date ? new Date(input.date) : new Date();
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(targetDate);
        tomorrow.setDate(tomorrow.getDate() + 1);

        yield {
          type: "progress",
          stage: "context",
          message: "Gathering today's tasks...",
        };
        const todaysTasks = await taskQueries.findByDateRange(
          userId,
          targetDate,
          tomorrow
        );

        yield {
          type: "progress",
          stage: "context",
          message: "Checking upcoming deadlines...",
        };
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

        // Get yesterday's progress if requested
        let yesterdayProgress = "";
        if (input.includeYesterdayProgress) {
          yield {
            type: "progress",
            stage: "context",
            message: "Analyzing yesterday's progress...",
          };
          const yesterdaysTasks = await taskQueries.findByDateRange(
            userId,
            yesterday,
            targetDate
          );
          const completedCount = yesterdaysTasks.filter(
            (t) => t.status === "completed"
          ).length;
          const totalCount = yesterdaysTasks.length;
          yesterdayProgress = `Completed ${completedCount} of ${totalCount} tasks yesterday`;
        }

        // Get habit streaks
        yield {
          type: "progress",
          stage: "context",
          message: "Loading habit streaks...",
        };
        const habits = await habitQueries.findByUser(userId);
        const habitStreaks: Record<string, number> = {};
        for (const habit of habits) {
          const streak = await habitQueries.updateStreak(habit.id);
          habitStreaks[habit.id] = streak;
        }

        // Get fixed commitments
        yield {
          type: "progress",
          stage: "context",
          message: "Checking calendar commitments...",
        };
        const fixedCommitments = await calendarQueries
          .findToday(userId)
          .then((events) =>
            events.map(
              (e) => `${e.title} at ${e.startTime.toLocaleTimeString()}`
            )
          );

        yield {
          type: "progress",
          stage: "generating",
          message: "Generating your daily briefing...",
          context: {
            todaysTasksCount: todaysTasks.length,
            upcomingDeadlinesCount: upcomingDeadlines.length,
            habitsCount: habits.length,
            commitmentsCount: fixedCommitments.length,
          },
        };

        // Generate briefing using AI service
        const aiService = getAIService();
        const briefingContent = await aiService.generateBriefing({
          currentDate: targetDate.toISOString().split("T")[0]!,
          todaysTasks: todaysTasks.map((t) => ({
            title: t.title,
            priority: t.priority,
          })),
          yesterdayProgress,
          habitStreaks,
          nearDeadlines: upcomingDeadlines,
          energyLevels: "Not specified", // Could be tracked over time
        });

        yield {
          type: "progress",
          stage: "saving",
          message: "Saving your briefing...",
        };

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "briefing",
          briefingContent
        );

        yield {
          type: "complete",
          suggestionId: suggestion.id,
          content: briefingContent,
          isRecent: false,
          message: "Daily briefing generated successfully",
        };
      } catch (error) {
        console.error("Generate briefing stream error:", error);
        yield {
          type: "error",
          message: `Failed to generate briefing: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
        throw new Error(
          `Failed to generate briefing: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Generate rescheduling suggestions with streaming progress updates
   */
  generateRescheduleStream: protectedProcedure
    .input(
      z.object({
        conflicts: z
          .array(
            z.object({
              type: z.enum(["task", "event"]),
              id: z.string(),
              title: z.string(),
              currentDateTime: z.string(),
              reason: z.string(),
            })
          )
          .optional(),
        backlogDays: z.number().default(7),
      })
    )
    .handler(async function* ({ input, context }) {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        yield {
          type: "progress",
          stage: "validation",
          message: "Validating reschedule request...",
        };

        // Get backlog tasks
        yield {
          type: "progress",
          stage: "analysis",
          message: "Analyzing backlog tasks...",
        };
        const backlogDate = new Date();
        backlogDate.setDate(backlogDate.getDate() - input.backlogDays);

        const backlogTasks = (
          await taskQueries.findByUser(userId, {
            status: "pending",
          })
        )
          .filter((task) => task.dueDate && new Date(task.dueDate) < new Date())
          .map((task) => ({
            title: task.title,
            priority: task.priority,
            dueDate: new Date(task.dueDate!).toISOString().split("T")[0],
          }));

        if (backlogTasks.length === 0 && !input.conflicts?.length) {
          yield {
            type: "complete",
            suggestionId: null,
            content: null,
            message: "No rescheduling needed - no backlog or conflicts found",
          };
          return;
        }

        // Get completion history for the past week
        yield {
          type: "progress",
          stage: "analysis",
          message: "Analyzing completion patterns...",
        };
        const completionHistory = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);

          const dayTasks = await taskQueries.findByDateRange(
            userId,
            date,
            nextDay
          );
          const completed = dayTasks.filter(
            (t) => t.status === "completed"
          ).length;
          const total = dayTasks.length;

          completionHistory.push({
            date: date.toISOString().split("T")[0]!,
            completed,
            total,
          });
        }

        // Get upcoming deadlines
        yield {
          type: "progress",
          stage: "analysis",
          message: "Checking deadline pressure...",
        };
        const deadlinePressure = (
          await taskQueries.findByUser(userId, {
            status: "pending",
          })
        )
          .filter(
            (task) =>
              task.dueDate &&
              new Date(task.dueDate) <=
                new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          )
          .map((task) => ({
            title: task.title,
            daysUntil: Math.ceil(
              (new Date(task.dueDate!).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            ),
          }));

        // Get fixed commitments
        yield {
          type: "progress",
          stage: "analysis",
          message: "Loading calendar constraints...",
        };
        const fixedCommitments = await calendarQueries
          .findToday(userId)
          .then((events) =>
            events.map(
              (e) => `${e.title} at ${e.startTime.toLocaleTimeString()}`
            )
          );

        yield {
          type: "progress",
          stage: "generating",
          message: "Optimizing your schedule...",
          context: {
            backlogTasksCount: backlogTasks.length,
            conflictsCount: input.conflicts?.length || 0,
            deadlinePressureCount: deadlinePressure.length,
            commitmentsCount: fixedCommitments.length,
          },
        };

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

        yield {
          type: "progress",
          stage: "saving",
          message: "Saving rescheduling suggestions...",
        };

        // Save suggestion to database
        const suggestion = await aiQueries.createSuggestion(
          userId,
          "reschedule",
          rescheduleContent
        );

        yield {
          type: "complete",
          suggestionId: suggestion.id,
          content: rescheduleContent,
          message: "Rescheduling suggestions generated successfully",
        };
      } catch (error) {
        console.error("Generate reschedule stream error:", error);
        yield {
          type: "error",
          message: `Failed to generate reschedule: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
        throw new Error(
          `Failed to generate reschedule: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Generate rescheduling suggestions
   */
  generateReschedule: protectedProcedure
    .input(
      z.object({
        conflicts: z
          .array(
            z.object({
              type: z.enum(["task", "event"]),
              id: z.string(),
              title: z.string(),
              currentDateTime: z.string(),
              reason: z.string(),
            })
          )
          .optional(),
        backlogDays: z.number().default(7),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        // Get backlog tasks
        const backlogDate = new Date();
        backlogDate.setDate(backlogDate.getDate() - input.backlogDays);

        const backlogTasks = (
          await taskQueries.findByUser(userId, {
            status: "pending",
          })
        )
          .filter((task) => task.dueDate && new Date(task.dueDate) < new Date())
          .map((task) => ({
            title: task.title,
            priority: task.priority,
            dueDate: new Date(task.dueDate!).toISOString().split("T")[0],
          }));

        if (backlogTasks.length === 0 && !input.conflicts?.length) {
          return {
            suggestionId: null,
            content: null,
            message: "No rescheduling needed - no backlog or conflicts found",
          };
        }

        // Get completion history for the past week
        const completionHistory = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);

          const dayTasks = await taskQueries.findByDateRange(
            userId,
            date,
            nextDay
          );
          const completed = dayTasks.filter(
            (t) => t.status === "completed"
          ).length;
          const total = dayTasks.length;

          completionHistory.push({
            date: date.toISOString().split("T")[0]!,
            completed,
            total,
          });
        }

        // Get upcoming deadlines
        const deadlinePressure = (
          await taskQueries.findByUser(userId, {
            status: "pending",
          })
        )
          .filter(
            (task) =>
              task.dueDate &&
              new Date(task.dueDate) <=
                new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          )
          .map((task) => ({
            title: task.title,
            daysUntil: Math.ceil(
              (new Date(task.dueDate!).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            ),
          }));

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
   * Get user's AI suggestions with enhanced filtering and pagination
   */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        type: z.enum(["plan", "briefing", "reschedule"]).optional(),
        isApplied: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(["createdAt", "updatedAt", "type"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const suggestions = await aiQueries.getUserSuggestionsEnhanced(userId, {
          type: input.type,
          isApplied: input.isApplied,
          limit: input.limit,
          offset: input.offset,
          search: input.search,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
        });

        const totalCount = await aiQueries.getUserSuggestionsCount(userId, {
          type: input.type,
          isApplied: input.isApplied,
          search: input.search,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        });

        return {
          suggestions,
          count: suggestions.length,
          totalCount,
          hasMore: input.offset + suggestions.length < totalCount,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            totalPages: Math.ceil(totalCount / input.limit),
            currentPage: Math.floor(input.offset / input.limit) + 1,
          },
        };
      } catch (error) {
        console.error("Get suggestions error:", error);
        throw new Error(
          `Failed to get suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Archive a suggestion (soft delete)
   */
  archiveSuggestion: protectedProcedure
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
        const suggestion = await aiQueries.getSuggestionById(
          input.suggestionId
        );
        if (!suggestion) {
          throw new Error("Suggestion not found");
        }

        if (suggestion.userId !== userId) {
          throw new Error("Access denied");
        }

        await aiQueries.archiveSuggestion(input.suggestionId);

        return {
          message: "Suggestion archived successfully",
          suggestionId: input.suggestionId,
        };
      } catch (error) {
        console.error("Archive suggestion error:", error);
        throw new Error(
          `Failed to archive suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Restore an archived suggestion
   */
  restoreSuggestion: protectedProcedure
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
        const suggestion = await aiQueries.getSuggestionById(
          input.suggestionId
        );
        if (!suggestion) {
          throw new Error("Suggestion not found");
        }

        if (suggestion.userId !== userId) {
          throw new Error("Access denied");
        }

        await aiQueries.restoreSuggestion(input.suggestionId);

        return {
          message: "Suggestion restored successfully",
          suggestionId: input.suggestionId,
        };
      } catch (error) {
        console.error("Restore suggestion error:", error);
        throw new Error(
          `Failed to restore suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Duplicate a suggestion
   */
  duplicateSuggestion: protectedProcedure
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
        const originalSuggestion = await aiQueries.getSuggestionById(
          input.suggestionId
        );
        if (!originalSuggestion) {
          throw new Error("Suggestion not found");
        }

        if (originalSuggestion.userId !== userId) {
          throw new Error("Access denied");
        }

        const duplicatedSuggestion = await aiQueries.duplicateSuggestion(
          input.suggestionId,
          userId
        );

        return {
          message: "Suggestion duplicated successfully",
          suggestion: duplicatedSuggestion,
        };
      } catch (error) {
        console.error("Duplicate suggestion error:", error);
        throw new Error(
          `Failed to duplicate suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Batch apply multiple suggestions
   */
  batchApplySuggestions: protectedProcedure
    .input(
      z.object({
        suggestionIds: z.array(z.string()).min(1).max(10),
        options: z
          .object({
            applyAll: z.boolean().default(true),
            selectedItems: z.array(z.string()).optional(),
            dryRun: z.boolean().default(false),
          })
          .optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const applicator = getSuggestionApplicator();
        const results = [];

        for (const suggestionId of input.suggestionIds) {
          try {
            const suggestion = await aiQueries.getSuggestionById(suggestionId);
            if (!suggestion) {
              results.push({
                suggestionId,
                success: false,
                error: "Suggestion not found",
              });
              continue;
            }

            if (suggestion.userId !== userId) {
              results.push({
                suggestionId,
                success: false,
                error: "Access denied",
              });
              continue;
            }

            if (suggestion.isApplied && !input.options?.dryRun) {
              results.push({
                suggestionId,
                success: false,
                error: "Suggestion already applied",
              });
              continue;
            }

            const result = await applicator.applySuggestion(
              suggestion,
              input.options || { applyAll: true }
            );

            if (!input.options?.dryRun && result.success) {
              await aiQueries.markAsApplied(suggestionId);
            }

            results.push({
              suggestionId,
              success: result.success,
              result,
              error: result.success ? null : result.message,
            });
          } catch (error) {
            results.push({
              suggestionId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.length - successCount;

        return {
          message: `Batch operation completed: ${successCount} successful, ${failureCount} failed`,
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount,
          },
        };
      } catch (error) {
        console.error("Batch apply suggestions error:", error);
        throw new Error(
          `Failed to batch apply suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
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
        options: z
          .object({
            applyAll: z.boolean().default(true),
            selectedItems: z.array(z.string()).optional(),
            dryRun: z.boolean().default(false),
          })
          .optional(),
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

        if (suggestion.isApplied && !input.options?.dryRun) {
          return {
            message: "Suggestion already applied",
            suggestion,
            result: null,
          };
        }

        // Apply the suggestion using the applicator
        const applicator = getSuggestionApplicator();
        const result = await applicator.applySuggestion(
          suggestion,
          input.options || { applyAll: true }
        );

        // Mark as applied if not a dry run and application was successful
        if (!input.options?.dryRun && result.success) {
          await aiQueries.markAsApplied(input.suggestionId);
        }

        return {
          message: result.message,
          suggestion: input.options?.dryRun
            ? suggestion
            : { ...suggestion, isApplied: true },
          result,
        };
      } catch (error) {
        console.error("Apply suggestion error:", error);
        throw new Error(
          `Failed to apply suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Preview what would be applied from a suggestion
   */
  previewSuggestion: protectedProcedure
    .input(
      z.object({
        suggestionId: z.string(),
        options: z
          .object({
            applyAll: z.boolean().default(true),
            selectedItems: z.array(z.string()).optional(),
          })
          .optional(),
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

        // Preview the suggestion using the applicator
        const applicator = getSuggestionApplicator();
        const result = await applicator.previewSuggestion(
          suggestion,
          input.options || { applyAll: true }
        );

        return {
          message: "Preview generated successfully",
          suggestion,
          result,
        };
      } catch (error) {
        console.error("Preview suggestion error:", error);
        throw new Error(
          `Failed to preview suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
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
   * Get suggestion effectiveness analytics
   */
  getEffectiveness: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      const effectiveness = await aiQueries.getSuggestionEffectiveness(userId);
      return effectiveness;
    } catch (error) {
      console.error("Get effectiveness error:", error);
      throw new Error(
        `Failed to get effectiveness: ${error instanceof Error ? error.message : "Unknown error"}`
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
