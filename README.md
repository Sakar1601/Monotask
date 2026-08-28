# Monotask - Project Documentation

> A minimal productivity application for managing tasks and habits, built with React, TypeScript, and Supabase - with AI-assisted task capture and weekly summaries via Claude.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [Authentication Flow](#authentication-flow)
6. [Application Flow](#application-flow)
7. [Components Reference](#components-reference)
8. [Custom Hooks](#custom-hooks)
9. [State Management](#state-management)
10. [Security & RLS Policies](#security--rls-policies)
11. [Features & Business Logic](#features--business-logic)
12. [AI Features](#ai-features)
13. [Testing & CI/CD](#testing--cicd)
14. [Configuration & Dependencies](#configuration--dependencies)
15. [File Structure](#file-structure)

---

## Project Overview

**Monotask** is a minimalist productivity application that helps users:
- Create and manage tasks with due dates, priorities, and tags - including recurring schedules and AI-assisted quick capture
- Track daily/weekly/monthly habits
- Visualize progress through analytics, charts, and an on-demand AI-generated weekly summary
- Export data in PDF, CSV, or a round-trippable JSON format - and import it back

### Key Features
- **Task Management**: Create, edit, delete, and complete tasks, including recurring daily/weekly/monthly schedules that expand into real per-day occurrences on the Calendar and in Task Manager
- **AI Quick Add**: Type a task in plain English ("lunch with Sam tomorrow 1pm, high priority") and Claude fills in the structured fields for review
- **AI Weekly Summary**: On-demand, AI-generated recap of the week's task and habit activity
- **Habit Tracking**: Log daily habits with completion status (done, skipped, missed)
- **Calendar View**: Month/week/agenda views with task visualization, recurring-task-aware
- **Progress Analytics**: Weekly completion charts, category distribution, activity heatmap
- **Tags System**: Organize tasks and habits with custom color-coded tags
- **Dark/Light Theme**: User-configurable appearance settings
- **Guest Access**: Anonymous sign-in with account upgrade capability
- **Data Export/Import**: PDF and CSV export, plus a JSON format that round-trips - export your data and import it back (into the same or a different account)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui components |
| **State Management** | TanStack Query (React Query) |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) |
| **Serverless functions** | Supabase Edge Functions (Deno) |
| **AI** | Claude (Anthropic API) via `@anthropic-ai/sdk`, structured outputs |
| **Charts** | Recharts |
| **Routing** | React Router DOM v7 |
| **Forms** | React Hook Form, Zod validation |
| **Notifications** | Sonner (toast notifications) |
| **PDF Export** | jsPDF |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **CI/CD** | GitHub Actions (typecheck, lint, test, build) + Vercel |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React App)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   App.tsx    │───▶│  Providers   │───▶│    Pages     │       │
│  │  (Entry)     │    │ (Context)    │    │   (Views)    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  Custom Hooks Layer                   │       │
│  │  useAuth │ useTasks │ useHabits │ useTags │ useSettings     │
│  └──────────────────────────────────────────────────────┘       │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              TanStack Query (Cache Layer)             │       │
│  └──────────────────────────────────────────────────────┘       │
│                            │                                     │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  PostgreSQL  │    │   Auth       │    │   Storage    │       │
│  │  (Database)  │    │  (Users)     │    │  (Files)     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Row Level Security (RLS)                 │       │
│  │     User-based data isolation and access control      │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

Two Supabase Edge Functions (`supabase/functions/parse-task`, `supabase/functions/weekly-summary`)
sit between the client and Claude for the AI features. They run with the caller's JWT (not a
service-role key), re-verify auth themselves, enforce a per-user daily call cap via a
`check_and_increment_ai_usage` Postgres function before calling the Anthropic API, and are the
only place the `ANTHROPIC_API_KEY` secret is ever used - it never reaches the client.

### Provider Hierarchy

```tsx
QueryClientProvider          // React Query cache management
  └── TooltipProvider        // UI tooltip context
      └── AuthProvider       // Authentication state & methods
          └── SettingsProvider  // User preferences
              └── BrowserRouter // Routing
                  └── Routes    // Page components
```

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User settings and metadata |
| `tasks` | Task items with due dates, priorities |
| `habits` | Recurring habit definitions |
| `logs` | Habit completion logs |
| `tags` | User-created categories |
| `goals` | User goals with targets (schema only - no UI reads/writes this table) |
| `task_instances` | Recurring task instance tracking - actively used by Calendar and Task Manager |
| `ai_usage` | Per-user daily call counter for the AI features, enforced server-side |

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   profiles  │       │    tasks    │       │    tags     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ user_id     │       │ user_id     │───────│ user_id     │
│ username    │       │ title       │       │ name        │
│ settings    │       │ description │       │ color       │
│ created_at  │       │ due_date    │       │ created_at  │
│ updated_at  │       │ due_time    │       └─────────────┘
└─────────────┘       │ priority    │              │
                      │ status      │              │
                      │ tag_id (FK) │──────────────┘
                      │ repeat_type │
                      │ completed_at│
                      │ created_at  │
                      │ updated_at  │
                      └─────────────┘
                             │
                             │
┌─────────────┐       ┌──────┴──────┐       ┌─────────────┐
│   habits    │       │    logs     │       │   goals     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │───────│ id (PK)     │       │ id (PK)     │
│ user_id     │       │ user_id     │       │ user_id     │
│ name        │       │ habit_id(FK)│       │ name        │
│ description │       │ task_id(FK) │       │ target_value│
│ frequency   │       │ date        │       │ current_val │
│ freq_days   │       │ status      │       │ target_date │
│ tag_id (FK) │       │ notes       │       │ is_active   │
│ preferred_t │       │ created_at  │       │ created_at  │
│ is_active   │       └─────────────┘       │ updated_at  │
│ created_at  │                             └─────────────┘
│ updated_at  │
└─────────────┘
                      │
                      ▼
               ┌─────────────┐
               │task_instances│
               ├─────────────┤
               │ id (PK)     │
               │ task_id (FK)│
               │ instance_date│
               │ status      │
               │ completed_at│
               │ created_at  │
               └─────────────┘
```

### Table Details

#### `profiles`
Stores user-specific settings and preferences.
```sql
id: uuid (PK, references auth.users)
username: text
settings: jsonb  -- {timeFormat, timezone, theme, font}
created_at: timestamp
updated_at: timestamp
```

#### `tasks`
Main task storage with support for recurring tasks.
```sql
id: uuid (PK)
user_id: uuid (FK → auth.users)
title: text (required)
description: text
due_date: date
due_time: time
priority: text ('low' | 'medium' | 'high')
status: text ('pending' | 'completed' | 'cancelled')
tag_id: uuid (FK → tags)
repeat_type: text ('none' | 'daily' | 'weekly' | 'monthly')
repeat_interval: integer (default 1)
completed_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `habits`
Habit definitions with frequency settings.
```sql
id: uuid (PK)
user_id: uuid (FK → auth.users)
name: text (required)
description: text
frequency: text ('daily' | 'weekly' | 'monthly')
frequency_days: integer[] (days of week, 1-7)
preferred_time: time
tag_id: uuid (FK → tags)
is_active: boolean
created_at: timestamp
updated_at: timestamp
```

#### `logs`
Tracks habit and task completion history.
```sql
id: uuid (PK)
user_id: uuid (FK → auth.users)
habit_id: uuid (FK → habits)
task_id: uuid (FK → tasks)
date: date
status: text ('completed' | 'skipped' | 'failed')
notes: text
created_at: timestamp
```

#### `task_instances`
Tracks individual instances of recurring tasks.
```sql
id: uuid (PK)
task_id: uuid (FK → tasks)
instance_date: date
status: text ('pending' | 'completed' | 'cancelled')
completed_at: timestamp
created_at: timestamp
```

#### `tags`
User-defined categories for organization.
```sql
id: uuid (PK)
user_id: uuid (FK → auth.users)
name: text (required)
color: text (hex color, default '#6b7280')
created_at: timestamp
```

#### `ai_usage`
Per-user, per-feature, per-day call counter backing the AI rate limits. Not written directly by
any client - only through the `check_and_increment_ai_usage(feature, daily_limit)` SECURITY
DEFINER function, which atomically checks-and-increments in one statement.
```sql
user_id: uuid (FK → auth.users)
feature: text  -- 'parse-task' | 'weekly-summary'
usage_date: date (default current_date)
call_count: integer (default 0)
updated_at: timestamp
PRIMARY KEY (user_id, feature, usage_date)
```

---

## Authentication Flow

### Authentication Methods

1. **Email/Password Sign-up/Sign-in**
   - Standard email and password authentication
   - Password minimum 6 characters

2. **Anonymous (Guest) Sign-in**
   - No credentials required
   - Data stored temporarily under anonymous session
   - Can be upgraded to full account

3. **Account Upgrade (Guest → Full)**
   - Links email/password to existing anonymous session
   - Preserves all guest data

### Flow Diagram

```
┌─────────────────┐
│   Auth.tsx      │
│  (Login Page)   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│Sign In│ │Guest Mode │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           ▼
┌───────────────────────────────────┐
│        useAuth Hook               │
│  - signIn(email, password)        │
│  - signUp(email, password)        │
│  - signInAnonymously()            │
│  - linkEmailPassword()            │
│  - signOut()                      │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│        Supabase Auth              │
│  - Session management             │
│  - JWT tokens                     │
│  - Anonymous users support        │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    Database Trigger               │
│    handle_new_user()              │
│  - Creates profile record         │
│  - Adds default tags              │
└───────────────────────────────────┘
```

### Auth State Management

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (email, password) => Promise<AuthResponse>;
  signUp: (email, password) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  signInAnonymously: () => Promise<AuthResponse>;
  linkEmailPassword: (email, password) => Promise<AuthResponse>;
}
```

---

## Application Flow

### Main Application Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        Index.tsx                             │
│                    (Main Layout Page)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐  ┌────────────────────────────────────────┐ │
│  │            │  │              TopBar.tsx                 │ │
│  │            │  │  - Current date display                 │ │
│  │            │  │  - Quick Add button                     │ │
│  │  Sidebar   │  └────────────────────────────────────────┘ │
│  │   .tsx     │                                             │
│  │            │  ┌────────────────────────────────────────┐ │
│  │  - Logo    │  │                                        │ │
│  │  - Nav     │  │         Current View Content           │ │
│  │  - SignOut │  │                                        │ │
│  │            │  │  Dashboard | Tasks | Calendar |        │ │
│  │            │  │  Habits | Tags | Progress | Settings   │ │
│  │            │  │                                        │ │
│  │            │  │                                        │ │
│  └────────────┘  └────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Below the `md` breakpoint, `Sidebar` becomes an off-canvas drawer (opened via a hamburger button
in `TopBar`) instead of the fixed column shown above.

### Navigation Flow

```
User Opens App
      │
      ▼
┌─────────────────┐
│  Check Auth     │
│  (useAuth)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│Logged │ │Not Logged │
│  In   │ │   In      │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           ▼
┌───────┐ ┌───────────┐
│Index  │ │Auth.tsx   │
│Page   │ │(Login)    │
└───┬───┘ └───────────┘
    │
    ▼
┌───────────────────────────────┐
│ Default View: Dashboard       │
│                               │
│ Available Views:              │
│ - Dashboard (overview)        │
│ - Tasks (task management)     │
│ - Calendar (date views)       │
│ - Habits (habit tracking)     │
│ - Tags (category management)  │
│ - Progress (analytics)        │
│ - Settings (preferences)      │
└───────────────────────────────┘
```

---

## Components Reference

### Page Components

| Component | File | Description |
|-----------|------|-------------|
| `Index` | `src/pages/Index.tsx` | Main application layout with sidebar and content area |
| `NotFound` | `src/pages/NotFound.tsx` | 404 error page |

### Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `Sidebar` | `src/components/Sidebar.tsx` | Navigation sidebar with menu items and sign-out |
| `TopBar` | `src/components/TopBar.tsx` | Header with current date and quick add button |

### View Components

| Component | File | Description |
|-----------|------|-------------|
| `Dashboard` | `src/components/Dashboard.tsx` | Overview with stats, upcoming/completed tasks |
| `TaskManager` | `src/components/TaskManager.tsx` | Task list with filters, tabs (today/upcoming/overdue/all, recurring-task-aware), and an "AI Quick Add" free-text input |
| `CalendarView` | `src/components/CalendarView.tsx` | Month/week/agenda views, expands recurring tasks into real per-day occurrences |
| `HabitsView` | `src/components/HabitsView.tsx` | Habit list with daily logging (done/skip/miss) |
| `TagsView` | `src/components/TagsView.tsx` | Tag management with usage counts and a color picker |
| `ProgressView` | `src/components/ProgressView.tsx` | Analytics with charts, export options, and an on-demand AI-generated weekly summary |
| `Settings` | `src/components/Settings.tsx` | User preferences, theme toggle, data export (PDF/CSV/JSON) and import (JSON) |

### Modal Components

| Component | File | Description |
|-----------|------|-------------|
| `TaskModal` | `src/components/TaskModal.tsx` | Create/edit task form dialog |
| `HabitModal` | `src/components/HabitModal.tsx` | Create/edit habit form dialog |
| `DayTasksModal` | `src/components/DayTasksModal.tsx` | View tasks for a specific date |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | Reusable confirmation dialog |
| `UpgradeAccountModal` | `src/components/UpgradeAccountModal.tsx` | Guest to full account upgrade |

### Form Components

| Component | File | Description |
|-----------|------|-------------|
| `TagSelector` | `src/components/TagSelector.tsx` | Tag dropdown with color indicators |
| `TimeInput` | `src/components/TimeInput.tsx` | Time picker input |
| `Auth` | `src/components/Auth.tsx` | Login/signup form with guest option |

### UI Components (shadcn/ui)

Located in `src/components/ui/`, these are pre-built accessible components:
- `Button`, `Input`, `Textarea`
- `Dialog`, `AlertDialog`, `Sheet`
- `Select`, `Checkbox`, `Switch`
- `Card`, `Badge`, `Tabs`
- `Calendar`, `Popover`, `Tooltip`
- And more...

---

## Custom Hooks

### `useAuth` (`src/hooks/useAuth.tsx`)

Manages authentication state and provides auth methods.

```typescript
const { 
  user,           // Current user object
  session,        // Active session
  loading,        // Auth loading state
  isAnonymous,    // Is guest user
  signIn,         // Email/password login
  signUp,         // Create new account
  signOut,        // Logout
  signInAnonymously,    // Guest login
  linkEmailPassword     // Upgrade guest account
} = useAuth();
```

### `useTasks` (`src/hooks/useTasks.tsx`)

CRUD operations and utilities for task management.

```typescript
const {
  tasks,          // Task array
  isLoading,      // Loading state
  error,          // Error state
  createTask,     // Create new task
  createTaskAsync,// Create new task (awaitable - used by data import)
  updateTask,     // Update existing task
  deleteTask,     // Delete task
  isCreating,     // Creation in progress
  isUpdating,     // Update in progress
  isDeleting,     // Deletion in progress
  getOverdueTasks // Filter: past due
} = useTasks();
```

Today/Upcoming filtering used to live here as `getTodayTasks`/`getUpcomingTasks`, but both were
naive `due_date` filters that never expanded recurring tasks. That logic now lives in
`TaskManager.tsx` (`getTodayOccurrences`/`getUpcomingOccurrences`) and `CalendarView.tsx`,
built on top of `src/utils/recurringTasks.ts` and `src/utils/taskOccurrences.ts` so completion
is tracked per-occurrence via `task_instances`, not on the task record itself.

### `useHabits` (`src/hooks/useHabits.tsx`)

Habit management and logging functionality.

```typescript
const {
  habits,         // Habit array
  logs,           // Habit logs array
  isLoading,      // Loading state
  createHabit,    // Create new habit
  createHabitAsync, // Create new habit (awaitable - used by data import)
  updateHabit,    // Update habit
  deleteHabit,    // Delete habit
  logHabit,       // Log habit status for today
  isCreating,
  isUpdating,
  isDeleting,
  isLogging
} = useHabits();
```

### `useTags` (`src/hooks/useTags.tsx`)

Tag management with usage statistics.

```typescript
const {
  tags,           // Basic tag array
  tagsWithUsage,  // Tags with usage count
  isLoading,
  createTag,      // Create new tag
  createTagAsync, // Create new tag (awaitable - used by data import)
  deleteTag,      // Delete tag (removes from items)
  isCreatingTag,
  isDeletingTag
} = useTags();
```

### `useSettings` (`src/hooks/useSettings.tsx`)

User preferences and theme management.

```typescript
const {
  settings,       // UserSettings object
  updateSetting,  // Update single setting
  isLoading,
  formatTime      // Format time based on user preference
} = useSettings();

interface UserSettings {
  timeFormat: '12h' | '24h';
  timezone: string;
  theme: 'light' | 'dark';
  font: 'Inter' | 'Space Grotesk' | 'DM Sans';
  notifications: boolean;
  autoBackup: boolean;
}
```

### `useTaskInstances` (`src/hooks/useTaskInstances.tsx`)

Manages recurring task instances for accurate per-occurrence completion tracking. Actively
consumed by `CalendarView.tsx` and `TaskManager.tsx` via `src/utils/taskOccurrences.ts`.

```typescript
const {
  instances,      // Task instance array
  isLoading,
  updateInstance, // Create or update an instance's status for a given date
  isUpdating
} = useTaskInstances();
```

### `useTaskParser` (`src/hooks/useTaskParser.tsx`)

Calls the `parse-task` Edge Function to turn free text into structured task fields.

```typescript
const {
  parseTask,      // (text: string) => Promise<ParsedTaskDraft>
  isParsing
} = useTaskParser();
```

### `useWeeklySummary` (`src/hooks/useWeeklySummary.tsx`)

A `useQuery` wrapper around the `weekly-summary` Edge Function, gated behind an `enabled` flag
so it only fires when the user clicks "Generate" (never automatically, to bound AI spend).

```typescript
const { data, isLoading, error } = useWeeklySummary(enabled);
// data: { summary: string; stats: {...} } | undefined
```

---

## State Management

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Dashboard│  │TaskMgr  │  │Calendar │  │Settings │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       └────────────┴────────────┴────────────┘              │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Custom Hooks (Data Layer)                │   │
│  │  useTasks() │ useHabits() │ useTags() │ useSettings()│   │
│  │  useTaskInstances()                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           TanStack Query (Cache + Sync)               │   │
│  │  - Automatic background refetching                    │   │
│  │  - Optimistic updates                                 │   │
│  │  - Query invalidation                                 │   │
│  │  - Stale-while-revalidate                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Client                             │
│  - Real-time subscriptions (available but not used)         │
│  - REST API calls                                            │
│  - Authentication                                            │
└─────────────────────────────────────────────────────────────┘
```

### Query Keys Structure

```typescript
// Tasks
['tasks', user?.id]

// Task Instances
['task-instances', user?.id]

// Habits
['habits', user?.id]
['habit-logs', user?.id]

// Tags
['tags', user?.id]
['tags-with-usage', user?.id]

// Analytics
['weekly-progress', user?.id]
['category-distribution', user?.id]
['activity-heatmap', user?.id]
```

### Optimistic Updates Pattern

The app uses optimistic updates for better UX:

```typescript
// Example: Task update
onSuccess: (updatedTask) => {
  // Immediately update cache
  queryClient.setQueryData(['tasks', user?.id], (oldTasks) => {
    return oldTasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );
  });
  
  // Then invalidate to sync with server
  queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
}
```

---

## Security & RLS Policies

### Row Level Security Overview

All tables have RLS enabled with user-based isolation:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Own only | Own only | Own only | ❌ |
| tasks | Own only | Own only | Own only | Own only |
| habits | Own only | Own only | Own only | Own only |
| logs | Own only | Own only | Own only | Own only |
| tags | Own only | Own only | Own only | Own only |
| goals | Own only | Own only | Own only | Own only |
| task_instances | Via task owner | Via task owner | Via task owner | Via task owner |
| ai_usage | Own only | ❌ (function only) | ❌ (function only) | ❌ |

### Policy Pattern

```sql
-- Standard user isolation policy
CREATE POLICY "Users can view own data" 
ON public.tablename 
FOR SELECT 
USING (auth.uid() = user_id);

-- task_instances uses relation-based check
CREATE POLICY "Users can view their own task instances" 
ON public.task_instances 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tasks 
  WHERE tasks.id = task_instances.task_id 
  AND tasks.user_id = auth.uid()
));
```

### Database Trigger

New user initialization:

```sql
CREATE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile with default settings
  INSERT INTO public.profiles (id, username, settings)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'username',
    '{"timeFormat": "24h", "timezone": "UTC", "theme": "light", "font": "Inter"}'
  );
  
  -- Create default tags
  INSERT INTO public.tags (user_id, name, color) VALUES
    (NEW.id, 'Work', '#111827'),
    (NEW.id, 'Personal', '#374151'),
    (NEW.id, 'Health', '#6b7280'),
    (NEW.id, 'Learning', '#9ca3af');
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Features & Business Logic

### Task Management

**Task Status Flow:**
```
┌─────────┐     Complete      ┌───────────┐
│ Pending │ ─────────────────▶ │ Completed │
│         │ ◀───────────────── │           │
└─────────┘     Uncomplete     └───────────┘
```

**Task Filtering Logic:**
- **Today**: every occurrence (recurring or not) whose date falls today, via `generateRecurringInstances`
- **Upcoming**: today's uncompleted occurrences + all of tomorrow's + the rest of the week's uncompleted occurrences
- **Overdue**: `due_date < today && status !== 'completed'` - deliberately scoped to non-recurring tasks only (an "overdue" backlog of every unfinished day of a daily task isn't a meaningful concept this product needs; that's what Habits already covers)
- **All**: task definitions, one row per task - not expanded into occurrences

**Recurring Tasks:**
- Types: `none`, `daily`, `weekly`, `monthly`, `custom` (`custom` is in the schema's CHECK constraint but has no UI to configure it)
- Interval: Number of periods between occurrences
- Instance Tracking: Wired into Calendar (month/week/agenda) and Task Manager (Today/Upcoming) - completing one day's occurrence of a recurring task only marks that date's `task_instances` row, not the whole series

### Habit Tracking

**Habit Logging States:**
```
┌──────────┐     ┌─────────┐     ┌────────┐
│Completed │     │ Skipped │     │ Failed │
│  (Done)  │     │ (Skip)  │     │ (Miss) │
└──────────┘     └─────────┘     └────────┘
     ▲               ▲               ▲
     │               │               │
     └───────────────┴───────────────┘
                     │
              User Action
```

**Frequency Options:**
- Daily: Every day
- Weekly: Specific days (frequency_days: [1,2,3,4,5,6,7])
- Monthly: Once per month

### Analytics & Progress

**Metrics Calculated:**
- Tasks completed this week
- Average daily task completion (30-day window)
- Active habits count
- Total tasks count
- Category distribution (by tag)
- Activity heatmap (84 days / 12 weeks)

**Export Formats:**
- **CSV**: Tasks + Habits + Logs in structured format (human/spreadsheet-oriented, RFC 4180 escaped - not re-importable)
- **PDF**: Summary report with metrics
- **JSON**: Tasks + Habits + Tags, round-trippable - export from one account and Import (below) into the same or a different one. Habit completion logs are deliberately excluded from the JSON format.

**Data Import:**
- Accepts a Monotask JSON export (`src/utils/dataPortability.ts` validates the shape and gives a specific reason on malformed input)
- Tags are resolved and created by name, not id, so a backup restores correctly into an account with different tag ids
- Export/Import buttons are disabled until the tasks/habits/tags queries have finished loading, to avoid running against stale or empty data

### Theme System

**Theme Application:**
```typescript
// Applied via document class and CSS variables
if (theme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}
```

---

## AI Features

Both features call Claude Haiku 4.5 through a Supabase Edge Function - the Anthropic API key
lives only in the Edge Function's environment, never in client code or a `VITE_`-prefixed var.

### AI Quick Add

`supabase/functions/parse-task/index.ts` turns free text ("lunch with Sam tomorrow 1pm, high
priority") into structured task fields via Anthropic's structured-output API (a JSON Schema on
`output_config.format`, not the zod helper - that hit a module-resolution hazard under Deno).
Every field is re-validated server-side before use; the frontend never inserts the result
directly, it pre-fills the existing `TaskModal` for the user to review and confirm.

### AI Weekly Summary

`supabase/functions/weekly-summary/index.ts` computes the week's stats (completion rate, overdue
count, top tag, habit rate) server-side from RLS-scoped queries, then asks Claude only to phrase
those already-correct numbers into 2-3 sentences - the model can't misreport a number, only
phrase it awkwardly. Triggered on demand from Progress & Analytics, never automatically.

### Guardrails

- **Rate limiting**: `check_and_increment_ai_usage(feature, daily_limit)`, a SECURITY DEFINER
  Postgres function, atomically caps calls per user per day (5/day summary, 30/day parse) before
  either function calls the Anthropic API.
- **Auth**: both functions run with the caller's JWT and call `supabase.auth.getUser()` themselves
  - `verify_jwt = false` in `supabase/config.toml` only disables the *platform-level* gate (which
  was blocking CORS preflight requests), not authentication itself.
- **Eval suite**: `scripts/evals/parse-task.eval.ts` (`npm run eval:parse-task`) runs fixed
  test cases against the live parsing prompt/schema as a regression check when the prompt changes.

---

## Testing & CI/CD

### Unit Tests (Vitest)

`npm test` runs unit tests for the utility modules with the most logic: `recurringTasks`
(occurrence expansion), `taskOccurrences` (completion/toggle routing), `csv` (RFC 4180 escaping),
and `dataPortability` (import validation, tag resolution). Config: `vitest.config.ts`.

### End-to-End Smoke Test (Playwright)

`npm run test:e2e` runs one test (`e2e/smoke.spec.ts`) covering the golden path against real
Supabase auth (a throwaway guest user per run, not mocked): landing → guest sign-in → app shell
→ create a task → complete it. Config: `playwright.config.ts`.

### CI Pipeline

`.github/workflows/ci.yml` runs on every push/PR to `main`: typecheck (both `tsconfig.app.json`
and `tsconfig.node.json`), lint, unit tests, build, then installs Chromium and runs the E2E test
against a real dev server using the same Supabase secrets the build step uses. The Playwright
report uploads as an artifact on failure.

`main` has branch protection requiring the CI check to pass before merge, with no exception for
admins - direct pushes are rejected the same as anyone else's. Vercel auto-deploys on every merge
to `main` (production) and every branch/PR push (preview), so by the time something reaches
production it has already passed CI.

---

## Configuration & Dependencies

### Environment Variables

The app reads Supabase config from Vite env vars (not hardcoded):
```typescript
// src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```
Required locally in `.env` (see `.env.example`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. The same three are set as GitHub
Actions secrets (for CI) and as Vercel environment variables (for deploys) - all three places
need to agree, since nothing here is a secret in the traditional sense (the anon/publishable key
is meant to be public; RLS is the real access control), but a missing value crashes the app at
runtime rather than failing the build.

The AI Edge Functions additionally need `ANTHROPIC_API_KEY` set as a Supabase secret
(`supabase secrets set ANTHROPIC_API_KEY=...`) - this one **is** a real secret and must never be
a `VITE_`-prefixed var or appear in client code.

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `@tanstack/react-query` | ^5.56.2 | Data fetching/caching |
| `@supabase/supabase-js` | ^2.50.0 | Backend client |
| `react-router-dom` | ^7.18.2 | Routing |
| `recharts` | ^2.12.7 | Charts/visualizations |
| `date-fns` | ^3.6.0 | Date utilities |
| `sonner` | ^1.5.0 | Toast notifications |
| `jspdf` | ^4.2.1 | PDF generation |
| `zod` | ^4.4.3 | Schema validation |
| `tailwindcss` | - | Styling |
| `shadcn/ui` | - | UI component library |
| `@anthropic-ai/sdk` (dev) | ^0.122.0 | Used inside Edge Functions (via esm.sh, not this npm copy) and the eval/seed scripts |
| `vitest` (dev) | ^4.1.11 | Unit test runner |
| `@playwright/test` (dev) | ^1.62.1 | E2E test runner |
| `tsx` (dev) | ^4.19.0 | Runs the eval and demo-data-seed scripts |

### Supabase Configuration

Project ID: `masofmjpnpnxjooqdajl`

Required Auth Settings:
- Email/Password authentication enabled
- Anonymous sign-ins enabled (for guest mode)

---

## File Structure

```
src/
├── App.tsx                 # Root component with providers
├── main.tsx                # Application entry point
├── index.css               # Global styles & Tailwind config
├── App.css                 # Additional app styles
│
├── components/
│   ├── ui/                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── Auth.tsx            # Login/signup page
│   ├── Dashboard.tsx       # Main dashboard view
│   ├── TaskManager.tsx     # Task list & management
│   ├── TaskModal.tsx       # Task create/edit form
│   ├── CalendarView.tsx    # Calendar views
│   ├── HabitsView.tsx      # Habit list & logging
│   ├── HabitModal.tsx      # Habit create/edit form
│   ├── TagsView.tsx        # Tag management
│   ├── ProgressView.tsx    # Analytics & charts
│   ├── Settings.tsx        # User preferences
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── TopBar.tsx          # Header bar
│   ├── ConfirmDialog.tsx   # Confirmation modal
│   ├── DayTasksModal.tsx   # Day detail modal
│   ├── TagSelector.tsx     # Tag dropdown
│   ├── TimeInput.tsx       # Time picker
│   └── UpgradeAccountModal.tsx  # Guest upgrade
│
├── hooks/
│   ├── useAuth.tsx         # Authentication hook
│   ├── useTasks.tsx        # Task CRUD hook
│   ├── useHabits.tsx       # Habit CRUD hook
│   ├── useTags.tsx         # Tag CRUD hook
│   ├── useSettings.tsx     # Settings hook
│   ├── useTaskInstances.tsx # Task instances hook
│   ├── useTaskParser.tsx   # Calls the parse-task Edge Function (AI Quick Add)
│   ├── useWeeklySummary.tsx # Calls the weekly-summary Edge Function
│   ├── use-mobile.tsx      # Mobile detection
│   └── use-toast.ts        # Toast notifications
│
├── pages/
│   ├── Index.tsx           # Main app page
│   ├── Landing.tsx         # Public landing page
│   ├── Auth.tsx             # Auth route
│   └── NotFound.tsx        # 404 page
│
├── integrations/
│   └── supabase/
│       ├── client.ts       # Supabase client setup
│       └── types.ts        # Generated TypeScript types
│
├── utils/
│   ├── pdfExport.ts        # PDF generation utility
│   ├── recurringTasks.ts   # Recurring task instance-expansion helpers
│   ├── taskOccurrences.ts  # Occurrence completion/toggle logic, shared by Calendar/TaskManager
│   ├── csv.ts               # RFC 4180 CSV field escaping
│   └── dataPortability.ts  # JSON export/import schema + validation
│
├── *.test.ts                # Vitest unit tests, colocated with the module they cover
│
└── lib/
    └── utils.ts            # General utilities (cn, etc.)

supabase/
├── config.toml             # Supabase configuration (incl. verify_jwt=false for the two Edge Functions)
├── migrations/             # Database migrations
└── functions/
    ├── _shared/cors.ts      # Shared CORS headers
    ├── parse-task/          # AI Quick Add Edge Function
    └── weekly-summary/      # AI Weekly Summary Edge Function

e2e/
└── smoke.spec.ts           # Playwright E2E smoke test

scripts/
├── evals/parse-task.eval.ts # Regression eval for the parse-task prompt/schema
└── seed-demo-data.ts        # Seeds two demo accounts (npm run seed:demo)

.github/workflows/
└── ci.yml                  # Typecheck, lint, unit tests, build, E2E on every push/PR to main

public/
├── favicon.ico
├── robots.txt
└── placeholder.svg
```

---

## Important Assumptions

1. **User Isolation**: All user data is strictly isolated via RLS policies
2. **Single User Session**: App assumes one active session per browser
3. **Time Zones**: Dates are stored in UTC, displayed in local time
4. **Local Date Handling**: Task due dates use local midnight to avoid timezone issues
5. **Guest Data**: Anonymous user data persists only while session is active
6. **Default Tags**: Four tags are created automatically for new users
7. **No Notifications**: Push notifications are not implemented (setting exists for future)
8. **AI Rate Limits**: AI Quick Add and AI Weekly Summary are capped at 30 and 5 calls/user/day respectively, enforced server-side - hitting the cap surfaces as an error toast, not a silent failure
9. **Unimplemented Settings**: `timeFormat`, `timezone`, `font`, `notifications`, `autoBackup` exist in the settings model but only theme (dark/light) is exposed in the Settings UI

---

## Getting Started (Development)

1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
4. Enable Anonymous Sign-ins in Supabase Auth settings
5. Run development server: `npm run dev`
6. Run unit tests: `npm test` · Run the E2E smoke test: `npm run test:e2e`

The AI features (Quick Add, Weekly Summary) require the two Edge Functions to be deployed with
an `ANTHROPIC_API_KEY` secret set on the Supabase project - everything else runs without it.
To try the app pre-populated with data instead of starting from an empty account, see
`npm run seed:demo` (requires the Supabase `service_role` key, never committed).

---
