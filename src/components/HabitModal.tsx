
import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHabits, Habit } from '@/hooks/useHabits';
import { cn } from '@/lib/utils';
import TagSelector from './TagSelector';
import { SegmentedControl } from '@/components/ui/segmented-control';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit | null;
}

const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, habit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    frequency_days: [1, 2, 3, 4, 5, 6, 7] as number[],
    preferred_time: '',
    tag_id: '',
    is_active: true,
  });
  const [nameError, setNameError] = useState('');

  const { createHabit, updateHabit, isCreating, isUpdating } = useHabits();
  const reduceMotion = useReducedMotion();
  const fieldTransition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };
  const fieldVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { ...fieldTransition, delay: reduceMotion ? 0 : i * 0.05 } }),
  };
  const focusGlow = 'transition-shadow duration-200 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]';

  useEffect(() => {
    if (habit) {
      setFormData({
        name: habit.name,
        description: habit.description || '',
        frequency: habit.frequency,
        frequency_days: habit.frequency_days || [1, 2, 3, 4, 5, 6, 7],
        preferred_time: habit.preferred_time || '',
        tag_id: habit.tag_id || '',
        is_active: habit.is_active,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        frequency: 'daily',
        frequency_days: [1, 2, 3, 4, 5, 6, 7],
        preferred_time: '',
        tag_id: '',
        is_active: true,
      });
    }
    setNameError('');
  }, [habit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setNameError('Give this habit a name before saving.');
      return;
    }

    const habitData = {
      ...formData,
      tag_id: formData.tag_id || undefined,
      preferred_time: formData.preferred_time || undefined,
    };

    if (habit) {
      updateHabit({ id: habit.id, ...habitData });
    } else {
      createHabit(habitData);
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-4 max-h-[90vh] max-w-lg overflow-y-auto pb-0 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="font-grotesk">
            {habit ? 'Edit habit' : 'Create habit'}
          </DialogTitle>
          <DialogDescription>
            {habit ? 'Update the details below.' : 'Pick something you want to do regularly, then log it each day.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div custom={0} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label htmlFor="habit-name" className="mb-1.5 block text-sm font-medium text-foreground">Habit name</Label>
            <Input
              id="habit-name"
              placeholder="Habit name"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                if (nameError) setNameError('');
              }}
              aria-invalid={!!nameError}
              className={cn(focusGlow, nameError && 'border-destructive focus-visible:ring-destructive')}
            />
            {nameError && <p className="mt-1.5 text-xs text-destructive">{nameError}</p>}
          </motion.div>

          <motion.div custom={1} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label htmlFor="habit-description" className="mb-1.5 block text-sm font-medium text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="habit-description"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={cn('resize-none', focusGlow)}
            />
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Frequency</Label>
            <SegmentedControl
              aria-label="Frequency"
              value={formData.frequency}
              onChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </motion.div>

          <motion.div custom={3} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label htmlFor="habit-time" className="mb-1.5 block text-sm font-medium text-foreground">
              Preferred time <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="habit-time"
              type="time"
              value={formData.preferred_time}
              onChange={(e) => setFormData(prev => ({ ...prev, preferred_time: e.target.value }))}
              className={focusGlow}
            />
          </motion.div>

          <motion.div custom={4} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Tag</Label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData(prev => ({ ...prev, tag_id: value }))}
            />
          </motion.div>

          <div className="-mx-6 mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : (habit ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HabitModal;
