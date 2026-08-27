// Seeds two demo accounts for showing Monotask end-to-end:
//   - a "power user" account with rich data covering most feature edge cases
//   - a "brand new user" account (just the default tags, nothing else)
//
// Re-runnable: deletes and recreates both accounts by email each time, so
// dates stay relative to "today" for every demo.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-demo-data.ts
//
// Requires the service_role key (Project Settings -> API in the Supabase
// dashboard) - this bypasses RLS and must never be used client-side or
// committed anywhere.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://masofmjpnpnxjooqdajl.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (Supabase dashboard -> Project Settings -> API).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function randomPassword(): string {
  return randomBytes(9).toString('base64url'); // ~12 chars, URL-safe
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function isoTimestamp(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

async function deleteExistingUserByEmail(email: string) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) {
      await admin.auth.admin.deleteUser(match.id);
      return;
    }
    if (data.users.length < 200) return;
    page++;
  }
}

async function createUser(email: string, password: string, username: string): Promise<string> {
  await deleteExistingUserByEmail(email);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  return data.user.id;
}

async function getDefaultTags(userId: string): Promise<Record<string, string>> {
  // The on_auth_user_created trigger inserts these synchronously with the user row.
  const { data, error } = await admin.from('tags').select('id, name').eq('user_id', userId);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.name] = t.id;
  return map;
}

async function addTags(userId: string, tags: Array<{ name: string; color: string }>): Promise<Record<string, string>> {
  const { data, error } = await admin
    .from('tags')
    .insert(tags.map((t) => ({ user_id: userId, ...t })))
    .select('id, name');
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.name] = t.id;
  return map;
}

async function seedPowerUser(email: string, password: string) {
  const userId = await createUser(email, password, 'Alex Chen');
  const defaultTags = await getDefaultTags(userId);
  const extraTags = await addTags(userId, [
    { name: 'Fitness', color: '#4b5563' },
    { name: 'Finance', color: '#71717a' },
  ]);
  const tags = { ...defaultTags, ...extraTags };

  const tasks = [
    // Overdue - various priorities, one untagged, one with special characters
    { title: 'Renew passport', priority: 'high', status: 'pending', due_date: isoDate(-5), tag_id: null },
    { title: 'Submit Q3 report', priority: 'medium', status: 'pending', due_date: isoDate(-2), tag_id: tags['Work'] },
    {
      title: 'Buy groceries: milk, eggs & "organic" bread',
      priority: 'low',
      status: 'pending',
      due_date: isoDate(-1),
      tag_id: tags['Personal'],
    },
    // Today - with and without time
    {
      title: 'Client call',
      priority: 'high',
      status: 'pending',
      due_date: isoDate(0),
      due_time: '14:30',
      tag_id: tags['Work'],
    },
    { title: 'Morning workout', priority: 'medium', status: 'pending', due_date: isoDate(0), tag_id: tags['Health'] },
    { title: 'Take vitamins', priority: 'low', status: 'pending', due_date: isoDate(0), repeat_type: 'daily', tag_id: tags['Health'] },
    // Upcoming - including recurring
    { title: 'Finish React course module 3', priority: 'medium', status: 'pending', due_date: isoDate(1), tag_id: tags['Learning'] },
    {
      title: 'Team standup notes',
      priority: 'low',
      status: 'pending',
      due_date: isoDate(3),
      repeat_type: 'weekly',
      tag_id: tags['Work'],
    },
    {
      title: 'Pay rent',
      priority: 'high',
      status: 'pending',
      due_date: isoDate(7),
      repeat_type: 'monthly',
      tag_id: tags['Finance'],
    },
    { title: 'Dentist appointment', priority: 'medium', status: 'pending', due_date: isoDate(4), due_time: '09:00', tag_id: tags['Health'] },
    { title: 'Review pull requests', priority: 'medium', status: 'pending', due_date: isoDate(2), tag_id: tags['Work'] },
    // Completed - spread across the last two weeks
    { title: 'Finish quarterly presentation', priority: 'high', status: 'completed', due_date: isoDate(-3), completed_at: isoTimestamp(-3), tag_id: tags['Work'] },
    { title: 'Read chapter 5', priority: 'low', status: 'completed', due_date: isoDate(-10), completed_at: isoTimestamp(-10), tag_id: tags['Learning'] },
    { title: 'Doctor appointment', priority: 'high', status: 'completed', due_date: isoDate(-1), completed_at: isoTimestamp(-1), tag_id: tags['Personal'] },
    { title: 'Grocery run', priority: 'low', status: 'completed', due_date: isoDate(-6), completed_at: isoTimestamp(-6), tag_id: tags['Personal'] },
    { title: 'Weekly budget review', priority: 'medium', status: 'completed', due_date: isoDate(-4), completed_at: isoTimestamp(-4), tag_id: tags['Finance'] },
    // Cancelled - edge case status the UI filter doesn't expose
    { title: 'Marathon registration', priority: 'medium', status: 'cancelled', due_date: isoDate(-8), tag_id: tags['Fitness'] },
    // No due date, long description, untagged
    {
      title: 'Someday: learn woodworking',
      description:
        'A long-term idea with no deadline yet - want to build a small bookshelf and a side table. Need to research beginner tool sets and find a local workshop or class before committing to buying equipment.',
      priority: 'low',
      status: 'pending',
      tag_id: null,
    },
    // Long title to exercise truncation in cards
    {
      title:
        'Prepare comprehensive end-to-end migration plan for legacy authentication system including rollback procedures and stakeholder sign-off checklist',
      priority: 'high',
      status: 'pending',
      due_date: isoDate(5),
      tag_id: tags['Work'],
    },
  ];

  const { error: tasksError } = await admin.from('tasks').insert(
    tasks.map((t) => ({ user_id: userId, description: null, due_time: null, repeat_type: 'none', ...t })),
  );
  if (tasksError) throw tasksError;

  const habits = [
    { name: 'Meditate', frequency: 'daily', preferred_time: '07:00', tag_id: tags['Health'] },
    { name: 'Read 20 pages', frequency: 'daily', preferred_time: '21:00', tag_id: tags['Learning'] },
    // frequency_days uses this app's own 1=Sun..7=Sat convention (see HabitsView.getFrequencyDisplay),
    // not JS Date#getDay()'s 0=Sun - 2/4/6 here means Mon/Wed/Fri.
    { name: 'Gym session', frequency: 'weekly', frequency_days: [2, 4, 6], preferred_time: '18:00', tag_id: tags['Fitness'] },
    { name: 'Review budget', frequency: 'monthly', preferred_time: null, tag_id: tags['Finance'] },
  ];

  const { data: insertedHabits, error: habitsError } = await admin
    .from('habits')
    .insert(habits.map((h) => ({ user_id: userId, description: null, ...h })))
    .select('id, name, frequency, frequency_days');
  if (habitsError) throw habitsError;

  const logs: Array<{ user_id: string; habit_id: string; date: string; status: string }> = [];
  const meditate = insertedHabits!.find((h) => h.name === 'Meditate')!;
  const read = insertedHabits!.find((h) => h.name === 'Read 20 pages')!;
  const gym = insertedHabits!.find((h) => h.name === 'Gym session')!;
  const budget = insertedHabits!.find((h) => h.name === 'Review budget')!;

  // Daily habits: ~40 days of logs, mostly completed with a realistic mix of skips/misses
  for (let offset = -40; offset <= 0; offset++) {
    const date = isoDate(offset);
    const roll = Math.random();
    logs.push({ user_id: userId, habit_id: meditate.id, date, status: roll < 0.78 ? 'completed' : roll < 0.93 ? 'skipped' : 'failed' });
  }
  for (let offset = -25; offset <= 0; offset++) {
    const date = isoDate(offset);
    const roll = Math.random();
    logs.push({ user_id: userId, habit_id: read.id, date, status: roll < 0.65 ? 'completed' : roll < 0.85 ? 'skipped' : 'failed' });
  }
  // Weekly habit: only log on its scheduled days (Mon/Wed/Fri = getDay() 1/3/5) for the last ~8 weeks
  for (let offset = -56; offset <= 0; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if ([1, 3, 5].includes(d.getDay())) {
      const roll = Math.random();
      logs.push({ user_id: userId, habit_id: gym.id, date: isoDate(offset), status: roll < 0.7 ? 'completed' : 'skipped' });
    }
  }
  // Monthly habit: a couple of past logs
  logs.push({ user_id: userId, habit_id: budget.id, date: isoDate(-30), status: 'completed' });
  logs.push({ user_id: userId, habit_id: budget.id, date: isoDate(-60), status: 'completed' });

  const { error: logsError } = await admin.from('logs').insert(logs);
  if (logsError) throw logsError;

  console.log(`Power-user account seeded: ${tasks.length} tasks, ${habits.length} habits, ${logs.length} habit logs.`);
}

async function seedNewUser(email: string, password: string) {
  await createUser(email, password, 'Jordan Lee');
  console.log('New-user account seeded: default tags only, no tasks/habits (fresh-signup state).');
}

async function main() {
  const powerPassword = randomPassword();
  const newUserPassword = randomPassword();

  await seedPowerUser('demo@monotask.dev', powerPassword);
  await seedNewUser('newuser@monotask.dev', newUserPassword);

  console.log('\n=== Demo credentials ===');
  console.log(`Power user:  demo@monotask.dev / ${powerPassword}`);
  console.log(`New user:    newuser@monotask.dev / ${newUserPassword}`);
  console.log('\nSign in at /auth with either. Re-run this script anytime to reset both accounts with fresh dates.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
