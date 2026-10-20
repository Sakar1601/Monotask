// Cron-invoked (every 5 minutes) with the service-role key, like
// detect-conflicts. Finds tasks, events and habits whose reminder time has
// just arrived and sends a Web Push to each of the owner's subscribed
// devices.
//
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (a mailto: or https: contact URL).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { authorizeScheduledRequest } from "../_shared/scheduledRequestAuth.ts";
import {
  eventReminder,
  habitReminder,
  isDue,
  localDay,
  safeTimeZone,
  taskReminder,
  EVENT_LEAD_MS,
  GRACE_MS,
  type EventRow,
  type HabitRow,
  type Reminder,
  type TaskRow,
} from "./reminders.ts";

const SENT_RETENTION_DAYS = 7;

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authError = authorizeScheduledRequest(req, serviceRoleKey);
    if (authError) return authError;

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return json({ error: "Server configuration error" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const admin = createClient(supabaseUrl, serviceRoleKey!);
    const now = new Date();

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, timezone")
      .order("created_at", { ascending: false });
    if (subsError) throw subsError;
    if (!subs?.length) return json({ sent: 0 });

    const subsByUser = new Map<string, Subscription[]>();
    for (const sub of subs as Subscription[]) {
      const list = subsByUser.get(sub.user_id) ?? [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }
    const userIds = [...subsByUser.keys()];
    // Newest subscription's zone is treated as the user's current zone.
    const zoneOf = (userId: string) => safeTimeZone(subsByUser.get(userId)![0].timezone);

    // Dates are fetched with a +-1 day margin because "today" differs per
    // user zone; the precise local-time check happens in reminders.ts.
    const dayMs = 86_400_000;
    const dateFrom = new Date(now.getTime() - dayMs).toISOString().slice(0, 10);
    const dateTo = new Date(now.getTime() + dayMs).toISOString().slice(0, 10);

    const [tasksRes, eventsRes, habitsRes, logsRes] = await Promise.all([
      admin
        .from("tasks")
        .select("id, user_id, title, status, due_date, due_time, repeat_type")
        .in("user_id", userIds)
        .gte("due_date", dateFrom)
        .lte("due_date", dateTo)
        .not("due_time", "is", null),
      admin
        .from("events")
        .select("id, user_id, title, start_time, location")
        .in("user_id", userIds)
        .gt("start_time", now.toISOString())
        .lte("start_time", new Date(now.getTime() + EVENT_LEAD_MS + 60_000).toISOString()),
      admin
        .from("habits")
        .select("id, user_id, name, frequency, frequency_days, preferred_time, is_active")
        .in("user_id", userIds)
        .not("preferred_time", "is", null),
      admin
        .from("logs")
        .select("habit_id, user_id, date")
        .in("user_id", userIds)
        .not("habit_id", "is", null)
        .gte("date", dateFrom)
        .lte("date", dateTo),
    ]);
    for (const res of [tasksRes, eventsRes, habitsRes, logsRes]) {
      if (res.error) throw res.error;
    }

    const candidates: (Reminder & { userId: string })[] = [];
    const add = (userId: string, reminder: Reminder | null) => {
      if (reminder && isDue(reminder.remindAt, now)) candidates.push({ ...reminder, userId });
    };

    for (const t of (tasksRes.data ?? []) as (TaskRow & { user_id: string })[]) {
      add(t.user_id, taskReminder(t, zoneOf(t.user_id)));
    }
    for (const e of (eventsRes.data ?? []) as (EventRow & { user_id: string })[]) {
      add(e.user_id, eventReminder(e, now));
    }
    // Any log for the local day (completed/skipped/failed) means the user
    // has already dealt with that habit today.
    const loggedToday = new Map<string, Set<string>>();
    for (const log of logsRes.data ?? []) {
      if (log.date !== localDay(now, zoneOf(log.user_id)).date) continue;
      const set = loggedToday.get(log.user_id) ?? new Set<string>();
      set.add(log.habit_id);
      loggedToday.set(log.user_id, set);
    }
    for (const h of (habitsRes.data ?? []) as (HabitRow & { user_id: string })[]) {
      add(h.user_id, habitReminder(h, zoneOf(h.user_id), now, loggedToday.get(h.user_id) ?? new Set()));
    }

    let sent = 0;
    const deadSubscriptionIds: string[] = [];

    if (candidates.length > 0) {
      // Claim reminders first; the primary key rejects any already sent by an
      // earlier (overlapping) run, and only newly inserted rows come back.
      const { data: claimed, error: claimError } = await admin
        .from("sent_reminders")
        .upsert(
          candidates.map((c) => ({
            user_id: c.userId,
            kind: c.kind,
            item_id: c.itemId,
            remind_at: c.remindAt.toISOString(),
          })),
          { onConflict: "user_id,kind,item_id,remind_at", ignoreDuplicates: true },
        )
        .select("user_id, kind, item_id, remind_at");
      if (claimError) throw claimError;

      const claimedKeys = new Set(
        (claimed ?? []).map((r) => `${r.user_id}|${r.kind}|${r.item_id}|${new Date(r.remind_at).toISOString()}`),
      );

      for (const c of candidates) {
        if (!claimedKeys.has(`${c.userId}|${c.kind}|${c.itemId}|${c.remindAt.toISOString()}`)) continue;
        const payload = JSON.stringify({
          title: c.title,
          body: c.body,
          url: c.url,
          tag: `${c.kind}-${c.itemId}`,
        });
        for (const sub of subsByUser.get(c.userId) ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { TTL: Math.floor(GRACE_MS / 1000) },
            );
            sent++;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            // 404/410: the browser revoked or expired this subscription.
            if (status === 404 || status === 410) deadSubscriptionIds.push(sub.id);
            else console.error("send-reminders: push failed", status, (err as Error).message);
          }
        }
      }
    }

    if (deadSubscriptionIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }
    await admin
      .from("sent_reminders")
      .delete()
      .lt("sent_at", new Date(now.getTime() - SENT_RETENTION_DAYS * dayMs).toISOString());

    return json({ sent, removedSubscriptions: deadSubscriptionIds.length });
  } catch (error) {
    console.error("send-reminders error:", error);
    return json({ error: "Internal error" }, 500);
  }
});
