export type Priority = 'low' | 'medium' | 'high';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface QuickAddPreview {
  title: string;
  dueDate: Date | null;
  time: string | null;
  priority: Priority;
  repeat: Repeat;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const addDays = (base: Date, days: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * A tiny, deterministic stand-in for the real AI Quick Add, used only for the
 * landing page's try-it demo so visitors can play without an account or any
 * API cost. It handles common phrasings; the real feature (Claude) handles
 * far more, which the demo says out loud.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddPreview {
  let text = ` ${input.trim()} `;
  const take = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(re, ' ');
    return m;
  };

  let priority: Priority = 'medium';
  if (take(/\s(?:(?:high|urgent|top)\s+priority|urgent|asap)\b/i)) priority = 'high';
  else if (take(/\s(?:low\s+priority|whenever)\b/i)) priority = 'low';

  let repeat: Repeat = 'none';
  let repeatWeekday: number | null = null;
  const everyDay = take(/\severy\s+(mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\b/i);
  if (everyDay) {
    repeat = 'weekly';
    repeatWeekday = WEEKDAYS.findIndex((w) => w.startsWith(everyDay[1].toLowerCase().slice(0, 3)));
  } else if (take(/\s(?:every\s+day|daily)\b/i)) repeat = 'daily';
  else if (take(/\s(?:every\s+week|weekly)\b/i)) repeat = 'weekly';
  else if (take(/\s(?:every\s+month|monthly)\b/i)) repeat = 'monthly';

  let dueDate: Date | null = null;
  if (take(/\s(?:today|tonight)\b/i)) dueDate = addDays(now, 0);
  else if (take(/\s(?:tomorrow|tmrw)\b/i)) dueDate = addDays(now, 1);
  else {
    const inDays = take(/\sin\s+(\d{1,3})\s+days?\b/i);
    if (inDays) dueDate = addDays(now, Number(inDays[1]));
    else if (take(/\snext\s+week\b/i)) dueDate = addDays(now, 7);
    else {
      const wd = take(/\s(?:next\s+|on\s+)?(mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\b/i);
      if (wd) {
        const target = WEEKDAYS.findIndex((w) => w.startsWith(wd[1].toLowerCase().slice(0, 3)));
        dueDate = addDays(now, ((target - now.getDay() + 7) % 7) || 7);
      }
    }
  }
  if (!dueDate && repeatWeekday !== null && repeatWeekday >= 0) {
    dueDate = addDays(now, ((repeatWeekday - now.getDay() + 7) % 7) || 7);
  }

  let time: string | null = null;
  const ampm = take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    time = `${Number(ampm[1])}:${ampm[2] ?? '00'} ${ampm[3].toUpperCase()}`;
  } else if (take(/\s(?:at\s+)?noon\b/i)) {
    time = '12:00 PM';
  } else {
    const h24 = take(/\sat\s+(\d{1,2}):(\d{2})\b/i);
    if (h24) {
      const h = Number(h24[1]);
      time = `${h % 12 === 0 ? 12 : h % 12}:${h24[2]} ${h >= 12 ? 'PM' : 'AM'}`;
    }
  }

  const title = text
    .replace(/\s+(?:on|at|by|for)\s*$/i, ' ')
    .replace(/[\s,;.]+/g, ' ')
    .replace(/^\s*(?:on|at|by)\s+/i, '')
    .trim();

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : '',
    dueDate,
    time,
    priority,
    repeat,
  };
}
