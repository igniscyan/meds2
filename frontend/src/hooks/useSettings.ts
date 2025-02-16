import { useState, useEffect, useRef } from 'react';
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
  show_gyn_team: boolean;
  show_optometry_team: boolean;
  unified_roles: boolean;
  override_field_restrictions: boolean;
  override_field_restrictions_all_roles: boolean;
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
  care_team_count: 6,
  show_gyn_team: false,
  show_optometry_team: false,
  unified_roles: false,
  override_field_restrictions: false,
  override_field_restrictions_all_roles: false
};

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const settingsRef = useRef<Settings | null>(null);

  const loadSettings = async () => {
    try {
      console.log('Loading settings...');
      const resultList = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: 'created',
        $autoCancel: false
      });
      
      if (resultList.items.length > 0) {
        const newSettings = resultList.items[0];
        console.log('Settings loaded:', newSettings);
        setSettings(newSettings);
        settingsRef.current = newSettings;
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
      console.log('Subscribing to settings...');
      
      // Subscribe to the settings collection
      unsubscribe = await pb.collection('settings').subscribe('*', (e) => {
        if (e.action === 'update' || e.action === 'create') {
          setSyncing(true);
          try {
            console.log('Settings update received:', e.record);
            // Update our local state when settings change
            const updatedSettings = e.record as Settings;
            if (updatedSettings.unit_display && updatedSettings.display_preferences) {
              setSettings(updatedSettings);
              settingsRef.current = updatedSettings;
            }
          } finally {
            setSyncing(false);
          }
        }
      });
      return unsubscribe;
    } catch (err) {
      console.error('Error subscribing to settings:', err);
      setSubscriptionError('Failed to connect to real-time updates');
      return null;
    }
  };

  // Initialize settings and subscription
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

  // Add a force refresh function
  const refreshSettings = async () => {
    await loadSettings();
  };

  const reconnect = async () => {
    if (subscriptionError) {
      const newUnsubscribe = await subscribeToSettings();
      if (newUnsubscribe) {
        setSubscriptionError(null);
      }
    }
  };

  return {
    settings: settingsRef.current || settings,
    loading,
    error,
    refreshSettings,
    unitDisplay: settingsRef.current?.unit_display || settings?.unit_display || defaultUnitDisplay,
    displayPreferences: settingsRef.current?.display_preferences || settings?.display_preferences || defaultDisplayPreferences,
    syncing,
    subscriptionError,
    reconnect
  };
};

export default useSettings; 