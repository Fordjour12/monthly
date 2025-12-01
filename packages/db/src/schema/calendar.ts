import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { tasks } from "./tasks";

export const calendarEvents = sqliteTable(
	"calendar_events",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		taskId: text("task_id").references(() => tasks.id, {
			onDelete: "set null",
		}),
		externalId: text("external_id"),
		title: text("title").notNull(),
		description: text("description"),
		startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
		endTime: integer("end_time", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("calendarEvents_userId_idx").on(table.userId),
		index("calendarEvents_taskId_idx").on(table.taskId),
		index("calendarEvents_externalId_idx").on(table.externalId),
		index("calendarEvents_startTime_idx").on(table.startTime),
	],
);

export const calendarEventsRelations = relations(
	calendarEvents,
	({ one }) => ({
		user: one(user, {
			fields: [calendarEvents.userId],
			references: [user.id],
		}),
		task: one(tasks, {
			fields: [calendarEvents.taskId],
			references: [tasks.id],
		}),
	}),
);
