import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEvents, Event } from '@/hooks/useEvents';
import TagSelector from './TagSelector';

const fieldListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};
const fieldItemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const reducedFieldItemVariants = { hidden: { opacity: 1 }, show: { opacity: 1 } };

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Event | null;
  prefilledDate?: string;
}

const toDateTimeLocal = (isoString?: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, prefilledDate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_url: '',
    tag_id: '',
  });

  const { createEvent, updateEvent, isCreating, isUpdating } = useEvents();

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        start_time: toDateTimeLocal(event.start_time),
        end_time: toDateTimeLocal(event.end_time),
        location: event.location || '',
        meeting_url: event.meeting_url || '',
        tag_id: event.tag_id || '',
      });
    } else if (prefilledDate) {
      setFormData({
        title: '',
        description: '',
        start_time: `${prefilledDate}T09:00`,
        end_time: '',
        location: '',
        meeting_url: '',
        tag_id: '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        meeting_url: '',
        tag_id: '',
      });
    }
  }, [event, prefilledDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      title: formData.title,
      description: formData.description || null,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
      location: formData.location || null,
      meeting_url: formData.meeting_url || null,
      tag_id: formData.tag_id || null,
    };

    if (event) {
      updateEvent({ id: event.id, ...eventData });
    } else {
      createEvent(eventData);
    }

    onClose();
  };

  const syncedFromLabel = event?.sync_connection_id ? (event.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : null;
  const prefersReducedMotion = useReducedMotion();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-4 max-h-[90vh] max-w-lg overflow-y-auto pb-0 sm:mx-auto">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
        <DialogHeader className="mb-5">
          <DialogTitle>
            {event ? 'Edit Event' : 'Create Event'}
            {syncedFromLabel && (
              <span className="ml-2 text-xs font-normal text-primary">(from {syncedFromLabel})</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {event ? 'Update the details below.' : 'Add a meeting or event to your calendar.'}
          </DialogDescription>
        </DialogHeader>
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          variants={fieldListVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label htmlFor="event-title" className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
            <Input
              id="event-title"
              placeholder="Event title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label htmlFor="event-description" className="mb-1.5 block text-sm font-medium text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea
              id="event-description"
              placeholder="Add details"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="resize-none"
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants} className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Start</label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                required
                className="tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">End <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                className="tabular-nums"
              />
            </div>
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label htmlFor="event-location" className="mb-1.5 block text-sm font-medium text-foreground">Location <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              id="event-location"
              placeholder="Add a place"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label htmlFor="event-link" className="mb-1.5 block text-sm font-medium text-foreground">Meeting link <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              id="event-link"
              placeholder="https://"
              value={formData.meeting_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tag</label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData((prev) => ({ ...prev, tag_id: value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants} className="-mx-6 mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating}
            >
              {isCreating || isUpdating ? 'Saving...' : event ? 'Update' : 'Create'}
            </Button>
          </motion.div>
        </motion.form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
