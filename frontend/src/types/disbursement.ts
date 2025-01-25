import { Record } from 'pocketbase';

export interface Disbursement extends Record {
  encounter: string;
  medication: string;
  quantity: number;
  notes?: string;
  expand?: {
    encounter: {
      id: string;
    };
    medication: {
      id: string;
      drug_name: string;
    };
  };
} 