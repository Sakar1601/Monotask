# Monotask - Project Documentation

> A minimal productivity application for managing tasks and habits, built with React, TypeScript, and Supabase.

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
12. [Configuration & Dependencies](#configuration--dependencies)
13. [File Structure](#file-structure)

---

## Project Overview

**Monotask** is a minimalist productivity application that helps users:
- Create and manage tasks with due dates, priorities, and tags
- Track daily/weekly/monthly habits
- Visualize progress through analytics and charts
- Export data in PDF and CSV formats

### Key Features
- **Task Management**: Create, edit, delete, and complete tasks with recurring schedules
- **Habit Tracking**: Log daily habits with completion status (done, skipped, missed)
- **Calendar View**: Month/week/agenda views with task visualization
- **Progress Analytics**: Weekly completion charts, category distribution, activity heatmap
- **Tags System**: Organize tasks and habits with custom color-coded tags
- **Dark/Light Theme**: User-configurable appearance settings
- **Guest Access**: Anonymous sign-in with account upgrade capability
- **Data Export**: PDF and CSV export functionality

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui components |
| **State Management** | TanStack Query (React Query) |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) |
| **Charts** | Recharts |
| **Routing** | React Router DOM v6 |
| **Forms** | React Hook Form, Zod validation |
| **Notifications** | Sonner (toast notifications) |
| **PDF Export** | jsPDF |

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
| `goals` | User goals with targets |
| `task_instances` | Recurring task instance tracking |

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
```

### Table Details

#### `profiles`
Stores user-specific settings and preferences.
```sql
id: uuid (PK, references auth.users)
username: text
settings: jsonb  -- {theme, timeFormat, timezone, font}
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

#### `tags`
User-defined categories for organization.
```sql
id: uuid (PK)
user_id: uuid (FK → auth.users)
name: text (required)
color: text (hex color, default '#6b7280')
created_at: timestamp
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
| `TaskManager` | `src/components/TaskManager.tsx` | Full task list with filters, tabs (today/upcoming/overdue/all) |
| `CalendarView` | `src/components/CalendarView.tsx` | Month/week/agenda views with task markers |
| `HabitsView` | `src/components/HabitsView.tsx` | Habit list with daily logging (done/skip/miss) |
| `TagsView` | `src/components/TagsView.tsx` | Tag management with usage counts |
| `ProgressView` | `src/components/ProgressView.tsx` | Analytics with charts and export options |
| `Settings` | `src/components/Settings.tsx` | User preferences, theme toggle, data export |

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
  updateTask,     // Update existing task
  deleteTask,     // Delete task
  isCreating,     // Creation in progress
  isUpdating,     // Update in progress
  isDeleting,     // Deletion in progress
  getTodayTasks,  // Filter: today's tasks
  getUpcomingTasks,   // Filter: next 7 days
  getOverdueTasks     // Filter: past due
} = useTasks();
```

### `useHabits` (`src/hooks/useHabits.tsx`)

Habit management and logging functionality.

```typescript
const {
  habits,         // Habit array
  logs,           // Habit logs array
  isLoading,      // Loading state
  createHabit,    // Create new habit
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
- **Today**: `due_date === today`
- **Upcoming**: Tasks from today (uncompleted) through next 7 days
- **Overdue**: `due_date < today && status !== 'completed'`

**Recurring Tasks:**
- Types: `none`, `daily`, `weekly`, `monthly`
- Interval: Number of periods between occurrences

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
- **CSV**: Tasks + Habits + Logs in structured format
- **PDF**: Summary report with metrics

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

## Configuration & Dependencies

### Environment Variables

The app uses Supabase client configuration:
```typescript
// src/integrations/supabase/client.ts
const supabaseUrl = 'https://[project-ref].supabase.co';
const supabaseKey = '[anon-key]';
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `@tanstack/react-query` | ^5.56.2 | Data fetching/caching |
| `@supabase/supabase-js` | ^2.50.0 | Backend client |
| `react-router-dom` | ^6.26.2 | Routing |
| `recharts` | ^2.12.7 | Charts/visualizations |
| `date-fns` | ^3.6.0 | Date utilities |
| `sonner` | ^1.5.0 | Toast notifications |
| `jspdf` | ^3.0.1 | PDF generation |
| `tailwindcss` | - | Styling |
| `shadcn/ui` | - | UI component library |

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
│   ├── use-mobile.tsx      # Mobile detection
│   └── use-toast.ts        # Toast notifications
│
├── pages/
│   ├── Index.tsx           # Main app page
│   └── NotFound.tsx        # 404 page
│
├── integrations/
│   └── supabase/
│       ├── client.ts       # Supabase client setup
│       └── types.ts        # Generated TypeScript types
│
├── utils/
│   ├── pdfExport.ts        # PDF generation utility
│   └── recurringTasks.ts   # Recurring task helpers
│
└── lib/
    └── utils.ts            # General utilities (cn, etc.)

supabase/
├── config.toml             # Supabase configuration
└── migrations/             # Database migrations

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
8. **Import Placeholder**: Data import UI exists but functionality is not complete

---

## Getting Started (Development)

1. Clone repository
2. Install dependencies: `npm install`
3. Configure Supabase credentials
4. Enable Anonymous Sign-ins in Supabase Auth settings
5. Run development server: `npm run dev`

---

*Documentation generated for Monotask v1.0.0*
