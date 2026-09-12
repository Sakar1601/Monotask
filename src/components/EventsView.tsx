import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Events</h1>
          <p className="text-gray-600 dark:text-gray-400">Meetings and calendar events, including ones synced from Google</p>
        </div>
        <Button onClick={handleCreate} className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No events yet</p>
          <p className="text-sm">Create one, or connect Google Calendar in Settings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <button type="button" className="flex-1 text-left" onClick={() => handleEdit(event)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-black dark:text-white">{event.title}</h3>
                  {event.sync_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      {event.sync_provider === 'microsoft' ? 'Outlook' : 'Google'}
                    </span>
                  )}
                  {event.sync_error && (
                    <span
                      className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                      title={event.sync_error}
                    >
                      Sync failed
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {new Date(event.start_time).toLocaleString()}
                  {event.end_time && ` – ${new Date(event.end_time).toLocaleString()}`}
                </div>
                {event.location && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {event.location}
                  </div>
                )}
                {event.meeting_url && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> {event.meeting_url}
                  </div>
                )}
                {event.tags && (
                  <span
                    className="inline-block mt-2 px-2 py-1 text-xs rounded text-white"
                    style={{ backgroundColor: event.tags.color }}
                  >
                    {event.tags.name}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border-gray-300 dark:border-gray-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-black dark:text-white">Delete Event</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete "{event.title}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteEvent(event.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete Event
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
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
