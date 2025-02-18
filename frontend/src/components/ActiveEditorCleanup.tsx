import { useEffect } from 'react';
import { pb } from '../atoms/auth';

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export const ActiveEditorCleanup: React.FC = () => {
  useEffect(() => {
    const cleanupStaleEditors = async () => {
      try {
        // Find encounters with stale editors
        const tenMinutesAgo = new Date(Date.now() - STALE_THRESHOLD);
        const records = await pb.collection('encounters').getList(1, 50, {
          filter: `last_edit_activity < "${tenMinutesAgo.toISOString()}" && active_editor != null`,
        });

        // Clean up each stale editor
        for (const record of records.items) {
          await pb.collection('encounters').update(record.id, {
            active_editor: null,
            last_edit_activity: null
          });
          console.log('Cleaned up stale editor for encounter:', record.id);
        }
      } catch (error) {
        console.error('Error cleaning up stale editors:', error);
      }
    };

    // Run cleanup immediately and then every 5 minutes
    cleanupStaleEditors();
    const interval = setInterval(cleanupStaleEditors, CLEANUP_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return null;
}; 