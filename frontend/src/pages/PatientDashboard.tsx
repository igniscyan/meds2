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

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
  height_inches?: number | null;
  weight?: number | null;
  temperature?: number | null;
  heart_rate?: number | null;
  systolic_pressure?: number | null;
  diastolic_pressure?: number | null;
}

interface Encounter extends Record {
  patient: string;
  height_inches: number;
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

const PatientDashboard: React.FC = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
      const debugMessage = `🔍 ENCOUNTER CHECK: Starting for patient: ${patient.first_name} ${patient.last_name} (ID: ${patientId})`;
      console.warn(debugMessage);
      alert(debugMessage);

      // Check if patient has an existing encounter
      const result = await pb.collection('encounters').getList(1, 1, {
        filter: `patient = "${patientId}"`,
        sort: '-created',
        expand: 'chief_complaint'
      });

      const resultMessage = `🔍 ENCOUNTER CHECK: Found ${result.totalItems} encounters. Items length: ${result.items.length}`;
      console.warn(resultMessage);
      console.warn('🔍 ENCOUNTER CHECK: Full result:', result);
      alert(resultMessage);

      if (result.items.length > 0) {
        // Use the most recent encounter
        const latestEncounter = result.items[0] as Encounter;
        const encounterMessage = `🔍 ENCOUNTER CHECK: Using existing encounter ID: ${latestEncounter.id}\nCreated: ${latestEncounter.created}`;
        console.warn(encounterMessage);
        console.warn('🔍 ENCOUNTER CHECK: Full encounter:', latestEncounter);
        alert(encounterMessage);
        
        navigate(`/encounter/${patientId}/${latestEncounter.id}`, { 
          state: { mode: 'edit' }
        });
      } else {
        const newMessage = '🔍 ENCOUNTER CHECK: No existing encounters found, creating new encounter';
        console.warn(newMessage);
        console.warn('🔍 ENCOUNTER CHECK: Patient vitals:', {
          height: patient.height_inches,
          weight: patient.weight,
          temp: patient.temperature,
          hr: patient.heart_rate,
          bp: `${patient.systolic_pressure}/${patient.diastolic_pressure}`
        });
        alert(newMessage);

        // Create a new encounter only if none exists
        navigate(`/encounter/${patientId}`, { 
          state: { 
            mode: 'edit',
            initialVitals: {
              height_inches: patient.height_inches ?? null,
              weight: patient.weight ?? null,
              temperature: patient.temperature ?? null,
              heart_rate: patient.heart_rate ?? null,
              systolic_pressure: patient.systolic_pressure ?? null,
              diastolic_pressure: patient.diastolic_pressure ?? null,
            }
          } 
        });
      }
    } catch (error) {
      const errorMsg = `🔍 ENCOUNTER CHECK ERROR: ${error}`;
      console.warn(errorMsg);
      alert(errorMsg);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
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
              <strong>Age:</strong> {patient.age}
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
