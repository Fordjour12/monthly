import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { goals } from "./goals";

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		goalId: text("goal_id").references(() => goals.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		description: text("description"),
		dueDate: integer("due_date", { mode: "timestamp_ms" }),
		status: text("status", {
			enum: ["pending", "completed", "skipped"],
		})
			.notNull()
			.default("pending"),
		priority: text("priority", {
			enum: ["low", "medium", "high"],
		})
			.notNull()
			.default("medium"),
		isRecurring: integer("is_recurring", { mode: "boolean" })
			.notNull()
			.default(false),
		recurrenceRule: text("recurrence_rule"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tasks_userId_idx").on(table.userId),
		index("tasks_goalId_idx").on(table.goalId),
		index("tasks_status_idx").on(table.status),
		index("tasks_priority_idx").on(table.priority),
		index("tasks_dueDate_idx").on(table.dueDate),
	],
);

export const tasksRelations = relations(tasks, ({ one }) => ({
	user: one(user, {
		fields: [tasks.userId],
		references: [user.id],
	}),
	goal: one(goals, {
		fields: [tasks.goalId],
		references: [goals.id],
	}),
}));
