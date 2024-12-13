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
import { Add as AddIcon } from '@mui/icons-material';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
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
  created: string;
}

const PatientDashboard: React.FC = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const { records: encounters, loading, error } = useRealtimeSubscription<Encounter>('encounters', {
    filter: `patient = "${patientId}"`,
    sort: '-created',
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

  const handleStartEncounter = () => {
    navigate(`/encounter/${patientId}`);
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
          <Grid item xs={12}>
            <Typography variant="h4" gutterBottom>
              {patient.first_name} {patient.last_name}
            </Typography>
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
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleStartEncounter}
        >
          New Encounter
        </Button>
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
                  {encounter.chief_complaint}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">BP: {encounter.systolic_pressure}/{encounter.diastolic_pressure}</Typography>
                  <Typography variant="body2">HR: {encounter.heart_rate}</Typography>
                  <Typography variant="body2">Temp: {encounter.temperature}°F</Typography>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`/encounter/${patientId}/${encounter.id}`)}
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
    </Box>
  );
};

export default PatientDashboard;
