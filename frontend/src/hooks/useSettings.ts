import { useState, useEffect } from 'react';
import settingsService, { 
  Settings, 
  UnitDisplay, 
  DisplayPreferences 
} from '../services/settingsService';

interface UseSettingsReturn {
  settings: Settings | null;
  loading: boolean;
  error: Error | null;
  refreshSettings: () => void;
  unitDisplay: UnitDisplay;
  displayPreferences: DisplayPreferences;
}

/**
 * Hook to access application settings
 * 
 * This hook:
 * 1. Returns the current settings from the settings service
 * 2. Subscribes to changes and updates the component
 * 3. Provides a way to refresh settings
 */
export const useSettings = (): UseSettingsReturn => {
  // Get initial settings state
  const initialState = settingsService.getSettings();
  
  // Set up state
  const [settings, setSettings] = useState<Settings | null>(initialState.settings);
  const [loading, setLoading] = useState<boolean>(initialState.loading);
  const [error, setError] = useState<Error | null>(initialState.error);
  const [unitDisplay, setUnitDisplay] = useState<UnitDisplay>(initialState.unitDisplay);
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(initialState.displayPreferences);

  // Subscribe to settings changes
  useEffect(() => {
    // Make sure the service is initialized
    settingsService.initialize().catch(console.error);
    
    // Subscribe to settings changes
    const unsubscribe = settingsService.subscribe((newSettings) => {
      // Get the latest state
      const currentState = settingsService.getSettings();
      
      // Update our state
      setSettings(currentState.settings);
      setLoading(currentState.loading);
      setError(currentState.error);
      setUnitDisplay(currentState.unitDisplay);
      setDisplayPreferences(currentState.displayPreferences);
    });
    
    // Clean up subscription on unmount
    return unsubscribe;
  }, []);

  // Return the settings and a refresh function
  return {
    settings,
    loading,
    error,
    refreshSettings: settingsService.refreshSettings.bind(settingsService),
    unitDisplay,
    displayPreferences
  };
};

export default useSettings; 