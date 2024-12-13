import { atom } from 'jotai';
import type { Record, RealtimeEvent } from 'pocketbase';
import { pb } from './auth';

// Generic function to create a collection atom
const createCollectionAtom = <T extends Record>(collectionName: string) => {
  const recordsAtom = atom<T[]>([]);
  const loadingAtom = atom(true);
  const errorAtom = atom<Error | null>(null);

  // Action to fetch and subscribe to collection
  const subscribeAction = atom(null, async (get, set) => {
    try {
      // Initial fetch
      const resultList = await pb.collection(collectionName).getList(1, 50);
      set(recordsAtom, resultList.items as T[]);
      set(loadingAtom, false);

      // Subscribe to realtime updates
      pb.collection(collectionName).subscribe('*', ({ action, record }: RealtimeEvent) => {
        const currentRecords = get(recordsAtom);
        
        switch (action) {
          case 'create':
            set(recordsAtom, [...currentRecords, record as T]);
            break;
          case 'update':
            set(recordsAtom, currentRecords.map(item => 
              item.id === record.id ? record as T : item
            ));
            break;
          case 'delete':
            set(recordsAtom, currentRecords.filter(item => item.id !== record.id));
            break;
        }
      });
    } catch (error) {
      set(errorAtom, error instanceof Error ? error : new Error('Unknown error'));
      set(loadingAtom, false);
    }
  });

  return {
    recordsAtom,
    loadingAtom,
    errorAtom,
    subscribeAction,
  };
};

// Create atoms for each collection
export const patientsAtoms = createCollectionAtom('patients');
export const encountersAtoms = createCollectionAtom('encounters');
export const inventoryAtoms = createCollectionAtom('inventory');
export const disbursementsAtoms = createCollectionAtom('disbursements');
