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
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';

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
  status: 'waiting' | 'in_progress' | 'completed';
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
  };
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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    patientsToday: 0,
    activePhysicians: 0,
    mostActivePhysician: null,
    averageWaitTime: 0,
  });

  // Subscribe to queue changes
  const { records: queueItems, loading } = useRealtimeSubscription<QueueItem>('queue', {
    sort: '-priority,check_in_time',
    expand: 'patient,assigned_to',
    filter: 'status != "completed"'
  });

  // Fetch analytics data
  const fetchAnalytics = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [completedTodayResult, activePhysiciansResult] = await Promise.all([
      pb.collection('queue').getList(1, 1, {
        filter: `status = "completed" && end_time >= "${today.toISOString()}"`,
        expand: 'assigned_to',
        $cancelKey: 'analytics'
      }),
      pb.collection('queue').getList(1, 50, {
        filter: `status = "in_progress"`,
        expand: 'assigned_to',
        $cancelKey: 'analytics'
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
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleClaimPatient = async (queueId: string) => {
    try {
      await pb.collection('queue').update(queueId, {
        status: 'in_progress',
        assigned_to: pb.authStore.model?.id,
        start_time: new Date().toISOString()
      });
      
      // Get patient ID and navigate to encounter
      const queueItem = await pb.collection('queue').getOne(queueId) as QueueItem;
      navigate(`/encounter/${queueItem.patient}/new`);
    } catch (error) {
      console.error('Error claiming patient:', error);
      alert('Failed to claim patient. Please try again.');
    }
  };

  const renderQueueItem = (item: QueueItem) => {
    const waitTime = Math.round(
      (new Date().getTime() - new Date(item.check_in_time).getTime()) / (1000 * 60)
    );

    return (
      <ListItem
        key={item.id}
        secondaryAction={
          item.status === 'waiting' ? (
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleClaimPatient(item.id)}
            >
              Claim Patient
            </Button>
          ) : (
            <Chip
              label={`With: ${item.expand?.assigned_to?.username}`}
              color="info"
            />
          )
        }
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">
                {item.expand?.patient.first_name} {item.expand?.patient.last_name}
              </Typography>
              <Chip
                size="small"
                color={item.priority > 3 ? 'error' : item.priority > 1 ? 'warning' : 'default'}
                label={`Priority ${item.priority}`}
              />
            </Box>
          }
          secondary={`Waiting: ${waitTime} minutes`}
        />
      </ListItem>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Analytics Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
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

        {/* Patient Queue */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">Patient Queue</Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PersonAddIcon />}
                onClick={() => navigate('/patients')}
              >
                Add Patient
              </Button>
            </Box>
            {loading ? (
              <Typography>Loading queue...</Typography>
            ) : queueItems.length === 0 ? (
              <Typography color="textSecondary">No patients in queue</Typography>
            ) : (
              <List>
                {queueItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <Divider />}
                    {renderQueueItem(item)}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
