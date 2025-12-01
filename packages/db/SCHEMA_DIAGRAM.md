# Database Schema Diagram

## Entity Relationship Overview

```
┌─────────────────┐
│      User       │
│─────────────────│
│ id (PK)         │
│ name            │
│ email (UNIQUE)  │
│ emailVerified   │
│ image           │
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │
         │ 1:N
         │
    ┌────┴────┬──────────┬──────────┬──────────┬──────────┐
    │         │          │          │          │          │
    ▼         ▼          ▼          ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Session│ │Account│ │ Goals │ │ Tasks  │ │ Habits │ │Calendar│
│       │ │       │ │       │ │        │ │        │ │Events  │
└───────┘ └───────┘ └───┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
                        │         │          │          │
                        │ 1:N     │          │ 1:N      │
                        │         │          │          │
                        └────►┌───┴────┐     ▼          │
                              │ Tasks  │ ┌────────┐     │
                              │        │ │  Habit │     │
                              └───┬────┘ │  Logs  │     │
                                  │      └────────┘     │
                                  │ 0:N                 │
                                  │                     │
                                  └─────────────────────┘
```

## Table Details

### Core Tables

#### 👤 User
**Purpose**: User authentication and profile
- Primary authentication table
- Links to all user-specific data
- Supports email verification

**Relations**:
- Has many: Sessions, Accounts, Goals, Tasks, Habits, Calendar Events, AI Suggestions

---

#### 🎯 Goals
**Purpose**: High-level objectives
- Track long-term goals
- Monitor progress (0-100%)
- Categorize goals (Health, Work, Learning, etc.)

**Fields**:
- `status`: active | completed | archived
- `progress`: 0-100
- `category`: Custom categories
- `startDate`, `endDate`: Date range

**Relations**:
- Belongs to: User
- Has many: Tasks

---

#### ✅ Tasks
**Purpose**: Actionable items
- Can be standalone or linked to a goal
- Support for recurring tasks (RRule)
- Priority and status tracking

**Fields**:
- `status`: pending | completed | skipped
- `priority`: low | medium | high
- `isRecurring`: boolean
- `recurrenceRule`: RRule string
- `dueDate`: Timestamp

**Relations**:
- Belongs to: User, Goal (optional)
- Has many: Calendar Events

---

#### 🔄 Habits
**Purpose**: Recurring behaviors to track
- Daily, weekly, or monthly frequency
- Streak tracking
- Target value support

**Fields**:
- `frequency`: daily | weekly | monthly
- `targetValue`: Number (e.g., 3 times per day)
- `currentStreak`: Auto-calculated

**Relations**:
- Belongs to: User
- Has many: Habit Logs

---

#### 📊 Habit Logs
**Purpose**: Daily habit tracking records
- One log per habit per day
- Track partial completion
- Calculate streaks

**Fields**:
- `date`: Timestamp
- `value`: Amount completed
- `status`: completed | partial | skipped

**Relations**:
- Belongs to: Habit

---

#### 📅 Calendar Events
**Purpose**: Time-blocked events
- Sync with external calendars
- Link to tasks
- Time range tracking

**Fields**:
- `externalId`: For Google/Apple Calendar sync
- `startTime`, `endTime`: Timestamps
- `title`, `description`: Event details

**Relations**:
- Belongs to: User, Task (optional)

---

#### 🤖 AI Suggestions
**Purpose**: AI-generated recommendations
- Store AI plans and briefings
- Track if user applied suggestion
- JSON content storage

**Fields**:
- `type`: plan | briefing | reschedule
- `content`: JSON (structured data)
- `isApplied`: boolean

**Relations**:
- Belongs to: User

---

### Authentication Tables

#### 🔐 Session
**Purpose**: User session management
- Token-based authentication
- IP and user agent tracking
- Expiration handling

---

#### 🔑 Account
**Purpose**: OAuth provider accounts
- Multiple providers per user
- Token storage and refresh
- Password support

---

#### ✉️ Verification
**Purpose**: Email verification codes
- Time-limited codes
- Email verification flow

---

## Indexes

### Performance Optimizations

**User Lookups**:
- `user.email` (UNIQUE)

**Foreign Key Indexes**:
- All `userId` fields
- All `goalId`, `habitId`, `taskId` fields

**Query Optimization**:
- `goals.status`, `goals.category`
- `tasks.status`, `tasks.priority`, `tasks.dueDate`
- `habits.frequency`
- `habitLogs.date`, `habitLogs.status`
- `calendarEvents.startTime`, `calendarEvents.externalId`
- `aiSuggestions.type`, `aiSuggestions.isApplied`, `aiSuggestions.createdAt`

---

## Data Flow Examples

### Creating a Goal with Tasks
```
1. User creates a Goal
2. Goal is saved with userId
3. User adds Tasks to the Goal
4. Tasks reference goalId
5. Goal progress auto-updates based on completed tasks
```

### Tracking a Habit
```
1. User creates a Habit
2. Each day, a Habit Log is created
3. Habit Log records completion status
4. Streak is calculated from consecutive completed logs
```

### Scheduling a Task
```
1. User creates a Task
2. User creates a Calendar Event
3. Calendar Event references taskId
4. Event can sync to external calendar via externalId
```

### AI-Generated Plan
```
1. AI generates a plan (goals + tasks)
2. AI Suggestion is saved with JSON content
3. User reviews and applies the plan
4. Goals and Tasks are created
5. AI Suggestion marked as applied
```

---

## Cascade Behavior

### User Deletion
When a user is deleted, the following cascade:
- ✅ Sessions (CASCADE)
- ✅ Accounts (CASCADE)
- ✅ Goals (CASCADE)
  - ✅ Tasks linked to goals (CASCADE via goal deletion)
- ✅ Tasks (CASCADE)
  - ⚠️ Calendar Events linked to tasks (SET NULL)
- ✅ Habits (CASCADE)
  - ✅ Habit Logs (CASCADE via habit deletion)
- ✅ Calendar Events (CASCADE)
- ✅ AI Suggestions (CASCADE)

### Goal Deletion
When a goal is deleted:
- ⚠️ Tasks linked to goal (SET NULL - tasks become standalone)

### Task Deletion
When a task is deleted:
- ⚠️ Calendar Events linked to task (SET NULL - events remain)

### Habit Deletion
When a habit is deleted:
- ✅ Habit Logs (CASCADE)

---

## Storage Considerations

### Timestamp Storage
- All timestamps stored as `INTEGER` (milliseconds since epoch)
- Drizzle ORM handles Date conversion automatically
- Timezone-agnostic (store UTC, convert on client)

### JSON Storage
- AI Suggestions use JSON for flexible content
- User preferences can use JSON for settings
- Validated on application layer

### Text Storage
- SQLite TEXT type for all strings
- No length limits (SQLite handles dynamically)
- Indexes on frequently queried text fields

---

## Best Practices

1. **Always use transactions** for multi-table operations
2. **Use prepared statements** for security and performance
3. **Leverage indexes** for common queries
4. **Keep JSON minimal** - use relational data when possible
5. **Use UUIDs** for distributed system compatibility
6. **Validate enums** at application layer
7. **Handle cascades** carefully to avoid data loss
8. **Monitor query performance** with Drizzle Studio
