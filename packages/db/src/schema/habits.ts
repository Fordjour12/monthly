import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    frequency: text("frequency", {
      enum: ["daily", "weekly", "monthly"],
    })
      .notNull()
      .default("daily"),
    targetValue: integer("target_value").notNull().default(1),
    currentStreak: integer("current_streak").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("habits_userId_idx").on(table.userId),
    index("habits_frequency_idx").on(table.frequency),
  ]
);

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    value: integer("value").notNull().default(0),
    status: text("status", {
      enum: ["completed", "partial", "skipped"],
    })
      .notNull()
      .default("partial"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("habitLogs_habitId_idx").on(table.habitId),
    index("habitLogs_date_idx").on(table.date),
    index("habitLogs_status_idx").on(table.status),
  ]
);

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(user, {
    fields: [habits.userId],
    references: [user.id],
  }),
  logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, {
    fields: [habitLogs.habitId],
    references: [habits.id],
  }),
}));
