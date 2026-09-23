import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEvents, Event } from '@/hooks/useEvents';
import TagSelector from './TagSelector';

// Floating-layer glass treatment: backdrop blur + inner border/highlight,
// with a solid fallback for prefers-reduced-transparency. Applied via
// inline style (not a className override) so it reliably wins over the
// shared ui/dialog.tsx primitive's own opaque background class.
const useReducedTransparency = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-transparency: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
};

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
  const reducedTransparency = useReducedTransparency();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="mx-4 max-h-[90vh] max-w-md overflow-y-auto shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] sm:mx-auto"
        style={
          reducedTransparency
            ? undefined
            : { backgroundColor: 'hsl(var(--background) / 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
        }
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
        <DialogHeader>
          <DialogTitle>
            {event ? 'Edit Event' : 'Create Event'}
            {syncedFromLabel && (
              <span className="ml-2 text-xs font-normal text-primary">(from {syncedFromLabel})</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          variants={fieldListVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <Input
              placeholder="Event title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="resize-none"
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants} className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Start</label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                required
                className="tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">End (optional)</label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                className="tabular-nums"
              />
            </div>
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <Input
              placeholder="Location (optional)"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <Input
              placeholder="Meeting link (optional)"
              value={formData.meeting_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants}>
            <label className="mb-2 block text-sm font-medium text-foreground">Tag</label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData((prev) => ({ ...prev, tag_id: value }))}
            />
          </motion.div>

          <motion.div variants={prefersReducedMotion ? reducedFieldItemVariants : fieldItemVariants} className="flex flex-col-reverse justify-end gap-2 pt-4 sm:flex-row">
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
