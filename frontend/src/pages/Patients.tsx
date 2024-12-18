import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Queue as QueueIcon,
  AddCircle as AddCircleIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import PatientModal from '../components/PatientModal';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useNavigate } from 'react-router-dom';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import BulkDistributionModal from '../components/BulkDistributionModal';

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
  date_created: string;
}

const Patients: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { records: patients, loading, error } = useRealtimeSubscription<Patient>('patients');
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [lineNumber, setLineNumber] = useState<number>(0);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  useEffect(() => {
    console.log('Patients updated:', patients);
  }, [patients]);

  const handleCreatePatient = async () => {
    try {
      handleCloseModal();
    } catch (error) {
      console.error('Error saving patient:', error);
      if (error instanceof Error) {
        alert(`Failed to save patient: ${error.message}`);
      } else {
        alert('Failed to save patient');
      }
    }
  };

  const handleStartEncounter = (patientId: string) => {
    navigate(`/encounter/${patientId}`, { state: { mode: 'edit' } });
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
  };

  const handleCheckIn = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setCheckInDialogOpen(true);
  };

  const handleCheckInConfirm = async () => {
    try {
      const data = {
        patient: selectedPatientId,
        status: 'checked_in',
        check_in_time: new Date().toISOString(),
        line_number: lineNumber,
        priority: 3,
        assigned_to: null,
        start_time: null,
        end_time: null,
        encounter: null,
      };

      await pb.collection('queue').create(data);
      alert('Patient checked in successfully');
      setCheckInDialogOpen(false);
    } catch (error) {
      console.error('Error checking in patient:', error);
      if (error instanceof Error) {
        alert(`Failed to check in patient: ${error.message}`);
      } else {
        alert('Failed to check in patient');
      }
    }
  };

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        patient.first_name.toLowerCase().includes(searchLower) ||
        patient.last_name.toLowerCase().includes(searchLower)
      );
    });
  }, [patients, searchQuery]);

  const handleBulkDistributionComplete = () => {
    setIsBulkModalOpen(false);
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">Error loading patients: {error.message}</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Patients</Typography>
        <RoleBasedAccess requiredRole="provider">
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
            >
              New Patient
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<InventoryIcon />}
              onClick={() => setIsBulkModalOpen(true)}
            >
              Fast Track Patient
            </Button>
          </Stack>
        </RoleBasedAccess>
      </Box>

      <Box mb={3} display="flex" alignItems="center">
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search patients by name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Full Name</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Date of Birth</TableCell>
              <TableCell>Smoking Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPatients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell
                  sx={{ 
                    cursor: 'pointer',
                    color: 'primary.main',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                  onClick={() => navigate(`/patient/${patient.id}`)}
                >
                  {`${patient.first_name} ${patient.last_name}`}
                </TableCell>
                <TableCell>{patient.age}</TableCell>
                <TableCell>{patient.gender}</TableCell>
                <TableCell>{patient.dob ? new Date(patient.dob).toLocaleDateString() : 'Invalid Date'}</TableCell>
                <TableCell>{patient.smoker ? patient.smoker.charAt(0).toUpperCase() + patient.smoker.slice(1) : ''}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <RoleBasedAccess requiredRole="provider">
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => handleEditPatient(patient)}
                        title="Edit Patient"
                      >
                        <EditIcon />
                      </IconButton>
                    </RoleBasedAccess>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => navigate(`/patient/${patient.id}`)}
                      title="View Patient"
                    >
                      <PersonIcon />
                    </IconButton>
                    <RoleBasedAccess requiredRole="provider">
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => handleCheckIn(patient.id)}
                        title="Check In Patient"
                      >
                        <QueueIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => navigate(`/encounter/${patient.id}`)}
                        title="New Encounter"
                      >
                        <AddCircleIcon />
                      </IconButton>
                    </RoleBasedAccess>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PatientModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleCreatePatient}
        initialData={selectedPatient || undefined}
        mode={selectedPatient ? 'edit' : 'create'}
      />

      <BulkDistributionModal
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onComplete={handleBulkDistributionComplete}
      />

      <Dialog open={checkInDialogOpen} onClose={() => setCheckInDialogOpen(false)}>
        <DialogTitle>Check In Patient</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Line Number"
            type="number"
            value={lineNumber}
            onChange={(e) => setLineNumber(parseInt(e.target.value))}
            margin="normal"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckInDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCheckInConfirm} variant="contained" color="primary">
            Check In
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Patients;
