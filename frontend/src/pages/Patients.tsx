import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  FormatListBulleted as ListIcon,
} from '@mui/icons-material';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';
import PatientModal from '../components/PatientModal';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import DeletePatientDialog from '../components/DeletePatientDialog';
import BulkDistributionModal from '../components/BulkDistributionModal';

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
}

export const Patients = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [bulkDistributionOpen, setBulkDistributionOpen] = useState(false);
  
  const { records: patients, loading } = useRealtimeSubscription<Patient>('patients', {
    sort: '-created',
  });

  const handleAddClick = () => {
    setSelectedPatient(null);
    setModalOpen(true);
  };

  const handleEditClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  const handleDeleteClick = (patient: Patient) => {
    setPatientToDelete(patient);
    setDeleteDialogOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPatient(null);
  };

  const handleBulkDistributionComplete = () => {
    setBulkDistributionOpen(false);
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Patients</Typography>
        <RoleBasedAccess requiredRole="provider">
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
            >
              Add Patient
            </Button>
            <Button
              variant="contained"
              sx={{ 
                backgroundColor: '#9c27b0',
                '&:hover': {
                  backgroundColor: '#7b1fa2',
                },
                textTransform: 'uppercase'
              }}
              startIcon={<ListIcon />}
              onClick={() => setBulkDistributionOpen(true)}
            >
              Fast Track Patient
            </Button>
          </Box>
        </RoleBasedAccess>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Smoker</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>{patient.first_name} {patient.last_name}</TableCell>
                <TableCell>{patient.age}</TableCell>
                <TableCell>{patient.gender}</TableCell>
                <TableCell>{patient.smoker}</TableCell>
                <TableCell align="right">
                  <RoleBasedAccess requiredRole="provider">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="View Patient">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/patient/${patient.id}`)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Patient">
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(patient)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Patient">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(patient)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </RoleBasedAccess>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PatientModal
        open={modalOpen}
        onClose={handleModalClose}
        onSave={handleModalClose}
        initialData={selectedPatient || undefined}
        mode={selectedPatient ? 'edit' : 'create'}
      />

      <BulkDistributionModal
        open={bulkDistributionOpen}
        onClose={() => setBulkDistributionOpen(false)}
        onComplete={handleBulkDistributionComplete}
      />

      {patientToDelete && (
        <DeletePatientDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setPatientToDelete(null);
          }}
          patientId={patientToDelete.id}
          patientName={`${patientToDelete.first_name} ${patientToDelete.last_name}`}
          redirectToList={false}
        />
      )}
    </Box>
  );
};

export default Patients;
