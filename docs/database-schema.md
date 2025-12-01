# Database Schema

## Overview
This schema is designed to support the Monthly Planner application, focusing on Goals, Tasks, Habits, and AI interactions. It is suitable for a relational database (PostgreSQL) or a local mobile database (SQLite/WatermelonDB).

## Tables

### 1. Users
*Stores user account and preference information.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique user identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | User email |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Account creation time |
| `preferences` | JSONB | | Settings (Timezone, Theme, Notification preferences) |

### 2. Goals
*High-level objectives for the month or year.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique goal identifier |
| `user_id` | UUID | FK -> Users.id | Owner of the goal |
| `title` | VARCHAR | NOT NULL | Goal title (e.g., "Run a Marathon") |
| `description` | TEXT | | Detailed description |
| `category` | VARCHAR | | e.g., Health, Work, Learning |
| `start_date` | DATE | | When the goal starts |
| `end_date` | DATE | | Deadline |
| `status` | ENUM | 'active', 'completed', 'archived' | Current state |
| `progress` | INTEGER | DEFAULT 0 | Percentage complete (0-100) |

### 3. Tasks
*Actionable items. Can be standalone or linked to a Goal.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique task identifier |
| `user_id` | UUID | FK -> Users.id | Owner |
| `goal_id` | UUID | FK -> Goals.id (Nullable) | Parent goal (if any) |
| `title` | VARCHAR | NOT NULL | Task name |
| `due_date` | TIMESTAMP | | Specific deadline |
| `status` | ENUM | 'pending', 'completed', 'skipped' | Task status |
| `priority` | ENUM | 'low', 'medium', 'high' | Priority level |
| `is_recurring` | BOOLEAN | DEFAULT FALSE | If true, uses recurrence_rule |
| `recurrence_rule`| VARCHAR | | RRule string (e.g., "FREQ=WEEKLY;BYDAY=MO") |

### 4. Habits
*Recurring behaviors to track consistency.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique habit identifier |
| `user_id` | UUID | FK -> Users.id | Owner |
| `title` | VARCHAR | NOT NULL | Habit name (e.g., "Drink Water") |
| `frequency` | VARCHAR | | e.g., "daily", "weekly" |
| `target_value` | INTEGER | DEFAULT 1 | Target count per period (e.g., 3 times) |
| `current_streak` | INTEGER | DEFAULT 0 | Calculated streak count |

### 5. Habit_Logs
*Daily records of habit completion.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique log identifier |
| `habit_id` | UUID | FK -> Habits.id | Parent habit |
| `date` | DATE | NOT NULL | Date of the log |
| `value` | INTEGER | DEFAULT 0 | Amount completed (e.g., 2/3) |
| `status` | ENUM | 'completed', 'partial', 'skipped' | Daily status |

### 6. Calendar_Events
*Syncs tasks/goals to time blocks. Can map to external calendars.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique event identifier |
| `user_id` | UUID | FK -> Users.id | Owner |
| `task_id` | UUID | FK -> Tasks.id (Nullable) | Linked task |
| `external_id` | VARCHAR | | ID from Google/Apple Calendar |
| `title` | VARCHAR | NOT NULL | Event title |
| `start_time` | TIMESTAMP | NOT NULL | Event start |
| `end_time` | TIMESTAMP | NOT NULL | Event end |

### 7. AI_Suggestions
*Stores AI-generated plans and daily briefings.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK -> Users.id | Owner |
| `type` | ENUM | 'plan', 'briefing', 'reschedule' | Type of suggestion |
| `content` | JSONB | NOT NULL | The structured suggestion data |
| `created_at` | TIMESTAMP | DEFAULT NOW() | When it was generated |
| `is_applied` | BOOLEAN | DEFAULT FALSE | Whether user accepted it |

## Relationships
- **User** has many **Goals**, **Tasks**, **Habits**.
- **Goal** has many **Tasks**.
- **Habit** has many **Habit_Logs**.
- **Task** can have one **Calendar_Event**.
