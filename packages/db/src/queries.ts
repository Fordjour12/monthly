import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "./index";
import {
  aiSuggestions,
  calendarEvents,
  goals,
  habitLogs,
  habits,
  tasks,
} from "./schema";
import type {
  AISuggestion,
  AISuggestionType,
  CalendarEvent,
  Goal,
  Habit,
  HabitLog,
  NewAISuggestion,
  Task,
} from "./types";

/**
 * Goal queries
 */
export const goalQueries = {
  /**
   * Get all goals for a user with optional status filter
   */
  async findByUser(
    userId: string,
    status?: "active" | "completed" | "archived"
  ): Promise<Goal[]> {
    const conditions = [eq(goals.userId, userId)];
    if (status) {
      conditions.push(eq(goals.status, status));
    }

    return await db.query.goals.findMany({
      where: and(...conditions),
      orderBy: [desc(goals.createdAt)],
    });
  },

  /**
   * Get a goal by ID
   */
  async findById(goalId: string): Promise<Goal | undefined> {
    return await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    });
  },

  /**
   * Update goal progress based on completed tasks
   */
  async updateProgress(goalId: string): Promise<void> {
    const goalTasks = await db.query.tasks.findMany({
      where: eq(tasks.goalId, goalId),
    });

    if (goalTasks.length === 0) return;

    const completedTasks = goalTasks.filter((t) => t.status === "completed");
    const progress = Math.round(
      (completedTasks.length / goalTasks.length) * 100
    );

    await db.update(goals).set({ progress }).where(eq(goals.id, goalId));
  },
};

/**
 * Task queries
 */
export const taskQueries = {
  /**
   * Get all tasks for a user with optional filters
   */
  async findByUser(
    userId: string,
    filters?: {
      status?: "pending" | "completed" | "skipped";
      priority?: "low" | "medium" | "high";
      goalId?: string;
    }
  ): Promise<Task[]> {
    const conditions = [eq(tasks.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    if (filters?.goalId) {
      conditions.push(eq(tasks.goalId, filters.goalId));
    }

    return await db.query.tasks.findMany({
      where: and(...conditions),
      orderBy: [desc(tasks.dueDate)],
    });
  },

  /**
   * Get tasks due within a date range
   */
  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Task[]> {
    return await db.query.tasks.findMany({
      where: and(
        eq(tasks.userId, userId),
        gte(tasks.dueDate, startDate),
        lte(tasks.dueDate, endDate)
      ),
      orderBy: [desc(tasks.dueDate)],
    });
  },

  /**
   * Get today's tasks
   */
  async findToday(userId: string): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await taskQueries.findByDateRange(userId, today, tomorrow);
  },

  /**
   * Get overdue tasks
   */
  async findOverdue(userId: string): Promise<Task[]> {
    const now = new Date();

    return await db.query.tasks.findMany({
      where: and(
        eq(tasks.userId, userId),
        eq(tasks.status, "pending"),
        lte(tasks.dueDate, now)
      ),
      orderBy: [desc(tasks.dueDate)],
    });
  },

  /**
   * Get tasks for a specific goal
   */
  async findByGoal(goalId: string): Promise<Task[]> {
    return await db.query.tasks.findMany({
      where: eq(tasks.goalId, goalId),
      orderBy: [desc(tasks.dueDate)],
    });
  },
};

/**
 * Habit queries
 */
export const habitQueries = {
  /**
   * Get all habits for a user
   */
  async findByUser(userId: string): Promise<Habit[]> {
    return await db.query.habits.findMany({
      where: eq(habits.userId, userId),
      orderBy: [desc(habits.createdAt)],
    });
  },

  /**
   * Get a habit by ID
   */
  async findById(habitId: string): Promise<Habit | undefined> {
    return await db.query.habits.findFirst({
      where: eq(habits.id, habitId),
    });
  },

  /**
   * Get habit logs for a habit
   */
  async findLogs(habitId: string, limit = 30): Promise<HabitLog[]> {
    return await db.query.habitLogs.findMany({
      where: eq(habitLogs.habitId, habitId),
      orderBy: [desc(habitLogs.date)],
      limit,
    });
  },

  /**
   * Get habit log for a specific date
   */
  async findLogByDate(
    habitId: string,
    date: Date
  ): Promise<HabitLog | undefined> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    return await db.query.habitLogs.findFirst({
      where: and(
        eq(habitLogs.habitId, habitId),
        gte(habitLogs.date, dateStart),
        lte(habitLogs.date, dateEnd)
      ),
    });
  },

  /**
   * Calculate and update habit streak
   */
  async updateStreak(habitId: string): Promise<number> {
    const logs = await db.query.habitLogs.findMany({
      where: eq(habitLogs.habitId, habitId),
      orderBy: [desc(habitLogs.date)],
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const log of logs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === streak && log.status === "completed") {
        streak++;
      } else {
        break;
      }
    }

    await db
      .update(habits)
      .set({ currentStreak: streak })
      .where(eq(habits.id, habitId));

    return streak;
  },
};

/**
 * Calendar queries
 */
export const calendarQueries = {
  /**
   * Get events within a date range
   */
  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.userId, userId),
        gte(calendarEvents.startTime, startDate),
        lte(calendarEvents.startTime, endDate)
      ),
      orderBy: [desc(calendarEvents.startTime)],
    });
  },

  /**
   * Get today's events
   */
  async findToday(userId: string): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await calendarQueries.findByDateRange(userId, today, tomorrow);
  },

  /**
   * Get events for a specific task
   */
  async findByTask(taskId: string): Promise<CalendarEvent[]> {
    return await db.query.calendarEvents.findMany({
      where: eq(calendarEvents.taskId, taskId),
      orderBy: [desc(calendarEvents.startTime)],
    });
  },
};

/**
 * AI Suggestion queries
 */
export const aiQueries = {
  /**
   * Create a new AI suggestion
   */
  async createSuggestion(
    userId: string,
    type: AISuggestionType,
    content: any
  ): Promise<AISuggestion> {
    const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSuggestion: NewAISuggestion = {
      id,
      userId,
      type,
      content,
      isApplied: false,
    };

    const suggestions = await db
      .insert(aiSuggestions)
      .values(newSuggestion)
      .returning();

    return suggestions[0]!;
  },

  /**
   * Get all suggestions for a user with optional filters
   */
  async getUserSuggestions(
    userId: string,
    filters?: {
      type?: AISuggestionType;
      isApplied?: boolean;
      limit?: number;
    }
  ): Promise<AISuggestion[]> {
    const conditions = [eq(aiSuggestions.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(aiSuggestions.type, filters.type));
    }
    if (filters?.isApplied !== undefined) {
      conditions.push(eq(aiSuggestions.isApplied, filters.isApplied));
    }

    return await db.query.aiSuggestions.findMany({
      where: and(...conditions),
      orderBy: [desc(aiSuggestions.createdAt)],
      limit: filters?.limit,
    });
  },

  /**
   * Get enhanced suggestions for a user with advanced filtering and pagination
   */
  async getUserSuggestionsEnhanced(
    userId: string,
    filters?: {
      type?: AISuggestionType;
      isApplied?: boolean;
      limit?: number;
      offset?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
      sortBy?: "createdAt" | "updatedAt" | "type";
      sortOrder?: "asc" | "desc";
    }
  ): Promise<AISuggestion[]> {
    const conditions = [eq(aiSuggestions.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(aiSuggestions.type, filters.type));
    }
    if (filters?.isApplied !== undefined) {
      conditions.push(eq(aiSuggestions.isApplied, filters.isApplied));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(aiSuggestions.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(aiSuggestions.createdAt, filters.dateTo));
    }

    // Search functionality - search in content (JSON field)
    if (filters?.search) {
      // This is a simplified search - in production you might want full-text search
      conditions.push(
        sql`LOWER(CAST(${aiSuggestions.content} AS TEXT)) LIKE ${`%${filters.search.toLowerCase()}%`}`
      );
    }

    // Determine sort order
    let orderBy;
    const sortField =
      filters?.sortBy === "type"
        ? aiSuggestions.type
        : filters?.sortBy === "updatedAt"
          ? aiSuggestions.updatedAt
          : aiSuggestions.createdAt;

    orderBy = filters?.sortOrder === "asc" ? [sortField] : [desc(sortField)];

    return await db.query.aiSuggestions.findMany({
      where: and(...conditions),
      orderBy,
      limit: filters?.limit,
      offset: filters?.offset,
    });
  },

  /**
   * Get count of suggestions for a user with filters
   */
  async getUserSuggestionsCount(
    userId: string,
    filters?: {
      type?: AISuggestionType;
      isApplied?: boolean;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<number> {
    const conditions = [eq(aiSuggestions.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(aiSuggestions.type, filters.type));
    }
    if (filters?.isApplied !== undefined) {
      conditions.push(eq(aiSuggestions.isApplied, filters.isApplied));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(aiSuggestions.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(aiSuggestions.createdAt, filters.dateTo));
    }

    if (filters?.search) {
      conditions.push(
        sql`LOWER(CAST(${aiSuggestions.content} AS TEXT)) LIKE ${`%${filters.search.toLowerCase()}%`}`
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiSuggestions)
      .where(and(...conditions));

    return result[0]?.count || 0;
  },

  /**
   * Get a specific suggestion by ID
   */
  async getSuggestionById(
    suggestionId: string
  ): Promise<AISuggestion | undefined> {
    return await db.query.aiSuggestions.findFirst({
      where: eq(aiSuggestions.id, suggestionId),
    });
  },

  /**
   * Mark a suggestion as applied
   */
  async markAsApplied(suggestionId: string): Promise<void> {
    await db
      .update(aiSuggestions)
      .set({ isApplied: true })
      .where(eq(aiSuggestions.id, suggestionId));
  },

  /**
   * Delete old suggestions to clean up database
   */
  async deleteOldSuggestions(userId: string, daysOld = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db.delete(aiSuggestions).where(
      and(
        eq(aiSuggestions.userId, userId),
        lt(aiSuggestions.createdAt, cutoffDate),
        eq(aiSuggestions.isApplied, false) // Only delete unapplied suggestions
      )
    );
  },

  /**
   * Get recent suggestions for a specific type
   */
  async getRecentByType(
    userId: string,
    type: AISuggestionType,
    hoursOld = 24
  ): Promise<AISuggestion[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursOld);

    return await db.query.aiSuggestions.findMany({
      where: and(
        eq(aiSuggestions.userId, userId),
        eq(aiSuggestions.type, type),
        gte(aiSuggestions.createdAt, cutoffDate)
      ),
      orderBy: [desc(aiSuggestions.createdAt)],
      limit: 5,
    });
  },

  /**
   * Get suggestion statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    applied: number;
    pending: number;
    byType: Record<AISuggestionType, number>;
  }> {
    const allSuggestions = await db.query.aiSuggestions.findMany({
      where: eq(aiSuggestions.userId, userId),
    });

    const stats = {
      total: allSuggestions.length,
      applied: allSuggestions.filter((s) => s.isApplied).length,
      pending: allSuggestions.filter((s) => !s.isApplied).length,
      byType: {
        plan: 0,
        briefing: 0,
        reschedule: 0,
      } as Record<AISuggestionType, number>,
    };

    allSuggestions.forEach((suggestion) => {
      stats.byType[suggestion.type]++;
    });

    return stats;
  },

  /**
   * Archive a suggestion (soft delete)
   */
  async archiveSuggestion(suggestionId: string): Promise<void> {
    await db
      .update(aiSuggestions)
      .set({
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(eq(aiSuggestions.id, suggestionId));
  },

  /**
   * Restore an archived suggestion
   */
  async restoreSuggestion(suggestionId: string): Promise<void> {
    await db
      .update(aiSuggestions)
      .set({
        isArchived: false,
        updatedAt: new Date(),
      })
      .where(eq(aiSuggestions.id, suggestionId));
  },

  /**
   * Duplicate a suggestion
   */
  async duplicateSuggestion(
    originalSuggestionId: string,
    userId: string
  ): Promise<AISuggestion> {
    const original = await db.query.aiSuggestions.findFirst({
      where: eq(aiSuggestions.id, originalSuggestionId),
    });

    if (!original) {
      throw new Error("Original suggestion not found");
    }

    const newId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const duplicated = await db
      .insert(aiSuggestions)
      .values({
        id: newId,
        userId,
        type: original.type,
        content: original.content,
        isApplied: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return duplicated[0]!;
  },

  /**
   * Get archived suggestions
   */
  async getArchivedSuggestions(
    userId: string,
    limit = 20
  ): Promise<AISuggestion[]> {
    return await db.query.aiSuggestions.findMany({
      where: and(
        eq(aiSuggestions.userId, userId),
        eq(aiSuggestions.isArchived, true)
      ),
      orderBy: [desc(aiSuggestions.updatedAt)],
      limit,
    });
  },

  /**
   * Permanently delete a suggestion
   */
  async deleteSuggestion(suggestionId: string): Promise<void> {
    await db.delete(aiSuggestions).where(eq(aiSuggestions.id, suggestionId));
  },

  /**
   * Get suggestion effectiveness metrics
   */
  async getSuggestionEffectiveness(userId: string): Promise<{
    totalApplied: number;
    totalGenerated: number;
    applicationRate: number;
    byType: Record<
      AISuggestionType,
      {
        generated: number;
        applied: number;
        rate: number;
      }
    >;
  }> {
    const allSuggestions = await db.query.aiSuggestions.findMany({
      where: eq(aiSuggestions.userId, userId),
    });

    const totalGenerated = allSuggestions.length;
    const totalApplied = allSuggestions.filter((s) => s.isApplied).length;
    const applicationRate =
      totalGenerated > 0 ? (totalApplied / totalGenerated) * 100 : 0;

    const byType = {
      plan: { generated: 0, applied: 0, rate: 0 },
      briefing: { generated: 0, applied: 0, rate: 0 },
      reschedule: { generated: 0, applied: 0, rate: 0 },
    } as Record<
      AISuggestionType,
      { generated: number; applied: number; rate: number }
    >;

    allSuggestions.forEach((suggestion) => {
      byType[suggestion.type].generated++;
      if (suggestion.isApplied) {
        byType[suggestion.type].applied++;
      }
    });

    // Calculate rates
    Object.keys(byType).forEach((type) => {
      const typeKey = type as AISuggestionType;
      const generated = byType[typeKey].generated;
      const applied = byType[typeKey].applied;
      byType[typeKey].rate = generated > 0 ? (applied / generated) * 100 : 0;
    });

    return {
      totalApplied,
      totalGenerated,
      applicationRate,
      byType,
    };
  },
};
