import { pb } from '../atoms/auth';
import type { Record, UnsubscribeFunc } from 'pocketbase';

// Define the types for our settings
export interface UnitDisplay {
  height: string;
  weight: string;
  temperature: string;
}

export interface DisplayPreferences {
  show_priority_dropdown: boolean;
  show_care_team_assignment: boolean;
  care_team_count: number;
  show_gyn_team: boolean;
  show_optometry_team: boolean;
  unified_roles: boolean;
  override_field_restrictions: boolean;
  override_field_restrictions_all_roles: boolean;
}

export interface Settings extends Record {
  unit_display: UnitDisplay;
  display_preferences: DisplayPreferences;
  updated_by: string;
}

// Default values
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

// Type for subscribers
type SettingsSubscriber = (settings: Settings | null) => void;

/**
 * Settings Service - A singleton service for managing application settings
 * 
 * This service:
 * 1. Fetches settings once and caches them
 * 2. Provides methods to get settings and subscribe to changes
 * 3. Uses a simple pub/sub pattern for notifications
 */
class SettingsService {
  private settings: Settings | null = null;
  private loading: boolean = false;
  private error: Error | null = null;
  private subscribers: Set<SettingsSubscriber> = new Set();
  private initialized: boolean = false;
  private realtimeUnsubscribe: UnsubscribeFunc | null = null;

  /**
   * Initialize the settings service
   * This should be called once at app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.loading = true;
      this.notifySubscribers();
      
      // Fetch settings from PocketBase
      const result = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: 'created',
        $autoCancel: false
      });
      
      // Store settings
      this.settings = result.items.length > 0 ? result.items[0] : null;
      this.loading = false;
      this.error = null;
      this.initialized = true;
      
      // Subscribe to realtime updates
      this.subscribeToRealtimeUpdates();
      
      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      this.loading = false;
      this.error = error instanceof Error ? error : new Error(String(error));
      this.initialized = true; // Mark as initialized even on error to prevent endless retries
      this.notifySubscribers();
      console.error('Error initializing settings:', error);
    }
  }

  /**
   * Subscribe to realtime updates from PocketBase
   */
  private subscribeToRealtimeUpdates(): void {
    // Clean up any existing subscription
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    
    // Subscribe to settings collection
    try {
      // The subscribe method returns an unsubscribe function directly
      const unsubscribe = pb.collection('settings').subscribe('*', async (data) => {
        console.log('[SettingsService] Received realtime update:', data.action);
        
        // Fetch the latest settings
        try {
          const result = await pb.collection('settings').getList<Settings>(1, 1, {
            sort: 'created',
            $autoCancel: false
          });
          
          this.settings = result.items.length > 0 ? result.items[0] : null;
          this.notifySubscribers();
        } catch (error) {
          console.error('[SettingsService] Error fetching updated settings:', error);
        }
      });
      
      // Store the unsubscribe function
      this.realtimeUnsubscribe = unsubscribe;
    } catch (error) {
      console.error('[SettingsService] Error subscribing to settings:', error);
    }
  }

  /**
   * Get the current settings
   */
  getSettings(): {
    settings: Settings | null;
    loading: boolean;
    error: Error | null;
    unitDisplay: UnitDisplay;
    displayPreferences: DisplayPreferences;
  } {
    return {
      settings: this.settings,
      loading: this.loading,
      error: this.error,
      unitDisplay: this.settings?.unit_display || defaultUnitDisplay,
      displayPreferences: this.settings?.display_preferences || defaultDisplayPreferences
    };
  }

  /**
   * Subscribe to settings changes
   * @param subscriber Function to call when settings change
   * @returns Unsubscribe function
   */
  subscribe(subscriber: SettingsSubscriber): () => void {
    this.subscribers.add(subscriber);
    
    // Call the subscriber immediately with current settings
    subscriber(this.settings);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Notify all subscribers of settings changes
   */
  private notifySubscribers(): void {
    // Convert Set to Array before iterating to avoid downlevelIteration issues
    Array.from(this.subscribers).forEach(subscriber => {
      subscriber(this.settings);
    });
  }

  /**
   * Refresh settings from the server
   */
  async refreshSettings(): Promise<void> {
    try {
      const result = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: 'created',
        $autoCancel: false
      });
      
      this.settings = result.items.length > 0 ? result.items[0] : null;
      this.notifySubscribers();
    } catch (error) {
      console.error('Error refreshing settings:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    
    this.subscribers.clear();
  }
}

// Create a singleton instance
export const settingsService = new SettingsService();

// Export default for convenience
export default settingsService; 