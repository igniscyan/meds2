import { useState, useEffect, useRef } from 'react';
import { Record, UnsubscribeFunc } from 'pocketbase';
import { pb, trackSubscription, untrackSubscription } from '../atoms/auth';

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

// Subscription key for tracking
const SETTINGS_SUBSCRIPTION_KEY = 'settings_subscription';

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const unsubscribeRef = useRef<UnsubscribeFunc | null>(null);

  const loadSettings = async () => {
    if (!pb.authStore.isValid) {
      console.log('[useSettings] No valid auth, skipping settings load');
      setLoading(false);
      return;
    }
    
    try {
      console.log('[useSettings] Loading settings...');
      const resultList = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: 'created',
        $autoCancel: false
      });
      
      if (resultList.items.length > 0) {
        const newSettings = resultList.items[0];
        console.log('[useSettings] Settings loaded:', newSettings);
        setSettings(newSettings);
        settingsRef.current = newSettings;
      }
      setError(null);
    } catch (err) {
      console.error('[useSettings] Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const cleanupSubscription = () => {
    if (unsubscribeRef.current) {
      try {
        console.log('[useSettings] Cleaning up settings subscription');
        unsubscribeRef.current();
        untrackSubscription(SETTINGS_SUBSCRIPTION_KEY);
      } catch (err) {
        console.error('[useSettings] Error cleaning up subscription:', err);
      }
      unsubscribeRef.current = null;
    }
  };

  const subscribeToSettings = async () => {
    // Clean up any existing subscription first
    cleanupSubscription();
    
    if (!pb.authStore.isValid) {
      console.log('[useSettings] No valid auth, skipping subscription');
      return null;
    }
    
    try {
      setSubscriptionError(null);
      console.log('[useSettings] Subscribing to settings...');
      
      // Track this subscription
      trackSubscription(SETTINGS_SUBSCRIPTION_KEY);
      
      // Subscribe to the settings collection
      unsubscribeRef.current = await pb.collection('settings').subscribe('*', (e) => {
        if (e.action === 'update' || e.action === 'create') {
          setSyncing(true);
          try {
            console.log('[useSettings] Settings update received:', e.record);
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
      return unsubscribeRef.current;
    } catch (err) {
      console.error('[useSettings] Error subscribing to settings:', err);
      setSubscriptionError('Failed to connect to real-time updates');
      untrackSubscription(SETTINGS_SUBSCRIPTION_KEY);
      return null;
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const action = customEvent.detail?.action;
      
      console.log('[useSettings] Auth state changed:', action);
      
      if (action === 'login' && pb.authStore.isValid) {
        // Load settings and subscribe on login
        loadSettings();
        subscribeToSettings();
      } else if (action === 'logout') {
        // Clean up subscription on logout
        cleanupSubscription();
        // Clear settings
        setSettings(null);
        settingsRef.current = null;
      }
    };
    
    // Add a listener for pre-logout events
    const handlePreLogout = () => {
      console.log('[useSettings] Pre-logout event received, cleaning up subscription');
      
      // Clean up subscription before auth token is cleared
      cleanupSubscription();
      
      // Clear settings
      setSettings(null);
      settingsRef.current = null;
    };
    
    window.addEventListener('pocketbase-auth-change', handleAuthChange);
    window.addEventListener('pocketbase-pre-logout', handlePreLogout);
    
    return () => {
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
      window.removeEventListener('pocketbase-pre-logout', handlePreLogout);
    };
  }, []);

  // Initialize settings and subscription
  useEffect(() => {
    loadSettings();
    subscribeToSettings();

    // Cleanup subscription when component unmounts
    return () => {
      cleanupSubscription();
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