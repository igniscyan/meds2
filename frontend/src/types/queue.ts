import { Record } from 'pocketbase';

export type QueueStatus = 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'at_checkout' | 'completed';

export interface QueueItem extends Record {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
  patient: string;
  status: QueueStatus;
  assigned_to?: string;
  intended_provider?: string | null;
  check_in_time: string;
  start_time?: string;
  end_time?: string;
  priority: number;
  line_number: number;
  expand?: {
    patient: {
      first_name: string;
      last_name: string;
    };
    assigned_to?: {
      id: string;
      username: string;
      name: string;
    };
    encounter?: {
      id: string;
    };
  };
}