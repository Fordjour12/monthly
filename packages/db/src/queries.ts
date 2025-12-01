import { eq, and, desc, gte, lte, lt } from "drizzle-orm";
import { db } from "./index";
import {
  goals,
  tasks,
  habits,
  habitLogs,
  calendarEvents,
  aiSuggestions,
} from "./schema";
import type {
  Goal,
  Task,
  Habit,
  HabitLog,
  CalendarEvent,
  AISuggestion,
  NewAISuggestion,
  AISuggestionType,
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

    return db.query.goals.findMany({
      where: and(...conditions),
      orderBy: [desc(goals.createdAt)],
    });
  },

  /**
   * Get a goal by ID
   */
  async findById(goalId: string): Promise<Goal | undefined> {
    return db.query.goals.findFirst({
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

    return db.query.tasks.findMany({
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
    return db.query.tasks.findMany({
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

    return taskQueries.findByDateRange(userId, today, tomorrow);
  },

  /**
   * Get overdue tasks
   */
  async findOverdue(userId: string): Promise<Task[]> {
    const now = new Date();

    return db.query.tasks.findMany({
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
    return db.query.tasks.findMany({
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
    return db.query.habits.findMany({
      where: eq(habits.userId, userId),
      orderBy: [desc(habits.createdAt)],
    });
  },

  /**
   * Get a habit by ID
   */
  async findById(habitId: string): Promise<Habit | undefined> {
    return db.query.habits.findFirst({
      where: eq(habits.id, habitId),
    });
  },

  /**
   * Get habit logs for a habit
   */
  async findLogs(habitId: string, limit = 30): Promise<HabitLog[]> {
    return db.query.habitLogs.findMany({
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

    return db.query.habitLogs.findFirst({
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
    return db.query.calendarEvents.findMany({
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

    return calendarQueries.findByDateRange(userId, today, tomorrow);
  },

  /**
   * Get events for a specific task
   */
  async findByTask(taskId: string): Promise<CalendarEvent[]> {
    return db.query.calendarEvents.findMany({
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

    return db.query.aiSuggestions.findMany({
      where: and(...conditions),
      orderBy: [desc(aiSuggestions.createdAt)],
      limit: filters?.limit,
    });
  },

  /**
   * Get a specific suggestion by ID
   */
  async getSuggestionById(
    suggestionId: string
  ): Promise<AISuggestion | undefined> {
    return db.query.aiSuggestions.findFirst({
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
  async deleteOldSuggestions(
    userId: string,
    daysOld: number = 30
  ): Promise<void> {
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
    hoursOld: number = 24
  ): Promise<AISuggestion[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursOld);

    return db.query.aiSuggestions.findMany({
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
};
