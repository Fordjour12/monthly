import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const aiSuggestions = sqliteTable(
	"ai_suggestions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		type: text("type", {
			enum: ["plan", "briefing", "reschedule"],
		}).notNull(),
		content: text("content", { mode: "json" }).notNull(),
		isApplied: integer("is_applied", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("aiSuggestions_userId_idx").on(table.userId),
		index("aiSuggestions_type_idx").on(table.type),
		index("aiSuggestions_isApplied_idx").on(table.isApplied),
		index("aiSuggestions_createdAt_idx").on(table.createdAt),
	],
);

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
	user: one(user, {
		fields: [aiSuggestions.userId],
		references: [user.id],
	}),
}));
