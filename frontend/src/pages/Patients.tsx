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
  Tabs,
  Tab,
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  FormatListBulleted as ListIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Record } from 'pocketbase';
import PatientModal from '../components/PatientModal';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import DeletePatientDialog from '../components/DeletePatientDialog';
import BulkDistributionModal from '../components/BulkDistributionModal';
import { QueueItem } from '../types/queue';

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
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

export const Patients = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [bulkDistributionOpen, setBulkDistributionOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add debug logging for current time and date filtering
  console.log('Current Time:', new Date().toISOString());
  console.log('Current Local Time:', new Date().toLocaleString());

  // Get today's date at midnight UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get tomorrow's date at midnight UTC
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Convert to ISO strings for the filter
  const todayStr = today.toISOString();
  const tomorrowStr = tomorrow.toISOString();

  console.log('Date Debug:', {
    today: todayStr,
    tomorrow: tomorrowStr,
    localToday: today.toLocaleString(),
    localTomorrow: tomorrow.toLocaleString(),
    currentTime: new Date().toISOString()
  });

  const { records: patients, loading: patientsLoading } = useRealtimeSubscription<Patient>('patients', {
    sort: '-created',
  });

  const { records: queueItems, loading: queueLoading } = useRealtimeSubscription<QueueItem>('queue', {
    expand: 'patient',
    sort: '-created',
  });

  // Add debug logging for queue items
  React.useEffect(() => {
    console.log('All Queue Items:', queueItems.map(item => ({
      id: item.id,
      patientId: item.patient,
      status: item.status,
      created: item.created,
      checkInTime: item.check_in_time,
      endTime: item.end_time,
      localCheckInTime: new Date(item.check_in_time).toLocaleString(),
      localCreated: new Date(item.created).toLocaleString(),
      isActive: !item.end_time,
      isCompleted: item.status === 'completed'
    })));

    console.log('Queue Items Debug:', {
      today: todayStr,
      tomorrow: tomorrowStr,
      localToday: today.toLocaleString(),
      localTomorrow: tomorrow.toLocaleString(),
      currentTime: new Date().toISOString(),
      items: queueItems.map(item => ({
        id: item.id,
        patientId: item.patient,
        status: item.status,
        created: item.created,
        checkInTime: item.check_in_time,
        endTime: item.end_time,
        localCheckInTime: new Date(item.check_in_time).toLocaleString(),
        localCreated: new Date(item.created).toLocaleString(),
        isActive: !item.end_time,
        isCompleted: item.status === 'completed',
        matchesFilter: (
          (new Date(item.check_in_time) >= today && new Date(item.check_in_time) < tomorrow) ||
          (new Date(item.created) >= today && new Date(item.created) < tomorrow)
        )
      }))
    });
  }, [queueItems, todayStr, tomorrowStr, today, tomorrow]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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

  // Get active and completed patients for today
  const activePatients = patients.filter(patient => {
    const isActive = queueItems.some(item => {
      const isMatch = item.patient === patient.id && item.status !== 'completed';
      console.log('Active Check:', {
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        queueItemId: item.id,
        status: item.status,
        created: item.created,
        isMatch
      });
      return isMatch;
    });
    return isActive;
  });

  const completedPatients = patients.filter(patient => {
    const isCompleted = queueItems.some(item => {
      const isMatch = item.patient === patient.id && item.status === 'completed';
      console.log('Completed Check:', {
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        queueItemId: item.id,
        status: item.status,
        created: item.created,
        localCreated: new Date(item.created).toLocaleString(),
        checkInTime: item.check_in_time,
        localCheckInTime: new Date(item.check_in_time).toLocaleString(),
        isMatch
      });
      return isMatch;
    });
    return isCompleted;
  });

  const getFilteredPatients = (date: Date | null) => {
    if (!date) return [];
    
    // Set up the date range for the selected date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return patients.filter(patient => {
      return queueItems.some(item => {
        const itemDate = new Date(item.check_in_time);
        return item.patient === patient.id && 
               itemDate >= startOfDay && 
               itemDate <= endOfDay;
      });
    });
  };

  // Filter patients based on search query
  const filterPatientsBySearch = (patientList: Patient[]) => {
    if (!searchQuery) return patientList;
    
    const query = searchQuery.toLowerCase();
    return patientList.filter(patient => 
      patient.first_name.toLowerCase().includes(query) ||
      patient.last_name.toLowerCase().includes(query)
    );
  };

  if (patientsLoading || queueLoading) {
    return <Typography>Loading...</Typography>;
  }

  const renderPatientTable = (patientList: Patient[]) => (
    <TableContainer component={Paper}>
      <Table size="small" stickyHeader>
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
          {patientList.map((patient) => (
            <TableRow 
              key={patient.id}
              sx={{ 
                '&:hover': {
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              <TableCell>{patient.first_name} {patient.last_name}</TableCell>
              <TableCell>{formatAgeDisplay(patient.age)}</TableCell>
              <TableCell>{patient.gender}</TableCell>
              <TableCell>{patient.smoker}</TableCell>
              <TableCell align="right">
                <RoleBasedAccess requiredRole="provider">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="View Patient">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/patient/${patient.id}`)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Patient">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(patient)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Patient">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(patient)}
                      >
                        <DeleteIcon fontSize="small" />
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
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 2 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexWrap: 'wrap',
        gap: 1
      }}>
        <Typography variant="h4" sx={{ mb: 0 }}>Patients</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <RoleBasedAccess requiredRole="provider">
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
              size="small"
            >
              Add Patient
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<ListIcon />}
              onClick={() => setBulkDistributionOpen(true)}
              size="small"
            >
              Fast Track Patient
            </Button>
          </RoleBasedAccess>
        </Box>
      </Box>

      {/* Search Field */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search patients by name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
        size="small"
        InputProps={{
          startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
        }}
      />

      <Tabs 
        value={tabValue} 
        onChange={handleTabChange} 
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            py: 0
          }
        }}
      >
        <Tab label="All Patients" />
        <Tab label="Today's Patients" />
        <Tab label="Historical" />
      </Tabs>

      <Box sx={{ mt: 2, height: 'calc(100vh - 280px)', overflowY: 'auto' }}>
        <TabPanel value={tabValue} index={0}>
          {renderPatientTable(filterPatientsBySearch(patients))}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Active Patients ({filterPatientsBySearch(activePatients).length})
            </Typography>
            {renderPatientTable(filterPatientsBySearch(activePatients))}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Completed Today ({filterPatientsBySearch(completedPatients).length})
            </Typography>
            {renderPatientTable(filterPatientsBySearch(completedPatients))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Select Date"
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                slotProps={{ 
                  textField: { 
                    sx: { width: 250 },
                    size: "small"
                  } 
                }}
              />
            </LocalizationProvider>
          </Box>

          {selectedDate && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Patients for {selectedDate.toLocaleDateString()}
              </Typography>
              {renderPatientTable(filterPatientsBySearch(getFilteredPatients(selectedDate)))}
            </>
          )}
        </TabPanel>
      </Box>

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
