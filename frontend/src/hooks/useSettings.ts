import { useState, useEffect, useMemo } from 'react';
import { Record } from 'pocketbase';
import { useRealtimeCollection } from './useRealtimeCollection';
import { getCollectionData } from '../atoms/realtimeAtoms';
import { atom } from 'jotai/vanilla';
import { useAtom } from 'jotai/react';

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
  error: Error | null;
  refreshSettings: () => void;
  unitDisplay: UnitDisplay;
  displayPreferences: DisplayPreferences;
  syncing: boolean;
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

// Create a global atom for settings to share across the app
const settingsAtom = atom<UseSettingsReturn>({
  settings: null,
  loading: true,
  error: null,
  refreshSettings: () => {},
  unitDisplay: defaultUnitDisplay,
  displayPreferences: defaultDisplayPreferences,
  syncing: false
});

// Flag to track if we've initialized the settings
let settingsInitialized = false;

// Function to initialize settings without a hook
export const initializeSettings = async (): Promise<void> => {
  if (settingsInitialized) return;
  
  try {
    const records = await getCollectionData<Settings>('settings', {
      sort: 'created',
      limit: 1
    });
    
    const settings = records.length > 0 ? records[0] : null;
    const unitDisplay = settings?.unit_display || defaultUnitDisplay;
    const displayPreferences = settings?.display_preferences || defaultDisplayPreferences;
    
    // Update the global atom
    settingsAtom.onMount = (setAtom) => {
      setAtom({
        settings,
        loading: false,
        error: null,
        refreshSettings: async () => {
          try {
            const freshRecords = await getCollectionData<Settings>('settings', {
              sort: 'created',
              limit: 1
            });
            const freshSettings = freshRecords.length > 0 ? freshRecords[0] : null;
            setAtom(prev => ({
              ...prev,
              settings: freshSettings,
              unitDisplay: freshSettings?.unit_display || defaultUnitDisplay,
              displayPreferences: freshSettings?.display_preferences || defaultDisplayPreferences,
              loading: false,
              error: null
            }));
          } catch (error) {
            console.error('Error refreshing settings:', error);
          }
        },
        unitDisplay,
        displayPreferences,
        syncing: false
      });
    };
    
    settingsInitialized = true;
  } catch (error) {
    console.error('Error initializing settings:', error);
    // We'll still mark as initialized to prevent endless retries
    settingsInitialized = true;
  }
};

// Call initialize on module load
initializeSettings().catch(console.error);

// Hook to access settings - now uses the global atom
export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useAtom(settingsAtom);
  
  // Subscribe to realtime updates only in components that need live updates
  const options = useMemo(() => ({
    sort: 'created',
    limit: 1,
    $autoCancel: false
  }), []);
  
  const { 
    records, 
    loading, 
    error, 
    refresh: refreshRealtime 
  } = useRealtimeCollection<Settings>('settings', options);
  
  // Update the atom when realtime data changes
  useEffect(() => {
    if (records.length > 0) {
      const newSettings = records[0];
      setSettings(prev => ({
        ...prev,
        settings: newSettings,
        loading,
        error,
        unitDisplay: newSettings?.unit_display || defaultUnitDisplay,
        displayPreferences: newSettings?.display_preferences || defaultDisplayPreferences
      }));
    }
  }, [records, loading, error, setSettings]);
  
  // Create a refresh function that updates both realtime and the atom
  const refreshSettings = () => {
    refreshRealtime();
    settings.refreshSettings();
  };
  
  // Return the combined state
  return {
    ...settings,
    refreshSettings
  };
};

// Export a function to get the settings without subscribing
export const getCachedSettings = (): UseSettingsReturn => {
  // Access the atom value directly
  return settingsAtom.init;
};

export default useSettings; 