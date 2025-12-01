# @Monthly/db

Database package for the Monthly Planner application using Drizzle ORM with Turso (LibSQL).

## Overview

This package provides a fully-typed database schema and client for managing:
- **Goals**: High-level objectives with progress tracking
- **Tasks**: Actionable items with priority levels and recurring support
- **Habits**: Daily/weekly/monthly habits with streak tracking
- **Calendar Events**: Time-blocked events with external calendar integration
- **AI Suggestions**: AI-generated plans, briefings, and rescheduling suggestions
- **Authentication**: User accounts, sessions, and verification

## Schema

### Core Tables

#### Users
- User account information
- Email verification status
- Timestamps for account creation and updates

#### Goals
- Title, description, and category
- Start and end dates
- Status: `active`, `completed`, `archived`
- Progress tracking (0-100%)
- Linked to tasks

#### Tasks
- Title and description
- Optional goal linkage
- Due date with timezone support
- Status: `pending`, `completed`, `skipped`
- Priority: `low`, `medium`, `high`
- Recurring task support with RRule strings
- Linked to calendar events

#### Habits
- Title and description
- Frequency: `daily`, `weekly`, `monthly`
- Target value (e.g., 3 times per day)
- Current streak tracking
- Linked to habit logs

#### Habit Logs
- Daily records of habit completion
- Date and value (amount completed)
- Status: `completed`, `partial`, `skipped`

#### Calendar Events
- Title, description, and time range
- Optional task linkage
- External calendar ID support (Google/Apple Calendar)
- User-specific events

#### AI Suggestions
- Type: `plan`, `briefing`, `reschedule`
- JSON content storage
- Applied status tracking
- Timestamp for generation

## Usage

### Import the database client

```typescript
import { db } from "@Monthly/db";
```

### Query examples

```typescript
// Get all active goals for a user
const userGoals = await db.query.goals.findMany({
  where: (goals, { eq, and }) => 
    and(
      eq(goals.userId, userId),
      eq(goals.status, "active")
    ),
  with: {
    tasks: true, // Include related tasks
  },
});

// Create a new task
import { tasks } from "@Monthly/db";

await db.insert(tasks).values({
  id: crypto.randomUUID(),
  userId: userId,
  title: "Complete project proposal",
  priority: "high",
  status: "pending",
  dueDate: new Date("2025-12-15"),
});

// Update habit streak
import { habits } from "@Monthly/db";
import { eq } from "drizzle-orm";

await db.update(habits)
  .set({ currentStreak: 7 })
  .where(eq(habits.id, habitId));

// Get habit logs with habit details
const logs = await db.query.habitLogs.findMany({
  where: (logs, { eq }) => eq(logs.habitId, habitId),
  with: {
    habit: true,
  },
  orderBy: (logs, { desc }) => [desc(logs.date)],
  limit: 30,
});
```

## Scripts

### Development

```bash
# Start local Turso database
npm run db:local

# Generate migrations from schema changes
npm run db:generate

# Push schema to database (development)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Production

```bash
# Run migrations
npm run db:migrate
```

## Environment Variables

Create a `.env` file in `apps/server/` with:

```env
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-auth-token
```

For local development:

```env
DATABASE_URL=http://127.0.0.1:8080
```

## Schema Design Principles

1. **Type Safety**: All tables use TypeScript types for compile-time safety
2. **Indexing**: Strategic indexes on foreign keys and frequently queried fields
3. **Cascading Deletes**: User deletion cascades to all related data
4. **Soft References**: Tasks and calendar events use `SET NULL` for optional relations
5. **Timestamps**: All tables track creation and update times
6. **Enums**: Status and type fields use SQLite text enums for validation

## Relations

```
User
├── Goals
│   └── Tasks
│       └── Calendar Events
├── Tasks (standalone)
│   └── Calendar Events
├── Habits
│   └── Habit Logs
├── Calendar Events
└── AI Suggestions
```

## Migration Strategy

1. Make schema changes in `src/schema/*.ts`
2. Run `npm run db:generate` to create migration files
3. Review the generated SQL in `src/migrations/`
4. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)

## Best Practices

- Always use transactions for multi-table operations
- Use prepared statements for repeated queries
- Leverage Drizzle's query builder for type-safe queries
- Use indexes wisely - they speed up reads but slow down writes
- Keep JSON fields minimal and well-structured
- Use UUIDs for all primary keys for distributed systems

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Turso Documentation](https://docs.turso.tech/)
- [LibSQL Documentation](https://github.com/tursodatabase/libsql)
