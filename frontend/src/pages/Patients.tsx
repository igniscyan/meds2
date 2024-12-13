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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Queue as QueueIcon,
  AddCircle as AddCircleIcon,
} from '@mui/icons-material';
import PatientModal, { PatientFormData, PatientSubmitData } from '../components/PatientModal';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    console.log('Patients updated:', patients);
  }, [patients]);

  const handleCreatePatient = async (data: PatientSubmitData) => {
    try {
      if (selectedPatient) {
        // Update existing patient
        await pb.collection('patients').update(selectedPatient.id, {
          first_name: data.firstName,
          last_name: data.lastName,
          dob: data.dateOfBirth,
          gender: data.gender,
          age: data.age,
          smoker: data.smoker,
        });
      } else {
        // Create new patient
        await pb.collection('patients').create({
          first_name: data.firstName,
          last_name: data.lastName,
          dob: data.dateOfBirth,
          gender: data.gender,
          age: data.age,
          smoker: data.smoker,
          date_created: new Date().toISOString(),
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving patient:', error);
    }
  };

  const handleStartEncounter = (patientId: string) => {
    navigate(`/encounter/${patientId}`);
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
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
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setIsModalOpen(true)}
        >
          New Patient
        </Button>
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
                  sx={{ cursor: 'pointer' }}
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
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => handleEditPatient(patient)}
                      title="Edit Patient"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => navigate(`/patient/${patient.id}`)}
                      title="View Patient"
                    >
                      <PersonIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={async () => {
                        try {
                          await pb.collection('queue').create({
                            "patient": patient.id,
                            "status": "waiting",
                            "check_in_time": new Date().toISOString(),
                            "priority": 1.0
                          });
                          alert('Patient added to queue');
                        } catch (error) {
                          console.error('Error adding to queue:', error);
                          alert('Failed to add patient to queue');
                        }
                      }}
                      title="Add to Queue"
                    >
                      <QueueIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => navigate(`/encounter/${patient.id}/new`)}
                      title="New Encounter"
                    >
                      <AddCircleIcon />
                    </IconButton>
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
        onSubmit={handleCreatePatient}
        initialData={selectedPatient || undefined}
      />
    </Box>
  );
};

export default Patients;
