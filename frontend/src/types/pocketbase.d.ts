import PocketBase from 'pocketbase';

declare module 'pocketbase' {
  interface Collection {
    getFirstListItem: (
      filter: string,
      options?: {
        expand?: string;
        fields?: string;
        $autoCancel?: boolean;
      }
    ) => Promise<Record>;
  }
} 