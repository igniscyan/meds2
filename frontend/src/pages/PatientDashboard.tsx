import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import DeletePatientDialog from '../components/DeletePatientDialog';
import { PatientModal } from '../components/PatientModal';

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

interface Encounter extends Record {
  patient: string;
  height: number;
  weight: number;
  temperature: number;
  heart_rate: number;
  systolic_pressure: number;
  diastolic_pressure: number;
  chief_complaint: string;
  other_chief_complaint?: string;
  created: string;
  expand?: {
    chief_complaint?: {
      id: string;
      name: string;
    };
  };
}

// Add helper function to format age display
const formatAgeDisplay = (ageInYears: number): string => {
  if (ageInYears >= 1) {
    return `${Math.floor(ageInYears)} years`;
  } else {
    const months = Math.floor(ageInYears * 12);
    if (months >= 1) {
      return `${months} months`;
    } else {
      const weeks = Math.floor(ageInYears * 52);
      return `${weeks} weeks`;
    }
  }
};

const PatientDashboard: React.FC = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'new_encounter'>('create');
  const [modalInitialData, setModalInitialData] = useState<any>(null);
  const { records: encounters, loading, error } = useRealtimeSubscription<Encounter>('encounters', {
    filter: `patient = "${patientId}"`,
    sort: '-created',
    expand: 'chief_complaint'
  });

  useEffect(() => {
    const loadPatient = async () => {
      if (!patientId) {
        navigate('/patients');
        return;
      }
      try {
        const record = await pb.collection('patients').getOne(patientId);
        setPatient(record as Patient);
      } catch (error: any) {
        console.error('Error loading patient:', error);
        // Only navigate back if it's not an auto-cancellation
        if (!error?.message?.includes('autocancelled') && !error?.message?.includes('aborted')) {
          navigate('/patients');
        }
      }
    };
    loadPatient();
  }, [patientId, navigate]);

  const handleStartEncounter = async () => {
    if (!patient) return;

    try {
      // Check for encounters from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const result = await pb.collection('encounters').getList(1, 1, {
        filter: `patient = "${patientId}" && created >= "${today.toISOString().split('T')[0]}"`,
        sort: '-created',
        expand: 'chief_complaint'
      });

      if (result.items.length > 0) {
        const existingEncounter = result.items[0];
        const confirmResponse = window.confirm(
          `An encounter already exists from today (${new Date(existingEncounter.created).toLocaleTimeString()}). \n\n` +
          `Would you like to view the existing encounter? \n` +
          `Click 'OK' to view existing encounter \n` +
          `Click 'Cancel' to create a new encounter anyway`
        );
        
        if (confirmResponse) {
          // Navigate to existing encounter in view mode
          navigate(`/encounter/${patientId}/${existingEncounter.id}`, { 
            state: { mode: 'view' }
          });
          return;
        }
      }

      // Calculate current age from DOB
      const currentAge = calculateAge(patient.dob);

      // Open PatientModal in new_encounter mode
      setModalMode('new_encounter');
      setModalInitialData({
        ...patient,
        currentAge,
      });
      setModalOpen(true);
    } catch (error) {
      console.error('Error in handleStartEncounter:', error);
      alert('Failed to start new encounter: ' + (error as Error).message);
    }
  };

  // Add the calculateAge function
  const calculateAge = (dob: string): number => {
    try {
      if (!dob) return 0;
      // Handle both timestamp and date-only formats
      const datePart = dob.includes(' ') ? dob.split(' ')[0] : dob;
      const [year, month, day] = datePart.split('-').map(Number);
      
      // Create date in local timezone for age calculation
      const birthDate = new Date(year, month - 1, day);
      if (isNaN(birthDate.getTime())) return 0;

      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age >= 0 ? age : 0;
    } catch (error) {
      console.error('Error calculating age:', error);
      return 0;
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleAddToQueue = async (patientId: string, encounterId: string) => {
    try {
      // Find the existing queue record for this encounter
      const result = await pb.collection('queue').getList(1, 1, {
        filter: `encounter = "${encounterId}"`,
        sort: '-created'
      });

      if (result.items.length === 0) {
        console.error('No queue record found for encounter');
        alert('Failed to find queue record for this encounter');
        return;
      }

      const queueRecord = result.items[0];
      
      // Update the existing queue record
      await pb.collection('queue').update(queueRecord.id, {
        status: 'at_checkout',
        end_time: null
      });

      alert('Patient returned to checkout status');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating queue status:', error);
      alert('Failed to update queue status: ' + (error as Error).message);
    }
  };

  const handleSave = () => {
    // After saving, refresh the patient data
    if (patientId) {
      pb.collection('patients').getOne(patientId)
        .then(record => setPatient(record as Patient))
        .catch(error => console.error('Error refreshing patient data:', error));
    }
  };

  // Don't show loading if we have patient data
  if (!patient) {
    return <Typography>Loading...</Typography>;
  }

  // Only show error if it's not an auto-cancellation
  if (error && !error.message?.includes('autocancelled') && !error.message?.includes('aborted')) {
    return <Typography color="error">Error loading encounters: {error.message}</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" gutterBottom>
              {patient.first_name} {patient.last_name}
            </Typography>
            <RoleBasedAccess requiredRole="provider">
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
              >
                Delete Patient
              </Button>
            </RoleBasedAccess>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Age:</strong> {formatAgeDisplay(patient.age)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Gender:</strong> {patient.gender}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Smoking Status:</strong> {patient.smoker}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Encounters</Typography>
        <RoleBasedAccess requiredRole="provider">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleStartEncounter}
          >
            New Encounter
          </Button>
        </RoleBasedAccess>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Chief Complaints</TableCell>
              <TableCell>Vitals</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {encounters.map((encounter) => (
              <TableRow key={encounter.id}>
                <TableCell>
                  {new Date(encounter.created).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {encounter.expand?.chief_complaint?.name || encounter.other_chief_complaint || 'No complaint recorded'}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">BP: {encounter.systolic_pressure}/{encounter.diastolic_pressure}</Typography>
                  <Typography variant="body2">HR: {encounter.heart_rate}</Typography>
                  <Typography variant="body2">Temp: {encounter.temperature}°F</Typography>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`/encounter/${patientId}/${encounter.id}`, {
                      state: { mode: 'view' }
                    })}
                  >
                    View Details
                  </Button>
                  <RoleBasedAccess requiredRole="provider">
                    <Button
                      size="small"
                      color="secondary"
                      onClick={async () => {
                        try {
                          if (!encounter.id || !patientId) {
                            alert('Missing encounter ID or patient ID');
                            return;
                          }
                          await handleAddToQueue(patientId, encounter.id);
                        } catch (error) {
                          console.error('Error adding to queue:', error);
                          alert('Error adding to queue: ' + (error as Error).message);
                        }
                      }}
                      sx={{ ml: 1 }}
                    >
                      Add to Queue
                    </Button>
                  </RoleBasedAccess>
                </TableCell>
              </TableRow>
            ))}
            {encounters.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No encounters found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PatientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        mode={modalMode}
        initialData={modalInitialData}
      />

      <DeletePatientDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        patientId={patientId || ''}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : ''}
        redirectToList={true}
      />
    </Box>
  );
};

export default PatientDashboard;
