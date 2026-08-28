import React, { useState } from 'react';
import { Moon, Sun, Download, Upload, UserPlus, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useTags } from '@/hooks/useTags';
import { useAuth } from '@/hooks/useAuth';
import { exportToPDF } from '@/utils/pdfExport';
import { toCsvRow } from '@/utils/csv';
import { buildExportData, parseImportFile, MonotaskExport } from '@/utils/dataPortability';
import UpgradeAccountModal from './UpgradeAccountModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Settings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { tasks, createTaskAsync, isLoading: tasksLoading } = useTasks();
  const { habits, logs, createHabitAsync, isLoading: habitsLoading } = useHabits();
  const { tags, createTagAsync, isLoading: tagsLoading } = useTags();
  const { user, isAnonymous, signOut } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // Export/import must never run against tasks/habits/tags that haven't
  // finished loading yet - that silently produces an empty export or,
  // during import, treats every one of the account's own default tags as
  // "new" and drops the tag off any imported task/habit that used one.
  const dataReady = !tasksLoading && !habitsLoading && !tagsLoading;

  const handleToggleDarkMode = () => {
    const newTheme = settings?.theme === 'dark' ? 'light' : 'dark';
    updateSetting('theme', newTheme);
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(tasks, habits, logs);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const handleExportCSV = () => {
    const lines: string[] = [];

    lines.push('TASKS');
    lines.push(toCsvRow(['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Due Time', 'Created At']));
    tasks.forEach(task => {
      lines.push(toCsvRow([
        task.title,
        task.description || '',
        task.status || '',
        task.priority || '',
        task.due_date || '',
        task.due_time || '',
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

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monotask-data.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = buildExportData(tasks, habits, tags);
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
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your Monotask experience</p>
      </div>

      {/* Guest Account Alert */}
      {isAnonymous && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <UserPlus className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-amber-800 dark:text-amber-200">
              You're using a guest account. Create a full account to save your data permanently.
            </span>
            <Button 
              size="sm" 
              onClick={() => setShowUpgradeModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white w-fit"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Account Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">
                {isAnonymous ? 'Guest Account' : 'Email'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAnonymous ? 'No email linked' : user?.email}
              </p>
            </div>
            {isAnonymous && (
              <Button 
                variant="outline" 
                onClick={() => setShowUpgradeModal(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Upgrade
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <h3 className="font-medium text-foreground">Sign Out</h3>
              <p className="text-sm text-muted-foreground">
                {isAnonymous ? 'Warning: Guest data will be lost' : 'Sign out of your account'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={signOut}
              className="text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Appearance</h2>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Dark Mode</h3>
            <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
          </div>
          <button
            onClick={handleToggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              settings?.theme === 'dark' ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                settings?.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`}
            >
              {settings?.theme === 'dark' ? (
                <Moon className="h-3 w-3 m-0.5 text-foreground" />
              ) : (
                <Sun className="h-3 w-3 m-0.5 text-foreground" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Data Management</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground mb-2">Export Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Download your tasks and habits data</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleExportPDF}
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
              <Button
                onClick={handleExportJSON}
                variant="outline"
                disabled={!dataReady}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as JSON
              </Button>
            </div>
          </div>

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
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import Data'}
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Only accepts JSON files exported from Monotask above. Habit completion history isn't included.
            </p>
          </div>
        </div>
      </div>

      {/* App Information */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">About</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">App:</strong> Monotask</p>
          <p><strong className="text-foreground">Version:</strong> 1.0.0</p>
          <p><strong className="text-foreground">Description:</strong> Minimal productivity app for managing tasks and habits</p>
        </div>
      </div>

      {/* Upgrade Account Modal */}
      <UpgradeAccountModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal} 
      />
    </div>
  );
};

export default Settings;
