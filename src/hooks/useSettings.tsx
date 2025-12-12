
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserSettings {
  timeFormat: '12h' | '24h';
  timezone: string;
  theme: 'light' | 'dark';
  font: 'Inter' | 'Space Grotesk' | 'DM Sans';
  notifications: boolean;
  autoBackup: boolean;
}

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: (key: keyof UserSettings, value: any) => Promise<void>;
  isLoading: boolean;
  formatTime: (time: string) => string;
}

const defaultSettings: UserSettings = {
  timeFormat: '24h',
  timezone: 'UTC-8',
  theme: 'light',
  font: 'Inter',
  notifications: true,
  autoBackup: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from Supabase
  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  // Apply theme changes to document root
  useEffect(() => {
    applyTheme(settings.theme);
    applyFont(settings.font);
  }, [settings.theme, settings.font]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user?.id)
        .single();

      if (data?.settings && typeof data.settings === 'object') {
        setSettings({ ...defaultSettings, ...data.settings });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ settings: newSettings })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating settings:', error);
        // Revert on error
        setSettings(settings);
      }
    }
  };

  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const applyFont = (font: string) => {
    const root = document.documentElement;
    root.style.fontFamily = font === 'Inter' ? 'Inter, system-ui, sans-serif' :
                           font === 'Space Grotesk' ? 'Space Grotesk, system-ui, sans-serif' :
                           'DM Sans, system-ui, sans-serif';
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours, 10);
    
    if (settings.timeFormat === '12h') {
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    }
    
    return `${hours}:${minutes}`;
  };

  const value = {
    settings,
    updateSetting,
    isLoading,
    formatTime,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
