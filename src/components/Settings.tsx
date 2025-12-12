import React, { useState } from 'react';
import { Moon, Sun, Download, Upload, UserPlus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useAuth } from '@/hooks/useAuth';
import { exportToPDF } from '@/utils/pdfExport';
import UpgradeAccountModal from './UpgradeAccountModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Settings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { tasks } = useTasks();
  const { habits, logs } = useHabits();
  const { user, isAnonymous, signOut } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleToggleDarkMode = () => {
    const newTheme = settings?.theme === 'dark' ? 'light' : 'dark';
    updateSetting('theme', newTheme);
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(tasks, habits, logs);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleExportCSV = () => {
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Tasks CSV
    csvContent += "TASKS\n";
    csvContent += "Title,Description,Status,Priority,Due Date,Due Time,Created At\n";
    
    tasks.forEach(task => {
      const row = [
        task.title,
        task.description || '',
        task.status || '',
        task.priority || '',
        task.due_date || '',
        task.due_time || '',
        task.created_at
      ].map(field => `"${field}"`).join(',');
      csvContent += row + "\n";
    });

    csvContent += "\nHABITS\n";
    csvContent += "Name,Description,Frequency,Preferred Time,Created At\n";
    
    habits.forEach(habit => {
      const row = [
        habit.name,
        habit.description || '',
        habit.frequency,
        habit.preferred_time || '',
        habit.created_at
      ].map(field => `"${field}"`).join(',');
      csvContent += row + "\n";
    });

    csvContent += "\nHABIT LOGS\n";
    csvContent += "Habit ID,Date,Status,Notes\n";
    
    logs.forEach(log => {
      const row = [
        log.habit_id,
        log.date,
        log.status,
        log.notes || ''
      ].map(field => `"${field}"`).join(',');
      csvContent += row + "\n";
    });

    // Download CSV
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "monotask-data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Here you would implement the import logic
        console.log('Import data:', data);
        alert('Import functionality will be implemented in a future update.');
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please ensure the file is valid JSON.');
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
              >
                <Download className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>
              <Button 
                onClick={handleExportCSV}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-2">Import Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload your data from a backup file</p>
            <div className="flex items-center">
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleImportData}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button 
                  variant="outline"
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supports JSON and CSV formats
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
