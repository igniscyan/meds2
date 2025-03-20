import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Chip,
  IconButton,
  Divider,
  Card,
  CardContent,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { pb } from '../atoms/auth';
import { useRealtimeCollection } from '../hooks/useRealtimeCollection';
import { Record } from 'pocketbase';
import RefreshIcon from '@mui/icons-material/Refresh';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { QueueStatus, QueueItem } from '../types/queue';
import { useSettings } from '../hooks/useSettings';

// Base type for PocketBase list responses
interface BaseListResult {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Record[];
}

interface QueueTimeItem extends Record {
  check_in_time: string;
  end_time?: string;
}

interface QueueAnalytics extends Record {
  patients_count: number;
  average_wait_time: number;
  date: string;
}

// Add Provider interface
interface Provider extends Record {
  username: string;
  email: string;
  role: 'provider' | 'pharmacy' | 'admin';
  name: string;
}

interface AnalyticsSummary {
  patientsToday: number;
  averageWaitTime: number;
}

interface QueueSection {
  title: string;
  status: QueueStatus;
  items: QueueItem[];
  description: string;
  showAssignmentGroups: boolean;
  renderItems: (items: QueueItem[]) => React.ReactNode;
}

// Add Patient interface
interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
  height?: number | null;
  weight?: number | null;
  temperature?: number | null;
  heart_rate?: number | null;
  systolic_pressure?: number | null;
  diastolic_pressure?: number | null;
}

interface DisplayPreferences {
  show_priority_dropdown: boolean;
  show_care_team_assignment: boolean;
  care_team_count: number;
  show_gyn_team: boolean;
  show_optometry_team: boolean;
  show_move_to_checkout: boolean;
}

// Add helper function to format age display
const formatAgeDisplay = (ageInYears: number): string => {
  if (ageInYears >= 1) {
    return `${Math.floor(ageInYears)}y`;
  } else {
    const months = Math.floor(ageInYears * 12);
    if (months >= 1) {
      return `${months}m`;
    } else {
      const weeks = Math.floor(ageInYears * 52);
      return `${weeks}w`;
    }
  }
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    patientsToday: 0,
    averageWaitTime: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const { displayPreferences, loading: settingsLoading } = useSettings();
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const analyticsRequestRef = useRef<AbortController | null>(null);

  // Subscribe to queue changes with expanded fields
  const { records: queueItems, loading: queueLoading } = useRealtimeCollection<QueueItem>('queue', {
    sort: '-priority,check_in_time',
    expand: 'patient,assigned_to,intended_provider,encounter',
    filter: 'status != "completed"'
  });

  // Debug logging for display preferences
  useEffect(() => {
    console.log('Display Preferences:', displayPreferences);
  }, [displayPreferences]);

  // Debug logging for queue items
  useEffect(() => {
    console.log('Queue items received:', queueItems);
    console.log('Queue items expanded data:', queueItems.map(item => item.expand));
  }, [queueItems]);

  // Debug logging for auth store
  useEffect(() => {
    console.log('Auth Store Debug:', {
      model: pb.authStore.model,
      isValid: pb.authStore.isValid,
      userRole: (pb.authStore.model as any)?.role
    });
  }, []);

  // Update analytics when queue items change
  useEffect(() => {
    if (!queueLoading) {
      // Cancel any previous request
      if (analyticsRequestRef.current) {
        analyticsRequestRef.current.abort();
      }
      
      // Create a new abort controller for this request
      analyticsRequestRef.current = new AbortController();
      
      // Debounce the analytics fetch to prevent multiple calls
      const timer = setTimeout(() => {
        fetchAnalytics();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        if (analyticsRequestRef.current) {
          analyticsRequestRef.current.abort();
        }
      };
    }
  }, [queueItems, queueLoading]);

  // Debug logging for display preferences changes
  useEffect(() => {
    console.log('Display preferences changed:', {
      show_care_team_assignment: displayPreferences?.show_care_team_assignment,
      care_team_count: displayPreferences?.care_team_count,
      show_gyn_team: displayPreferences?.show_gyn_team,
      show_optometry_team: displayPreferences?.show_optometry_team
    });
  }, [displayPreferences]);

  // Debug logging for queue items and their care team assignments
  useEffect(() => {
    if (!queueLoading) {
      console.log('Queue items updated:', queueItems.map(item => ({
        id: item.id,
        patient: item.expand?.patient?.first_name,
        intended_provider: item.intended_provider,
        status: item.status
      })));
    }
  }, [queueItems, queueLoading]);

  // Show loading state if any critical data is still loading
  if (queueLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Update analytics data
  const fetchAnalytics = async () => {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      console.log('STATS DEBUG: Today date:', today);

      // Get all completed queue items that match today's date
      const queueItems = await pb.collection('queue').getList<QueueItem>(1, 100, {
        filter: `check_in_time ~ "${today}" && status = "completed"`,
        sort: '-created',
        $autoCancel: false, // Disable auto-cancellation to prevent errors
        signal: analyticsRequestRef.current?.signal // Use the abort controller signal
      });

      console.log('STATS DEBUG: Raw queue items:', queueItems.items);
      console.log('STATS DEBUG: Queue items count:', queueItems.items.length);
      console.log('STATS DEBUG: Queue filter used:', `check_in_time ~ "${today}" && status = "completed"`);

      // Count completed patients and calculate wait times
      const completedPatients = queueItems.items.length;

      // Calculate wait times for completed patients
      const waitTimes = queueItems.items
        .map(item => {
          const checkInTime = new Date(item.check_in_time);
          const endTime = new Date(item.end_time || '');
          
          console.log('STATS DEBUG: Processing queue item:', {
            id: item.id,
            checkInTime: item.check_in_time,
            endTime: item.end_time,
            status: item.status
          });
          
          // Skip invalid dates
          if (!checkInTime || !endTime || isNaN(checkInTime.getTime()) || isNaN(endTime.getTime())) {
            console.log('STATS DEBUG: Invalid date found:', { checkInTime, endTime });
            return null;
          }

          const waitTimeMinutes = Math.round((endTime.getTime() - checkInTime.getTime()) / (1000 * 60));
          
          console.log('STATS DEBUG: Wait time calculation:', {
            waitTimeMinutes,
            valid: waitTimeMinutes >= 0
          });

          return waitTimeMinutes >= 0 ? waitTimeMinutes : null;
        })
        .filter((time): time is number => time !== null);

      const averageWait = waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

      console.log('STATS DEBUG: Final calculation:', {
        completedPatients,
        waitTimes,
        averageWait,
        totalWaitTime: waitTimes.reduce((a, b) => a + b, 0),
        numberOfValidTimes: waitTimes.length
      });

      setAnalytics({
        patientsToday: completedPatients,
        averageWaitTime: averageWait
      });
    } catch (error: any) {
      console.error('STATS DEBUG: Error in fetchAnalytics:', error);
      
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
        console.error('STATS DEBUG: Non-cancellation error fetching analytics:', error);
        setError('Failed to load analytics data');
      } else {
        console.log('STATS DEBUG: Request was cancelled - this is normal during navigation');
      }
    }
  };

  const handleReviewDisbursements = async (queueItem: QueueItem) => {
    try {
      // Update status to with_pharmacy
      await pb.collection('queue').update(queueItem.id, {
        status: 'with_pharmacy',
        assigned_to: pb.authStore.model?.id
      });

      // Navigate to encounter in pharmacy mode with scroll to disbursement section
      if (queueItem.expand?.encounter?.id) {
        navigate(`/encounter/${queueItem.patient}/${queueItem.expand.encounter.id}`, {
          state: { 
            mode: 'pharmacy',
            scrollTo: 'disbursement'
          }
        });
      }
    } catch (error) {
      console.error('Error reviewing disbursements:', error);
      alert('Failed to start pharmacy review. Please try again.');
    }
  };

  // Update queueSections to handle team filtering
  const queueSections = [
    {
      status: 'checked_in',
      title: 'Waiting Room',
      description: 'Patients waiting to be seen',
      items: queueItems.filter(item => item.status === 'checked_in' && 
        (!selectedTeamFilter || item.intended_provider === selectedTeamFilter)),
      showAssignmentGroups: displayPreferences.show_care_team_assignment,
      renderItems: (items: QueueItem[]) => {
        if (!displayPreferences.show_care_team_assignment) {
          return sortQueueItems(items).map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider sx={{ my: 1 }} />}
              <QueueItemComponent item={item} />
            </React.Fragment>
          ));
        }

        // Split items into unassigned and assigned groups
        const unassignedItems = items.filter(item => !item.intended_provider);
        const assignedItems = items.filter(item => item.intended_provider);

        return (
          <>
            {unassignedItems.length > 0 && (
              <>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mt: 1,
                    mb: 2,
                    color: 'text.secondary',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  Unassigned ({unassignedItems.length})
                </Typography>
                {sortQueueItems(unassignedItems).map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <Divider sx={{ my: 1 }} />}
                    <QueueItemComponent item={item} />
                  </React.Fragment>
                ))}
              </>
            )}
            
            {assignedItems.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mt: 1,
                    mb: 2,
                    color: 'text.secondary',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  Assigned to Care Team ({assignedItems.length})
                </Typography>
                {sortQueueItems(assignedItems).map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <Divider sx={{ my: 1 }} />}
                    <QueueItemComponent item={item} />
                  </React.Fragment>
                ))}
              </>
            )}
          </>
        );
      }
    },
    {
      status: 'with_care_team',
      title: 'With Care Team',
      description: 'Currently being seen by providers',
      items: queueItems.filter(item => item.status === 'with_care_team' && 
        (!selectedTeamFilter || item.intended_provider === selectedTeamFilter))
    },
    {
      status: 'ready_pharmacy',
      title: 'Ready for Pharmacy',
      description: 'Waiting for medication disbursement',
      items: queueItems.filter(item => item.status === 'ready_pharmacy' && 
        (!selectedTeamFilter || item.intended_provider === selectedTeamFilter))
    },
    {
      status: 'with_pharmacy',
      title: 'With Pharmacy',
      description: 'Medications being disbursed',
      items: queueItems.filter(item => item.status === 'with_pharmacy' && 
        (!selectedTeamFilter || item.intended_provider === selectedTeamFilter))
    },
    {
      status: 'at_checkout',
      title: 'At Checkout',
      description: 'Receiving standard items and completing survey',
      items: queueItems.filter(item => item.status === 'at_checkout' && 
        (!selectedTeamFilter || item.intended_provider === selectedTeamFilter))
    }
  ];

  /**
   * Comprehensive queue management function that handles all queue status changes
   * This consolidates the functionality of:
   * - handleStatusChange
   * - handlePharmacyAction
   * - handleCheckoutAction
   * 
   * @param queueId The ID of the queue item to update
   * @param action The action to perform (status change, start/complete process)
   * @param options Additional options for the action
   */
  const handleQueueAction = async (
    queueId: string,
    action: 'status_change' | 'start_pharmacy' | 'complete_pharmacy' | 'start_checkout' | 'complete_checkout' | 'continue_encounter' | 'start_encounter',
    options?: { newStatus?: QueueStatus; teamNumber?: string | null; scrollTo?: string }
  ) => {
    console.log('handleQueueAction called with:', { queueId, action, options });
    setProcessing(queueId);
    
    try {
      // First get the current queue item to preserve encounter reference
      console.log('Fetching current queue item');
      const currentQueueItem = await pb.collection('queue').getOne<QueueItem>(queueId, {
        expand: 'patient,encounter',
        $autoCancel: false
      });
      console.log('Current queue item:', currentQueueItem);
      
      // Special case for continue_encounter action - just navigate to the encounter
      if (action === 'continue_encounter') {
        const encounterId = currentQueueItem.expand?.encounter?.id;
        if (encounterId) {
          console.log('Continuing encounter, navigating to:', encounterId);
          navigate(`/encounter/${currentQueueItem.patient}/${encounterId}`, {
            state: { 
              mode: 'edit',
              ...(options?.scrollTo ? { scrollTo: options.scrollTo } : {})
            }
          });
          setProcessing(null);
          return;
        } else {
          throw new Error('No encounter found to continue');
        }
      }
      
      // Handle start_encounter action
      if (action === 'start_encounter') {
        console.log('Starting encounter process for patient');
        
        // Get patient details
        const patient = await pb.collection('patients').getOne<Patient>(currentQueueItem.patient, {
          $autoCancel: false
        });
        console.log('Patient details:', patient);
        
        // Get today's date in YYYY-MM-DD format for filtering
        const today = new Date().toISOString().split('T')[0];
        console.log('Checking for encounters from:', today);
        
        // Check for existing encounters from today
        const existingEncounters = await pb.collection('encounters').getList(1, 1, {
          filter: `patient = "${currentQueueItem.patient}" && created ~ "${today}"`,
          sort: '-created',
          $autoCancel: false
        });
        
        let encounterId: string;
        
        if (existingEncounters.items.length > 0) {
          // Use the most recent encounter from today
          const latestEncounter = existingEncounters.items[0];
          console.log('Using existing encounter from today:', latestEncounter);
          encounterId = latestEncounter.id;
        } else {
          // Create new encounter if none exists from today
          console.log('No encounters found today, creating new encounter...');
          const encounter = await pb.collection('encounters').create({
            patient: currentQueueItem.patient,
            created: new Date().toISOString(),
            // Include vitals from patient if they exist
            height: patient.height ?? null,
            weight: patient.weight ?? null,
            temperature: patient.temperature ?? null,
            heart_rate: patient.heart_rate ?? null,
            systolic_pressure: patient.systolic_pressure ?? null,
            diastolic_pressure: patient.diastolic_pressure ?? null,
          }, {
            $autoCancel: false
          });
          console.log('Created new encounter:', encounter);
          encounterId = encounter.id;
        }
        
        // Update queue item status
        await pb.collection('queue').update(queueId, {
          status: 'with_care_team',
          encounter: encounterId,
          assigned_to: pb.authStore.model?.id,
          start_time: new Date().toISOString()
        }, {
          $autoCancel: false
        });
        
        // Navigate to the encounter
        console.log('Navigating to encounter:', encounterId);
        navigate(`/encounter/${currentQueueItem.patient}/${encounterId}`, {
          state: { mode: 'edit' }
        });
        
        setProcessing(null);
        return;
      }
      
      // Handle start_checkout action
      if (action === 'start_checkout') {
        console.log('Moving patient to checkout');
        
        // Check if there's an existing encounter
        const encounterId = currentQueueItem.expand?.encounter?.id;
        if (!encounterId) {
          throw new Error('No encounter found for checkout');
        }
        
        // Update queue item status
        await pb.collection('queue').update(queueId, {
          status: 'at_checkout',
          updated: new Date().toISOString()
        }, {
          $autoCancel: false
        });
        
        setProcessing(null);
        return;
      }
      
      // Determine the new status based on the action
      let newStatus: QueueStatus | undefined;
      let updateData: { [key: string]: any } = {};
      let shouldNavigate = false;
      let navigateMode: 'edit' | 'pharmacy' | 'view' = 'view';
      let scrollTo: string | undefined = options?.scrollTo;
      
      switch (action) {
        case 'status_change':
          newStatus = options?.newStatus;
          break;
        case 'start_pharmacy':
          newStatus = 'with_pharmacy';
          break;
        case 'complete_pharmacy':
          newStatus = 'completed';
          updateData.end_time = new Date().toISOString();
          break;
        case 'complete_checkout':
          newStatus = 'completed';
          updateData.end_time = new Date().toISOString();
          break;
      }
      
      if (!newStatus) {
        throw new Error('No status specified for queue action');
      }
      
      // If changing to with_care_team status, we need to handle encounter creation/assignment
      let encounterId = currentQueueItem.expand?.encounter?.id;
      
      if (newStatus === 'with_care_team') {
        console.log('Starting new encounter for patient');
        
        // Get patient details
        const patient = await pb.collection('patients').getOne<Patient>(currentQueueItem.patient, {
          $autoCancel: false
        });
        console.log('Patient details:', patient);
        
        // Check for existing encounters
        const result = await pb.collection('encounters').getList(1, 1, {
          filter: `patient = "${currentQueueItem.patient}"`,
          sort: '-created',
          $autoCancel: false
        });
        
        if (result.items.length > 0) {
          // Use existing encounter
          const latestEncounter = result.items[0];
          console.log('Using existing encounter:', latestEncounter);
          encounterId = latestEncounter.id;
        } else {
          // Create new encounter
          console.log('Creating new encounter...');
          const encounter = await pb.collection('encounters').create({
            patient: currentQueueItem.patient,
            created: new Date().toISOString(),
            // Include vitals from patient if they exist
            height: patient.height ?? null,
            weight: patient.weight ?? null,
            temperature: patient.temperature ?? null,
            heart_rate: patient.heart_rate ?? null,
            systolic_pressure: patient.systolic_pressure ?? null,
            diastolic_pressure: patient.diastolic_pressure ?? null,
          }, {
            $autoCancel: false
          });
          console.log('Created new encounter:', encounter);
          encounterId = encounter.id;
        }
        
        // Always set navigation for with_care_team
        shouldNavigate = true;
        navigateMode = 'edit';
      }
      
      // Build the update data
      updateData = {
        ...updateData,
        status: newStatus,
        encounter: encounterId,
      };
      
      // Add assigned_to and start_time for certain statuses
      if (newStatus === 'with_care_team' || newStatus === 'with_pharmacy' || newStatus === 'at_checkout') {
        updateData.assigned_to = pb.authStore.model?.id;
        
        // Only set start_time for with_care_team
        if (newStatus === 'with_care_team') {
          updateData.start_time = new Date().toISOString();
        }
      }
      
      // Handle team assignment if specified
      if (options?.teamNumber !== undefined) {
        updateData.intended_provider = options.teamNumber;
        updateData.updated = new Date().toISOString(); // Force an update event
      }
      
      // Update the queue item
      console.log('Updating queue with data:', updateData);
      await pb.collection('queue').update(queueId, updateData, {
        $autoCancel: false
      });
      
      // Navigate if needed - MOVED OUTSIDE OF CONDITIONS to ensure it always happens
      if (shouldNavigate && encounterId) {
        console.log(`Navigating to encounter in ${navigateMode} mode with ID:`, encounterId);
        navigate(`/encounter/${currentQueueItem.patient}/${encounterId}`, {
          state: { 
            mode: navigateMode,
            ...(options?.scrollTo ? { scrollTo: options.scrollTo } : {})
          }
        });
      }
      
      // Clear any errors
      setError(null);
      
      // If this was a team assignment, refresh the queue items to ensure consistency
      if (options?.teamNumber !== undefined) {
        console.log('Refreshing queue items after team assignment');
        await pb.collection('queue').getList<QueueItem>(1, 100, {
          sort: '-priority,check_in_time',
          expand: 'patient,assigned_to,intended_provider,encounter',
          filter: 'status != "completed"',
          $autoCancel: false
        });
      }
    } catch (error: any) {
      // Handle errors
      if (!error.message?.includes('autocancelled')) {
        console.error('Error in handleQueueAction:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(`Failed to perform action: ${errorMessage}`);
        alert('Failed to update queue. Please try again.');
      }
    } finally {
      setProcessing(null);
    }
  };

  const handlePriorityChange = async (queueId: string, newPriority: number) => {
    try {
      await pb.collection('queue').update(queueId, {
        priority: newPriority
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update priority');
    }
  };

  const getWaitTimeColor = (minutes: number): string => {
    if (minutes <= 15) return 'success.main';
    if (minutes <= 30) return '#FFA000'; // dark yellow
    if (minutes <= 40) return 'warning.main';
    return 'error.main';
  };

  const handleTeamAssignment = async (queueId: string, teamNumber: string | null) => {
    console.log('Handling team assignment:', { queueId, teamNumber });
    setProcessing(queueId);
    
    try {
      // Update the queue item with the new team assignment
      await pb.collection('queue').update(queueId, {
        intended_provider: teamNumber,
        updated: new Date().toISOString() // Force an update event
      }, {
        $autoCancel: false
      });
      
      setError(null);
    } catch (error: any) {
      if (!error.message?.includes('autocancelled')) {
        console.error('Error updating team assignment:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(`Failed to update team assignment: ${errorMessage}`);
        alert('Failed to update team assignment. Please try again.');
      }
    } finally {
      setProcessing(null);
    }
  };

  // Convert renderQueueItem to a proper React component
  const QueueItemComponent: React.FC<{ item: QueueItem }> = ({ item }) => {
    const [queueItem, setQueueItem] = React.useState<QueueItem>(item);
    const [loading, setLoading] = React.useState(!item.expand?.patient);
    const [lineNumberDialogOpen, setLineNumberDialogOpen] = React.useState(false);
    const [newLineNumber, setNewLineNumber] = React.useState(item.line_number);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    // Use the navigate function from the parent component
    const navigateToEncounter = (patientId: string, encounterId: string, options: any) => {
      navigate(`/encounter/${patientId}/${encounterId}`, { state: options });
    };

    const handleLineNumberUpdate = async () => {
      try {
        await pb.collection('queue').update(queueItem.id, {
          line_number: newLineNumber
        });
        setLineNumberDialogOpen(false);
      } catch (error) {
        console.error('Error updating line number:', error);
        alert('Failed to update line number');
      }
    };

    React.useEffect(() => {
      const loadPatientData = async () => {
        if (!item.expand?.patient) {
          try {
            setLoading(true);
            const patientData = await pb.collection('patients').getOne<Patient>(item.patient);
            setQueueItem({
              ...item,
              expand: {
                ...item.expand,
                patient: patientData
              }
            });
          } catch (error) {
            console.error('Error fetching patient data:', error);
          } finally {
            setLoading(false);
          }
        }
      };
      loadPatientData();
    }, [item]);

    if (loading) {
      return (
        <ListItem>
          <ListItemText primary="Loading..." />
        </ListItem>
      );
    }

    const waitTimeMinutes = Math.round(
      (new Date().getTime() - new Date(queueItem.check_in_time).getTime()) / (1000 * 60)
    );

    const ActionButtons = () => (
      <Box sx={{ 
        display: 'flex', 
        gap: 1,
        flexDirection: { xs: 'column', sm: 'row' },
        width: { xs: '100%', sm: 'auto' },
        mt: { xs: 1, sm: 0 }
      }}>
        {queueItem.status === 'checked_in' && (
          <RoleBasedAccess requiredRole="provider">
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleQueueAction(queueItem.id, 'start_encounter')}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Start Encounter
            </Button>
          </RoleBasedAccess>
        )}
        {queueItem.status === 'with_care_team' && queueItem.expand?.encounter?.id && (
          <RoleBasedAccess requiredRole="provider">
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleQueueAction(queueItem.id, 'continue_encounter')}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Continue Encounter
            </Button>
          </RoleBasedAccess>
        )}
        {queueItem.status === 'ready_pharmacy' && (
          <>
            <RoleBasedAccess requiredRole="pharmacy">
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleReviewDisbursements(queueItem)}
                fullWidth={isMobile}
                size={isMobile ? "small" : "medium"}
              >
                Review Disbursements
              </Button>
            </RoleBasedAccess>
          </>
        )}
        {queueItem.status === 'with_pharmacy' && (
          <RoleBasedAccess requiredRole="pharmacy">
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleQueueAction(queueItem.id, 'continue_encounter', { scrollTo: 'disbursement' })}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Continue Review
            </Button>
          </RoleBasedAccess>
        )}
        {(queueItem.status === 'ready_pharmacy' || queueItem.status === 'with_pharmacy') && (
          <RoleBasedAccess requiredRole="provider">
            {displayPreferences.show_move_to_checkout && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleQueueAction(queueItem.id, 'start_checkout')}
                fullWidth={isMobile}
                size={isMobile ? "small" : "medium"}
              >
                Move to Checkout
              </Button>
            )}
          </RoleBasedAccess>
        )}
        {/* Complete checkout - only visible for at_checkout status */}
        {queueItem.status === 'at_checkout' && queueItem.expand?.encounter?.id && (
          <RoleBasedAccess requiredRole="provider">
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                // Navigate to the encounter with checkout mode and scroll to questions
                const encounterId = queueItem.expand?.encounter?.id;
                if (encounterId) {
                  navigateToEncounter(
                    queueItem.patient,
                    encounterId,
                    { 
                      mode: 'checkout',
                      scrollTo: 'questions'
                    }
                  );
                }
              }}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Complete Checkout
            </Button>
          </RoleBasedAccess>
        )}
      </Box>
    );

    return (
      <ListItem
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0.5,
          py: 1,
          px: 1.5
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 0.5, sm: 1 },
          width: '100%'
        }}>
          {/* Patient Info */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            flex: 1,
            flexWrap: 'wrap'
          }}>
            <Chip 
              label={`#${queueItem.line_number}`} 
              size="small"
              sx={{ 
                minWidth: 40,
                height: 24,
                '& .MuiChip-label': {
                  px: 1,
                  fontSize: '0.75rem'
                },
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: queueItem.priority > 3 
                    ? theme.palette.error.light
                    : queueItem.priority > 1 
                      ? theme.palette.warning.light
                      : theme.palette.grey[200]
                }
              }}
              color={queueItem.priority > 3 ? 'error' : queueItem.priority > 1 ? 'warning' : 'default'}
              onClick={() => setLineNumberDialogOpen(true)}
            />
            
            {/* Line Number Edit Dialog */}
            <Dialog 
              open={lineNumberDialogOpen} 
              onClose={() => setLineNumberDialogOpen(false)}
              maxWidth="xs"
              fullWidth
            >
              <DialogTitle>Edit Line Number</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Line Number"
                  type="number"
                  fullWidth
                  value={newLineNumber}
                  onChange={(e) => setNewLineNumber(parseInt(e.target.value))}
                  variant="standard"
                  inputProps={{ min: 1 }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setLineNumberDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleLineNumberUpdate} variant="contained">Update</Button>
              </DialogActions>
            </Dialog>

            <Typography variant="subtitle2" sx={{ 
              fontWeight: 500,
              fontSize: '0.875rem'
            }}>
              {queueItem.expand?.patient?.first_name} {queueItem.expand?.patient?.last_name}
              <Typography 
                component="span" 
                sx={{ 
                  ml: 0.5,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  fontWeight: 'normal'
                }}
              >
                ({queueItem.expand?.patient?.gender === 'male' ? 'M' : queueItem.expand?.patient?.gender === 'female' ? 'F' : 'O'}, {queueItem.expand?.patient?.age !== undefined ? formatAgeDisplay(queueItem.expand.patient.age) : '?'})
              </Typography>
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              color: getWaitTimeColor(waitTimeMinutes)
            }}>
              <AccessTimeIcon sx={{ fontSize: '0.875rem' }} />
              <Typography variant="body2" component="span" sx={{ fontSize: '0.75rem' }}>
                {formatWaitTime(queueItem.check_in_time)}
              </Typography>
            </Box>

            {queueItem.status === 'ready_pharmacy' && (
              <Typography 
                variant="body2" 
                color="success.main"
                sx={{ 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  '&::before': {
                    content: '""',
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'success.main',
                    marginRight: 1
                  }
                }}
              >
                Ready for pharmacy
              </Typography>
            )}
          </Box>

          {/* Controls */}
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 0.5,
            width: { xs: '100%', sm: 'auto' }
          }}>
            {displayPreferences.show_care_team_assignment && (
              <Select
                value={queueItem.intended_provider || ''}
                onChange={(e) => handleTeamAssignment(queueItem.id, e.target.value || null)}
                size="small"
                displayEmpty
                disabled={processing === queueItem.id}
                sx={{ 
                  minWidth: { xs: '100%', sm: 120 },
                  '& .MuiSelect-select': {
                    py: 0.5,
                    fontSize: '0.75rem'
                  },
                  height: 32
                }}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {Array.from({ length: displayPreferences.care_team_count }, (_, i) => i + 1).map(num => (
                  <MenuItem key={num} value={`team${num}`}>
                    Care Team {num}
                  </MenuItem>
                ))}
                {displayPreferences.show_gyn_team && (
                  <MenuItem value="gyn_team">Gyn Team</MenuItem>
                )}
                {displayPreferences.show_optometry_team && (
                  <MenuItem value="optometry_team">Optometry Team</MenuItem>
                )}
              </Select>
            )}
            <Select
              value={queueItem.status}
              onChange={(e) => handleQueueAction(queueItem.id, 'status_change', { newStatus: e.target.value as QueueStatus })}
              size="small"
              sx={{ 
                minWidth: { xs: '100%', sm: 120 },
                '& .MuiSelect-select': {
                  py: 0.5,
                  fontSize: '0.75rem'
                },
                height: 32
              }}
            >
              {queueSections.map(section => (
                <MenuItem key={section.status} value={section.status}>
                  {section.title}
                </MenuItem>
              ))}
            </Select>
            {displayPreferences.show_priority_dropdown && (
              <Select
                value={queueItem.priority}
                onChange={(e) => handlePriorityChange(queueItem.id, Number(e.target.value))}
                size="small"
                sx={{ 
                  minWidth: { xs: '100%', sm: 100 },
                  '& .MuiSelect-select': {
                    py: 0.5,
                    fontSize: '0.75rem'
                  },
                  height: 32
                }}
              >
                {[1, 2, 3, 4, 5].map(priority => (
                  <MenuItem key={priority} value={priority}>
                    Priority {priority}
                  </MenuItem>
                ))}
              </Select>
            )}
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          mt: { xs: 0.5, sm: 0 }
        }}>
          <ActionButtons />
        </Box>
      </ListItem>
    );
  };

  const formatWaitTime = (checkInTime: string): string => {
    const minutes = Math.round(
      (new Date().getTime() - new Date(checkInTime).getTime()) / (1000 * 60)
    );
    
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const sortQueueItems = (items: QueueItem[]): QueueItem[] => {
    return [...items].sort((a, b) => {
      // First sort by priority (higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by line number (lower line number first)
      if (a.line_number !== b.line_number) {
        return a.line_number - b.line_number;
      }
      // Finally by wait time (longer wait first) if line numbers are equal
      return new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
    });
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 2 } }}>
      <Grid container spacing={2}>
        {/* Analytics Section */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap'
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              flex: '1 1 auto',
              minWidth: { xs: '100%', sm: 'auto' }
            }}>
              <Typography variant="h5" sx={{ fontSize: '1.25rem' }}>Queue Overview</Typography>
              <IconButton 
                onClick={fetchAnalytics} 
                disabled={queueLoading}
                size="small"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
              {displayPreferences.show_care_team_assignment && (
                <Select
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  size="small"
                  displayEmpty
                  sx={{ 
                    minWidth: 120,
                    ml: 1,
                    '& .MuiSelect-select': {
                      py: 0.5,
                      fontSize: '0.875rem'
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>All Teams</em>
                  </MenuItem>
                  {Array.from({ length: displayPreferences.care_team_count }, (_, i) => i + 1).map(num => (
                    <MenuItem key={num} value={`team${num}`}>
                      Care Team {num}
                    </MenuItem>
                  ))}
                  {displayPreferences.show_gyn_team && (
                    <MenuItem value="gyn_team">Gyn Team</MenuItem>
                  )}
                  {displayPreferences.show_optometry_team && (
                    <MenuItem value="optometry_team">Optometry Team</MenuItem>
                  )}
                </Select>
              )}
            </Box>

            <Box sx={{ 
              display: 'flex', 
              gap: 2,
              flexWrap: 'wrap',
              flex: '1 1 auto',
              justifyContent: 'flex-end'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography color="textSecondary" variant="body2">
                  Patients Today:
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  {analytics.patientsToday}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography color="textSecondary" variant="body2">
                  Avg. Wait Time:
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: getWaitTimeColor(analytics.averageWaitTime)
                  }}
                >
                  {analytics.averageWaitTime}m
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Queue Sections */}
        <Grid container spacing={2}>
          {queueSections.map(section => (
            <Grid item xs={12} md={6} key={section.status}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ 
                  borderBottom: 1, 
                  borderColor: 'divider', 
                  pb: 1,
                  mb: 1
                }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    {section.title} ({section.items.length})
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                      {section.description}
                    </Typography>
                  </Box>
                </Box>
                <List sx={{ 
                  '& .MuiListItem-root': { 
                    py: 1,
                    px: 1.5
                  },
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto'
                }}>
                  {section.renderItems ? (
                    section.renderItems(section.items)
                  ) : (
                    sortQueueItems(section.items).map((item, index) => (
                      <React.Fragment key={item.id}>
                        {index > 0 && <Divider sx={{ my: 0.5 }} />}
                        <QueueItemComponent item={item} />
                      </React.Fragment>
                    ))
                  )}
                  {section.items.length === 0 && (
                    <Typography 
                      color="textSecondary" 
                      sx={{ py: 2, textAlign: 'center', fontSize: '0.875rem' }}
                    >
                      No patients in this queue
                    </Typography>
                  )}
                </List>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Grid>

      {queueLoading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          p: 2,
          mt: 2
        }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mt: 2, mb: 1 }}
        >
          {error}
        </Alert>
      )}

      {processing && (
        <CircularProgress size={20} sx={{ position: 'fixed', bottom: 16, right: 16 }} />
      )}
    </Box>
  );
};

export default Dashboard;

