import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const goals = sqliteTable(
	"goals",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		category: text("category"),
		startDate: integer("start_date", { mode: "timestamp_ms" }),
		endDate: integer("end_date", { mode: "timestamp_ms" }),
		status: text("status", {
			enum: ["active", "completed", "archived"],
		})
			.notNull()
			.default("active"),
		progress: integer("progress").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("goals_userId_idx").on(table.userId),
		index("goals_status_idx").on(table.status),
		index("goals_category_idx").on(table.category),
	],
);

export const goalsRelations = relations(goals, ({ one }) => ({
	user: one(user, {
		fields: [goals.userId],
		references: [user.id],
	}),
}));
