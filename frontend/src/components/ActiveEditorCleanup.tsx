import { useEffect, useRef } from 'react';
import { pb } from '../atoms/auth';

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export const ActiveEditorCleanup: React.FC = () => {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cleanupStaleEditors = async () => {
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        // Create a new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        // Find encounters with stale editors
        const tenMinutesAgo = new Date(Date.now() - STALE_THRESHOLD);
        const records = await pb.collection('encounters').getList(1, 50, {
          filter: `last_edit_activity < "${tenMinutesAgo.toISOString()}" && active_editor != null`,
          $autoCancel: false, // Disable auto-cancellation
          signal: abortControllerRef.current.signal // Use the abort controller signal
        });

        // Clean up each stale editor
        for (const record of records.items) {
          await pb.collection('encounters').update(record.id, {
            active_editor: null,
            last_edit_activity: null
          }, {
            $autoCancel: false // Disable auto-cancellation
          });
          console.log('Cleaned up stale editor for encounter:', record.id);
        }
      } catch (error: any) {
        // Check if this is an auto-cancellation error
        const isAutoCancelError = 
          error?.isAbort || 
          error?.name === 'AbortError' || 
          (error?.message && (
            error.message.includes('autocancelled') || 
            error.message.includes('aborted') || 
            error.message.includes('abort') || 
            error.message.includes('cancel')
          ));
        
        if (!isAutoCancelError) {
          console.error('Error cleaning up stale editors:', error);
        } else {
          console.log('Editor cleanup request was cancelled - this is normal during navigation');
        }
      }
    };

    // Run cleanup immediately and then every 5 minutes
    cleanupStaleEditors();
    const interval = setInterval(cleanupStaleEditors, CLEANUP_INTERVAL);

    return () => {
      clearInterval(interval);
      // Abort any pending requests when the component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return null;
}; 