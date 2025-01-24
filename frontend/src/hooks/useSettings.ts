import { useState, useEffect } from 'react';
import { Record, UnsubscribeFunc } from 'pocketbase';
import { pb } from '../atoms/auth';

interface UnitDisplay {
  height: string;
  weight: string;
  temperature: string;
}

interface DisplayPreferences {
  show_priority_dropdown: boolean;
  show_care_team_assignment: boolean;
  care_team_count: number;
}

interface Settings extends Record {
  unit_display: UnitDisplay;
  display_preferences: DisplayPreferences;
  updated_by: string;
}

interface UseSettingsReturn {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
  unitDisplay: UnitDisplay;
  displayPreferences: DisplayPreferences;
  syncing: boolean;
  subscriptionError: string | null;
  reconnect: () => Promise<void>;
}

const defaultUnitDisplay: UnitDisplay = {
  height: 'cm',
  weight: 'kg',
  temperature: 'F',
};

const defaultDisplayPreferences: DisplayPreferences = {
  show_priority_dropdown: false,
  show_care_team_assignment: false,
  care_team_count: 6
};

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const resultList = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: '-created',
      });
      if (resultList.items.length > 0) {
        setSettings(resultList.items[0]);
      } else {
        // If no settings exist, create default settings
        try {
          const adminUser = pb.authStore.model;
          if (adminUser) {
            const defaultSettings = await pb.collection('settings').create({
              unit_display: defaultUnitDisplay,
              display_preferences: defaultDisplayPreferences,
              updated_by: adminUser.id,
              last_updated: new Date().toISOString(),
            });
            setSettings(defaultSettings as Settings);
          }
        } catch (createError) {
          console.error('Error creating default settings:', createError);
          // Even if creation fails, we'll use default values
        }
      }
      setError(null);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToSettings = async () => {
    let unsubscribe: UnsubscribeFunc | null = null;
    try {
      setSubscriptionError(null);
      // Subscribe to the settings collection
      unsubscribe = await pb.collection('settings').subscribe('*', (e) => {
        if (e.action === 'update' || e.action === 'create') {
          setSyncing(true);
          try {
            // Update our local state when settings change
            const updatedSettings = e.record as Settings;
            if (updatedSettings.unit_display && updatedSettings.display_preferences) {
              setSettings(updatedSettings);
            }
          } finally {
            setSyncing(false);
          }
        }
      });
      return unsubscribe;
    } catch (err) {
      console.error('Error subscribing to settings:', err);
      setSubscriptionError('Failed to connect to real-time updates. Some changes may be delayed.');
      return null;
    }
  };

  useEffect(() => {
    loadSettings();
    let unsubscribe: UnsubscribeFunc | null = null;

    const initializeSubscription = async () => {
      unsubscribe = await subscribeToSettings();
    };

    initializeSubscription();

    // Cleanup subscription when component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const reconnect = async () => {
    if (subscriptionError) {
      const newUnsubscribe = await subscribeToSettings();
      if (newUnsubscribe) {
        setSubscriptionError(null);
      }
    }
  };

  return {
    settings,
    loading,
    error,
    refreshSettings: loadSettings,
    unitDisplay: settings?.unit_display || defaultUnitDisplay,
    displayPreferences: settings?.display_preferences || defaultDisplayPreferences,
    syncing,
    subscriptionError,
    reconnect
  };
};

export default useSettings; 