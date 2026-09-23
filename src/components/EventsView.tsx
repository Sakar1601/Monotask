import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Link as LinkIcon, Pencil } from 'lucide-react';
import { useEvents, Event } from '@/hooks/useEvents';
import EventModal from './EventModal';

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
      <div className="mx-auto max-w-4xl p-6">
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
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          {/* TopBar already renders "Events" as the page h1. */}
          <p className="text-base font-medium text-foreground">Meetings and calendar events, including ones synced from Google</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" strokeWidth={1.5} />
          <p>No events yet</p>
          <p className="text-sm">Create one, or connect Google Calendar in Settings</p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06 } } }}
          className="space-y-3"
        >
          <AnimatePresence initial={false}>
            {events.map((event) => (
            <motion.div
              key={event.id}
              layout={!prefersReducedMotion}
              variants={prefersReducedMotion ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.15 } }}
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex items-start justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:shadow-[0_16px_36px_-20px_hsl(var(--primary)/0.5)]"
            >
              <button type="button" className="flex-1 text-left" onClick={() => handleEdit(event)}>
                <div className="flex items-center gap-2">
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
                </div>
                <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {new Date(event.start_time).toLocaleString()}
                  {event.end_time && ` – ${new Date(event.end_time).toLocaleString()}`}
                </div>
                {event.location && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" strokeWidth={1.75} /> {event.location}
                  </div>
                )}
                {event.meeting_url && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <LinkIcon className="h-3 w-3" strokeWidth={1.75} /> {event.meeting_url}
                  </div>
                )}
                {event.tags && (
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: event.tags.color }}
                  >
                    {event.tags.name}
                  </span>
                )}
              </button>
              <div className="ml-4 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
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
                      <AlertDialogCancel>
                        Cancel
                      </AlertDialogCancel>
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
        </motion.div>
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
