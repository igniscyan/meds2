import React from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { useRealtimeCollection } from '../hooks/useRealtimeCollection';
import type { Record as PBRecord } from 'pocketbase';

// Example record type
interface Patient extends PBRecord {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
}

const RealtimeExample: React.FC = () => {
  // Use our new hook to subscribe to the patients collection
  const { records, loading, error, refresh } = useRealtimeCollection<Patient>('patients', {
    sort: 'created',
    filter: 'created >= "2023-01-01 00:00:00"'
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Patients (Realtime)
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={refresh}
          sx={{ mr: 1 }}
        >
          Refresh Data
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">
          Error: {error.message}
        </Typography>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {records.length} patients found
          </Typography>
          
          {records.map(patient => (
            <Box 
              key={patient.id} 
              sx={{ 
                p: 2, 
                mb: 1, 
                border: '1px solid #eee',
                borderRadius: 1
              }}
            >
              <Typography variant="h6">
                {patient.first_name} {patient.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                DOB: {new Date(patient.dob).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gender: {patient.gender}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RealtimeExample; 