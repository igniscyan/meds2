import { Record } from 'pocketbase';
import { ChiefComplaint } from './queue';

export interface Encounter extends Record {
  chief_complaint?: ChiefComplaint;
  other_chief_complaint?: string;
  disbursements?: Array<{
    medication: {
      drug_name: string;
    };
    quantity: number;
  }>;
  expand?: {
    chief_complaint?: ChiefComplaint;
  };
  created: string;
  updated: string;
} 