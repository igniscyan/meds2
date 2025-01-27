import { Record } from 'pocketbase';

export interface ChiefComplaint extends Record {
  name: string;
}

export interface Encounter extends Record {
  chief_complaint?: ChiefComplaint;
  disbursements?: Array<{
    medication: {
      drug_name: string;
    };
    quantity: number;
  }>;
}

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
      gender: string;
      age: number;
    };
    assigned_to?: {
      id: string;
      username: string;
      name: string;
    };
    encounter?: Encounter;
  };
}