import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';
import RefreshIcon from '@mui/icons-material/Refresh';
import { RoleBasedAccess } from '../components/RoleBasedAccess';

// Base type for PocketBase list responses
interface BaseListResult {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Record[];
}

interface QueueItem extends Record {
  patient: string;
  status: 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'completed';
  assigned_to?: string;
  check_in_time: string;
  start_time?: string;
  end_time?: string;
  priority: number;
  expand?: {
    patient: {
      first_name: string;
      last_name: string;
    };
    assigned_to?: {
      id: string;
      username: string;
    };
    encounter?: {
      id: string;
    };
  };
  line_number: number;
}

interface AnalyticsSummary {
  patientsToday: number;
  activePhysicians: number;
  mostActivePhysician: {
    username: string;
    patientCount: number;
  } | null;
  averageWaitTime: number;
}

interface QueueSection {
  title: string;
  status: QueueStatus;
  items: QueueItem[];
  description: string;
}

type QueueStatus = 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'completed';

// Add Patient interface
interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    patientsToday: 0,
    activePhysicians: 0,
    mostActivePhysician: null,
    averageWaitTime: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Subscribe to queue changes
  const { records: queueItems, loading } = useRealtimeSubscription<QueueItem>('queue', {
    sort: '-priority,check_in_time',
    expand: 'patient,assigned_to,encounter',
    filter: 'status != "completed"'
  });

  // Add debug logging for queue items
  useEffect(() => {
    console.log('Queue items received:', queueItems);
    console.log('Queue items expanded data:', queueItems.map(item => item.expand));
  }, [queueItems]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [completedTodayResult, activePhysiciansResult] = await Promise.all([
        pb.collection('queue').getList(1, 1, {
          filter: `status = "completed" && end_time >= "${today.toISOString()}"`,
          expand: 'assigned_to',
          $autoCancel: true
        }),
        pb.collection('queue').getList(1, 50, {
          filter: `status = "in_progress"`,
          expand: 'assigned_to',
          $autoCancel: true
        })
      ]) as [BaseListResult, BaseListResult];

      // Get most active physician
      const physicianCounts = new Map<string, { username: string; count: number }>();
      (completedTodayResult.items as QueueItem[]).forEach((item) => {
        if (item.expand?.assigned_to) {
          const physician = item.expand.assigned_to;
          const current = physicianCounts.get(physician.id) || { username: physician.username, count: 0 };
          current.count++;
          physicianCounts.set(physician.id, current);
        }
      });

      const mostActive = Array.from(physicianCounts.values())
        .sort((a, b) => b.count - a.count)[0];

      // Calculate average wait time
      const waitTimes = (completedTodayResult.items as QueueItem[])
        .filter((item) => item.start_time && item.check_in_time)
        .map((item) => {
          const start = new Date(item.start_time!);
          const checkIn = new Date(item.check_in_time);
          return (start.getTime() - checkIn.getTime()) / (1000 * 60); // Convert to minutes
        });

      const averageWait = waitTimes.length
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;

      setAnalytics({
        patientsToday: completedTodayResult.totalItems,
        activePhysicians: new Set((activePhysiciansResult.items as QueueItem[]).map(i => i.assigned_to)).size,
        mostActivePhysician: mostActive ? {
          username: mostActive.username,
          patientCount: mostActive.count
        } : null,
        averageWaitTime: Math.round(averageWait)
      });
    } catch (error: any) {
      if (!error.message?.includes('autocancelled')) {
        console.error('Error fetching analytics:', error);
      }
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    const loadAnalytics = async () => {
      try {
        await fetchAnalytics();
        // Only set up interval if component is still mounted
        if (isSubscribed) {
          const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
          return () => {
            clearInterval(interval);
            controller.abort();
          };
        }
      } catch (error: any) {
        if (!error.message?.includes('autocancelled')) {
          console.error('Error in analytics interval:', error);
        }
      }
    };

    loadAnalytics();

    // Cleanup function
    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, []);

  const handleClaimPatient = async (queueId: string) => {
    try {
      await pb.collection('queue').update(queueId, {
        status: 'with_care_team',
        assigned_to: pb.authStore.model?.id,
        start_time: new Date().toISOString()
      });
      
      // Get patient ID and navigate to encounter
      const queueItem = await pb.collection('queue').getOne<QueueItem>(queueId) as QueueItem;
      // Create a new encounter first
      const encounter = await pb.collection('encounters').create({
        patient: queueItem.patient,
        created: new Date().toISOString(),
      });
      
      // Update queue item with the encounter reference
      await pb.collection('queue').update(queueId, {
        encounter: encounter.id
      });
      
      // Navigate to the new encounter
      navigate(`/encounter/${queueItem.patient}/${encounter.id}`, { 
        state: { mode: 'edit' } 
      });
    } catch (error) {
      console.error('Error claiming patient:', error);
      alert('Failed to claim patient. Please try again.');
    }
  };

  const handleReviewDisbursements = async (queueItem: QueueItem) => {
    try {
      // Update status to with_pharmacy
      await pb.collection('queue').update(queueItem.id, {
        status: 'with_pharmacy',
        assigned_to: pb.authStore.model?.id
      });

      // Navigate to encounter in pharmacy mode
      if (queueItem.expand?.encounter?.id) {
        navigate(`/encounter/${queueItem.patient}/${queueItem.expand.encounter.id}`, {
          state: { mode: 'pharmacy' }
        });
      }
    } catch (error) {
      console.error('Error reviewing disbursements:', error);
      alert('Failed to start pharmacy review. Please try again.');
    }
  };

  // Update queueSections to handle synchronous filtering
  const queueSections = [
    {
      status: 'checked_in',
      title: 'Waiting Room',
      description: 'Patients waiting to be seen',
      items: queueItems.filter(item => item.status === 'checked_in')
    },
    {
      status: 'with_care_team',
      title: 'With Care Team',
      description: 'Currently being seen by providers',
      items: queueItems.filter(item => item.status === 'with_care_team')
    },
    {
      status: 'ready_pharmacy',
      title: 'Ready for Pharmacy',
      description: 'Waiting for medication disbursement',
      items: queueItems.filter(item => item.status === 'ready_pharmacy')
    },
    {
      status: 'with_pharmacy',
      title: 'With Pharmacy',
      description: 'Medications being disbursed',
      items: queueItems.filter(item => item.status === 'with_pharmacy')
    }
  ];

  const handleStatusChange = async (queueId: string, newStatus: QueueStatus) => {
    console.log('handleStatusChange called with:', { queueId, newStatus });
    try {
      // First get the current queue item to preserve encounter reference
      console.log('Fetching current queue item');
      const currentQueueItem = await pb.collection('queue').getOne<QueueItem>(queueId, {
        expand: 'patient,encounter'
      });
      console.log('Current queue item:', currentQueueItem);

      console.log('Updating queue status');
      await pb.collection('queue').update(queueId, {
        status: newStatus,
        encounter: currentQueueItem.expand?.encounter?.id,
        ...(newStatus === 'with_care_team' ? {
          assigned_to: pb.authStore.model?.id,
          start_time: new Date().toISOString()
        } : {}),
        ...(newStatus === 'with_pharmacy' ? {
          assigned_to: pb.authStore.model?.id
        } : {})
      });

      // If moving to pharmacy, navigate to encounter in pharmacy mode
      if (newStatus === 'with_pharmacy' && currentQueueItem.expand?.encounter?.id) {
        console.log('Navigating to encounter in pharmacy mode');
        navigate(`/encounter/${(currentQueueItem as QueueItem).patient}/${currentQueueItem.expand.encounter.id}`, {
          state: { mode: 'pharmacy' }
        });
      }
    } catch (error) {
      console.error('Error in handleStatusChange:', error);
      alert('Failed to update status. Please try again.');
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

  const handlePharmacyAction = async (queueId: string, action: 'start' | 'complete') => {
    setProcessing(queueId);
    try {
      if (action === 'start') {
        await pb.collection('queue').update(queueId, {
          status: 'with_pharmacy',
          assigned_to: pb.authStore.model?.id
        });
      } else {
        await pb.collection('queue').update(queueId, {
          status: 'completed',
          end_time: new Date().toISOString()
        });
      }
    } catch (error: unknown) {
      console.error('Error updating pharmacy status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to ${action} pharmacy process: ${errorMessage}`);
    } finally {
      setProcessing(null);
    }
  };

  // Convert renderQueueItem to a proper React component
  const QueueItemComponent: React.FC<{ item: QueueItem }> = ({ item }) => {
    const [queueItem, setQueueItem] = React.useState<QueueItem>(item);
    const [loading, setLoading] = React.useState(!item.expand?.patient);

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

    return (
      <ListItem
        key={queueItem.id}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2
        }}
        secondaryAction={
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Select
              value={queueItem.status}
              onChange={(e) => handleStatusChange(queueItem.id, e.target.value as QueueStatus)}
              size="small"
            >
              {queueSections.map(section => (
                <MenuItem key={section.status} value={section.status}>
                  {section.title}
                </MenuItem>
              ))}
            </Select>
            {queueItem.status === 'checked_in' && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleClaimPatient(queueItem.id)}
              >
                Start Encounter
              </Button>
            )}
            {queueItem.status === 'with_care_team' && queueItem.expand?.encounter?.id && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(`/encounter/${queueItem.patient}/${queueItem.expand?.encounter?.id}`)}
              >
                Continue Encounter
              </Button>
            )}
            {queueItem.status === 'ready_pharmacy' && (
              <RoleBasedAccess requiredRole="pharmacy">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleReviewDisbursements(queueItem)}
                >
                  Review Disbursements
                </Button>
              </RoleBasedAccess>
            )}
            {queueItem.status === 'with_pharmacy' && (
              <RoleBasedAccess requiredRole="pharmacy">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    if (queueItem.expand?.encounter?.id) {
                      navigate(`/encounter/${queueItem.patient}/${queueItem.expand.encounter.id}`, {
                        state: { mode: 'pharmacy' }
                      });
                    }
                  }}
                >
                  Continue Review
                </Button>
              </RoleBasedAccess>
            )}
            <Select
              value={queueItem.priority}
              onChange={(e) => handlePriorityChange(queueItem.id, Number(e.target.value))}
              size="small"
              sx={{ width: 100 }}
            >
              {[1, 2, 3, 4, 5].map(priority => (
                <MenuItem key={priority} value={priority}>
                  Priority {priority}
                </MenuItem>
              ))}
            </Select>
          </Box>
        }
      >
        <ListItemText
          sx={{ flex: '1 1 auto' }}
          primary={
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              flexWrap: 'wrap' 
            }}>
              <Chip 
                label={`#${queueItem.line_number}`} 
                size="small"
                sx={{ minWidth: 45 }}
                color={queueItem.priority > 3 ? 'error' : queueItem.priority > 1 ? 'warning' : 'default'}
              />
              <Typography component="span" variant="h6">
                {queueItem.expand?.patient?.first_name} {queueItem.expand?.patient?.last_name}
              </Typography>
              <Typography component="span" variant="caption" color="textSecondary">
                ({formatWaitTime(queueItem.check_in_time)})
              </Typography>
            </Box>
          }
          secondary={
            <Box component="span" sx={{ mt: 1 }}>
              {queueItem.expand?.assigned_to && (
                <Typography component="span" variant="body2">
                  With: {queueItem.expand.assigned_to.username}
                </Typography>
              )}
              {queueItem.status === 'ready_pharmacy' && (
                <Typography component="span" variant="body2" color="success.main">
                  Ready for pharmacy
                </Typography>
              )}
            </Box>
          }
        />
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
      // Then by wait time (longer wait first)
      return new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
    });
  };

  return (
    <Box sx={{ p: 4 }}>
      <Grid container spacing={3}>
        {/* Analytics Cards */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Analytics</Typography>
            <IconButton onClick={fetchAnalytics} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Patients Today
                  </Typography>
                  <Typography variant="h4">
                    {analytics.patientsToday}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Active Physicians
                  </Typography>
                  <Typography variant="h4">
                    {analytics.activePhysicians}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Most Active Physician
                  </Typography>
                  <Typography variant="h4">
                    {analytics.mostActivePhysician?.username || 'N/A'}
                  </Typography>
                  {analytics.mostActivePhysician && (
                    <Typography variant="caption" color="textSecondary">
                      {analytics.mostActivePhysician.patientCount} patients
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Wait Time
                  </Typography>
                  <Typography variant="h4">
                    {analytics.averageWaitTime} min
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Queue Sections */}
        <Grid container spacing={4}>
          {queueSections.map(section => (
            <Grid item xs={12} md={6} key={section.status}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ 
                  borderBottom: 1, 
                  borderColor: 'divider', 
                  pb: 2,
                  mb: 3
                }}>
                  <Typography variant="h6">
                    {section.title} ({section.items.length})
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2" color="textSecondary">
                      {section.description}
                    </Typography>
                  </Box>
                </Box>
                <List sx={{ '& .MuiListItem-root': { py: 2 } }}>
                  {sortQueueItems(section.items).map((item, index) => (
                    <React.Fragment key={item.id}>
                      {index > 0 && <Divider sx={{ my: 1 }} />}
                      <QueueItemComponent item={item} />
                    </React.Fragment>
                  ))}
                  {section.items.length === 0 && (
                    <Typography 
                      color="textSecondary" 
                      sx={{ py: 4, textAlign: 'center' }}
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
      {loading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          p: 4,
          mt: 4
        }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mt: 4, mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {processing && (
        <CircularProgress size={24} sx={{ position: 'fixed', bottom: 24, right: 24 }} />
      )}
    </Box>
  );
};

export default Dashboard;
