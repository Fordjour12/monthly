import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  user,
  goals,
  tasks,
  habits,
  habitLogs,
  calendarEvents,
  aiSuggestions,
} from "./schema";

// Select types (for reading from database)
export type User = InferSelectModel<typeof user>;
export type Goal = InferSelectModel<typeof goals>;
export type Task = InferSelectModel<typeof tasks>;
export type Habit = InferSelectModel<typeof habits>;
export type HabitLog = InferSelectModel<typeof habitLogs>;
export type CalendarEvent = InferSelectModel<typeof calendarEvents>;
export type AISuggestion = InferSelectModel<typeof aiSuggestions>;

// Insert types (for writing to database)
export type NewUser = InferInsertModel<typeof user>;
export type NewGoal = InferInsertModel<typeof goals>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewHabit = InferInsertModel<typeof habits>;
export type NewHabitLog = InferInsertModel<typeof habitLogs>;
export type NewCalendarEvent = InferInsertModel<typeof calendarEvents>;
export type NewAISuggestion = InferInsertModel<typeof aiSuggestions>;

// Enum types
export type GoalStatus = "active" | "completed" | "archived";
export type TaskStatus = "pending" | "completed" | "skipped";
export type TaskPriority = "low" | "medium" | "high";
export type HabitFrequency = "daily" | "weekly" | "monthly";
export type HabitLogStatus = "completed" | "partial" | "skipped";
export type AISuggestionType = "plan" | "briefing" | "reschedule";
export type AISuggestionStatus = "draft" | "active" | "archived" | "applied";

// Extended types with relations
export type GoalWithTasks = Goal & {
  tasks: Task[];
};

export type TaskWithGoal = Task & {
  goal: Goal | null;
};

export type HabitWithLogs = Habit & {
  logs: HabitLog[];
};

export type CalendarEventWithTask = CalendarEvent & {
  task: Task | null;
};

// AI Suggestion content types
export interface PlanSuggestionContent {
  goals: Array<{
    title: string;
    description: string;
    category: string;
    tasks: Array<{
      title: string;
      priority: TaskPriority;
      dueDate?: string;
    }>;
  }>;
}

export interface BriefingSuggestionContent {
  summary: string;
  todaysTasks: Array<{
    taskId: string;
    title: string;
    priority: TaskPriority;
  }>;
  upcomingDeadlines: Array<{
    goalId?: string;
    taskId?: string;
    title: string;
    dueDate: string;
  }>;
  habitReminders: Array<{
    habitId: string;
    title: string;
    targetValue: number;
    currentValue: number;
  }>;
}

export interface RescheduleSuggestionContent {
  reason: string;
  affectedTasks: Array<{
    taskId: string;
    currentDueDate: string;
    suggestedDueDate: string;
  }>;
  affectedEvents: Array<{
    eventId: string;
    currentStartTime: string;
    suggestedStartTime: string;
    suggestedEndTime?: string;
  }>;
}

export type AISuggestionContent =
  | PlanSuggestionContent
  | BriefingSuggestionContent
  | RescheduleSuggestionContent;
