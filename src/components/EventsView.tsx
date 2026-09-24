import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Link as LinkIcon, Pencil } from 'lucide-react';
import { useEvents, Event } from '@/hooks/useEvents';
import EventModal from './EventModal';

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatTimeRange = (event: Event) => {
  const start = new Date(event.start_time);
  if (!event.end_time) return fmtTime(start);
  const end = new Date(event.end_time);
  return dayKey(start) === dayKey(end) ? `${fmtTime(start)} - ${fmtTime(end)}` : `${fmtTime(start)} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

const groupEventsByDay = (events: Event[]) => {
  const sorted = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const groups: { key: string; label: string; sublabel: string; events: Event[] }[] = [];
  for (const event of sorted) {
    const d = new Date(event.start_time);
    const key = dayKey(d);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const long = d.toLocaleDateString([], { weekday: 'long' });
      group = {
        key,
        label: key === dayKey(today) ? 'Today' : key === dayKey(tomorrow) ? 'Tomorrow' : long,
        sublabel: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
        events: [],
      };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
};

const EventsView: React.FC = () => {
  const { events, isLoading, deleteEvent, isDeleting } = useEvents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const handleCreate = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const prefersReducedMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className="">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mb-8 flex items-center justify-between">
        <div>
          {/* TopBar already renders "Events" as the page h1. */}
          <p className="text-[15px] text-muted-foreground">Meetings and calendar events, including ones synced from Google</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarIcon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="font-grotesk text-base font-medium text-foreground">No events yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create one, or connect Google or Outlook in Settings to bring your calendar in.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupEventsByDay(events).map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 flex items-baseline gap-3 font-grotesk text-lg font-semibold text-foreground">
                {group.label}
                <span className="font-mono text-xs font-normal text-muted-foreground">{group.sublabel}</span>
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                <AnimatePresence initial={false}>
                  {group.events.map((event) => (
                    <motion.div
                      key={event.id}
                      layout={!prefersReducedMotion}
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.15 } }}
                      className="group grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[11rem_1fr_auto] sm:gap-x-6"
                    >
                      <div className="col-span-2 whitespace-nowrap pt-0.5 font-mono text-xs tabular-nums text-muted-foreground sm:col-span-1">
                        {formatTimeRange(event)}
                      </div>
                      <button type="button" className="min-w-0 text-left" onClick={() => handleEdit(event)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-foreground">{event.title}</h3>
                          {event.sync_connection_id && (
                            <Badge variant="secondary" className="font-normal">
                              {event.sync_provider === 'microsoft' ? 'Outlook' : 'Google'}
                            </Badge>
                          )}
                          {event.sync_error && (
                            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 font-normal text-destructive" title={event.sync_error}>
                              Sync failed
                            </Badge>
                          )}
                          {event.tags && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: event.tags.color }}
                            >
                              {event.tags.name}
                            </span>
                          )}
                        </div>
                        {event.location && (
                          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} /> {event.location}
                          </div>
                        )}
                        {event.meeting_url && (
                          <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                            <LinkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{event.meeting_url.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${event.title}`} onClick={() => handleEdit(event)}>
                          <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${event.title}`}
                              disabled={isDeleting}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Event</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{event.title}"?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEvent(event.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Event
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
      />
    </div>
  );
};

export default EventsView;
