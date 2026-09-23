import React, { useState } from 'react';
import { Moon, Sun, Download, Upload, UserPlus, LogOut } from 'lucide-react';
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/hooks/useSettings';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useTags } from '@/hooks/useTags';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import { exportToPDF } from '@/utils/pdfExport';
import { toCsvRow } from '@/utils/csv';
import { buildExportData, parseImportFile, MonotaskExport } from '@/utils/dataPortability';
import UpgradeAccountModal from './UpgradeAccountModal';
import IntegrationsSettings from './IntegrationsSettings';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SECTION_TRANSITION = { type: 'spring' as const, stiffness: 100, damping: 20 };

/** Wraps a Card with a cursor-reactive spotlight glow, restricted to hover (an elevated-surface cue, not a gimmick). */
const SpotlightSection: React.FC<{ children: React.ReactNode; index: number; shouldReduceMotion: boolean }> = ({
  children,
  index,
  shouldReduceMotion,
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(360px circle at ${mouseX}px ${mouseY}px, hsl(var(--brand) / 0.12), transparent 65%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ ...SECTION_TRANSITION, delay: Math.min(index * 0.06, 0.24) }}
      onMouseMove={handleMouseMove}
      className="group relative rounded-lg"
    >
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background }}
        />
      )}
      {children}
    </motion.div>
  );
};

const Settings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { tasks, createTaskAsync, isLoading: tasksLoading } = useTasks();
  const { habits, logs, createHabitAsync, isLoading: habitsLoading } = useHabits();
  const { tags, createTagAsync, isLoading: tagsLoading } = useTags();
  const { events, isLoading: eventsLoading } = useEvents();
  const { user, isAnonymous, signOut } = useAuth();
  const shouldReduceMotion = !!useReducedMotion();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // Export/import must never run against tasks/habits/tags that haven't
  // finished loading yet - that silently produces an empty export or,
  // during import, treats every one of the account's own default tags as
  // "new" and drops the tag off any imported task/habit that used one.
  const dataReady = !tasksLoading && !habitsLoading && !tagsLoading && !eventsLoading;

  const handleToggleDarkMode = () => {
    const newTheme = settings?.theme === 'dark' ? 'light' : 'dark';
    updateSetting('theme', newTheme);
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(tasks, habits, logs, events);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const handleExportCSV = () => {
    const lines: string[] = [];

    lines.push('TASKS');
    lines.push(toCsvRow(['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Due Time', 'Source', 'Created At']));
    tasks.forEach(task => {
      lines.push(toCsvRow([
        task.title,
        task.description || '',
        task.status || '',
        task.priority || '',
        task.due_date || '',
        task.due_time || '',
        task.sync_connection_id ? (task.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : 'Monotask',
        task.created_at
      ]));
    });

    lines.push('');
    lines.push('HABITS');
    lines.push(toCsvRow(['Name', 'Description', 'Frequency', 'Preferred Time', 'Created At']));
    habits.forEach(habit => {
      lines.push(toCsvRow([
        habit.name,
        habit.description || '',
        habit.frequency,
        habit.preferred_time || '',
        habit.created_at
      ]));
    });

    lines.push('');
    lines.push('HABIT LOGS');
    lines.push(toCsvRow(['Habit ID', 'Date', 'Status', 'Notes']));
    logs.forEach(log => {
      lines.push(toCsvRow([
        log.habit_id,
        log.date,
        log.status,
        log.notes || ''
      ]));
    });

    lines.push('');
    lines.push('EVENTS');
    lines.push(toCsvRow(['Title', 'Description', 'Start', 'End', 'Location', 'Meeting URL', 'Source', 'Created At']));
    events.forEach(event => {
      lines.push(toCsvRow([
        event.title,
        event.description || '',
        event.start_time,
        event.end_time || '',
        event.location || '',
        event.meeting_url || '',
        event.sync_connection_id ? (event.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : 'Monotask',
        event.created_at
      ]));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monotask-data.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = buildExportData(tasks, habits, tags, events);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monotask-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      let data: MonotaskExport;
      try {
        const content = e.target?.result as string;
        data = parseImportFile(JSON.parse(content));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to parse the import file.');
        return;
      }

      setIsImporting(true);
      try {
        const tagIdByName = new Map(tags.map((tag) => [tag.name, tag.id]));

        for (const importedTag of data.tags) {
          if (tagIdByName.has(importedTag.name)) continue;
          try {
            const created = await createTagAsync({ name: importedTag.name, color: importedTag.color });
            tagIdByName.set(created.name, created.id);
          } catch {
            // Most likely a duplicate name (a tag by this name already exists but
            // wasn't in our loaded snapshot) - fall back to the real existing tag
            // instead of silently dropping every task/habit that referenced it.
            const existing = tags.find((tag) => tag.name === importedTag.name);
            if (existing) tagIdByName.set(existing.name, existing.id);
          }
        }

        let taskCount = 0;
        for (const importedTask of data.tasks) {
          await createTaskAsync({
            title: importedTask.title,
            description: importedTask.description || undefined,
            due_date: importedTask.due_date || undefined,
            due_time: importedTask.due_time || undefined,
            priority: importedTask.priority,
            status: importedTask.status,
            repeat_type: importedTask.repeat_type,
            repeat_interval: importedTask.repeat_interval,
            tag_id: importedTask.tag_name ? tagIdByName.get(importedTask.tag_name) : undefined,
          });
          taskCount++;
        }

        let habitCount = 0;
        for (const importedHabit of data.habits) {
          await createHabitAsync({
            name: importedHabit.name,
            description: importedHabit.description || undefined,
            frequency: importedHabit.frequency,
            frequency_days: importedHabit.frequency_days || undefined,
            preferred_time: importedHabit.preferred_time || undefined,
            tag_id: importedHabit.tag_name ? tagIdByName.get(importedHabit.tag_name) : undefined,
            is_active: true,
          });
          habitCount++;
        }

        toast.success(`Imported ${taskCount} task${taskCount === 1 ? '' : 's'} and ${habitCount} habit${habitCount === 1 ? '' : 's'}.`);
      } catch (error) {
        console.error('Error importing data:', error);
        toast.error('Import stopped partway through - some items may already have been created.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        {/* TopBar already renders "Settings" as the page h1. */}
        <p className="text-base font-medium text-foreground">Customize your Monotask experience</p>
      </div>

      {/* Guest Account Alert */}
      {isAnonymous && (
        <Alert className="border-brand/30 bg-brand/5">
          <UserPlus className="h-4 w-4 text-brand" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-foreground">
              You're using a guest account. Create a full account to save your data permanently.
            </span>
            <Button
              size="sm"
              onClick={() => setShowUpgradeModal(true)}
              className="w-fit"
            >
              <UserPlus className="w-4 h-4 mr-2" strokeWidth={2} />
              Create Account
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Account Section */}
      <SpotlightSection index={0} shouldReduceMotion={shouldReduceMotion}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">
                {isAnonymous ? 'Guest Account' : 'Email'}
              </h3>
              <p className="text-sm text-muted-foreground break-all">
                {isAnonymous ? 'No email linked' : user?.email}
              </p>
            </div>
            {isAnonymous && (
              <Button
                variant="outline"
                onClick={() => setShowUpgradeModal(true)}
                className="shrink-0"
              >
                <UserPlus className="w-4 h-4 mr-2" strokeWidth={2} />
                Upgrade
              </Button>
            )}
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">Sign Out</h3>
              <p className="text-sm text-muted-foreground">
                {isAnonymous ? 'Warning: guest data will be lost' : 'Sign out of your account'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" strokeWidth={2} />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
      </SpotlightSection>

      {/* Theme Settings */}
      <SpotlightSection index={1} shouldReduceMotion={shouldReduceMotion}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {settings?.theme === 'dark' ? (
                <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              )}
              <div>
                <h3 className="font-medium text-foreground">Dark Mode</h3>
                <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
              </div>
            </div>
            <Switch
              checked={settings?.theme === 'dark'}
              onCheckedChange={handleToggleDarkMode}
              aria-label="Toggle dark mode"
            />
          </div>
        </CardContent>
      </Card>
      </SpotlightSection>

      {/* Integrations */}
      <SpotlightSection index={2} shouldReduceMotion={shouldReduceMotion}>
        <IntegrationsSettings />
      </SpotlightSection>

      {/* Data Management */}
      <SpotlightSection index={3} shouldReduceMotion={shouldReduceMotion}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium text-foreground mb-2">Export Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Download your tasks and habits data</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleExportPDF}
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
                Export as PDF
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
                Export as CSV
              </Button>
              <Button
                onClick={handleExportJSON}
                variant="outline"
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
                Export as JSON
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium text-foreground mb-2">Import Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Restore tasks, habits, and tags from a Monotask JSON backup</p>
            <div className="flex items-center">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                id="import-file"
                disabled={isImporting || !dataReady}
              />
              <label htmlFor="import-file">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={isImporting || !dataReady}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" strokeWidth={2} />
                    {isImporting ? 'Importing...' : 'Import Data'}
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Only accepts JSON files exported from Monotask above. Habit completion history isn't included.
            </p>
          </div>
        </CardContent>
      </Card>
      </SpotlightSection>

      {/* App Information */}
      <SpotlightSection index={4} shouldReduceMotion={shouldReduceMotion}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="text-foreground font-medium">App:</span> Monotask</p>
          <p><span className="text-foreground font-medium">Version:</span> <span className="font-mono tabular-nums">1.0.0</span></p>
          <p><span className="text-foreground font-medium">Description:</span> Minimal productivity app for managing tasks and habits</p>
        </CardContent>
      </Card>
      </SpotlightSection>

      {/* Upgrade Account Modal */}
      <UpgradeAccountModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
      />
    </div>
  );
};

export default Settings;
