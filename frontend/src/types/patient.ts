import { Record } from 'pocketbase';

export interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
  allergies?: string;
  pregnancy_status?: string;
} 