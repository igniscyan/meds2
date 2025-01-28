import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Alert,
  Typography,
  useTheme
} from '@mui/material';
import { pb } from '../atoms/auth';
import BackupIcon from '@mui/icons-material/Backup';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { RoleBasedAccess } from '../components/RoleBasedAccess';

export const DataManagement: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);

  const handleBackupDatabase = async () => {
    try {
      setLoading(true);
      setError(null);

      // Define collections to backup
      const collections = ['patients', 'encounters', 'disbursements', 'medications', 'diagnosis'];
      const backup: Record<string, any> = {};

      // Fetch all records from each collection
      for (const collection of collections) {
        const records = await pb.collection(collection).getList(1, 1000000, {
          expand: '*'
        });
        backup[collection] = records.items;
      }

      // Create and download backup file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meds_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Database backup completed successfully');
    } catch (err) {
      console.error('Backup failed:', err);
      setError('Failed to backup database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWipePatientNames = async () => {
    try {
      setLoading(true);
      setError(null);
      setWipeDialogOpen(false);

      // Get all patients
      const patients = await pb.collection('patients').getList(1, 1000000);

      // Update each patient to remove names
      for (const patient of patients.items) {
        await pb.collection('patients').update(patient.id, {
          first_name: '[REDACTED]',
          last_name: '[REDACTED]'
        });
      }

      setSuccess('Patient names have been successfully wiped from the database');
    } catch (err) {
      console.error('Name wipe failed:', err);
      setError('Failed to wipe patient names. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleBasedAccess requiredRole="admin">
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Data Management
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Database Operations
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleBackupDatabase}
              disabled={loading}
              startIcon={<BackupIcon />}
            >
              Backup Database
            </Button>

            <Button
              variant="contained"
              color="error"
              onClick={() => setWipeDialogOpen(true)}
              disabled={loading}
              startIcon={<DeleteForeverIcon />}
            >
              Wipe Patient Names
            </Button>
          </Box>
        </Paper>

        {/* Confirmation Dialog */}
        <Dialog
          open={wipeDialogOpen}
          onClose={() => setWipeDialogOpen(false)}
        >
          <DialogTitle>
            Warning: Irreversible Action
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              This action will permanently remove all patient first and last names from the database,
              replacing them with [REDACTED]. This action cannot be undone.
              <br /><br />
              Please ensure you have created a backup before proceeding.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWipeDialogOpen(false)} color="primary">
              Cancel
            </Button>
            <Button onClick={handleWipePatientNames} color="error" variant="contained">
              Proceed with Wipe
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success/Error Messages */}
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
        >
          <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
            {success}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </RoleBasedAccess>
  );
};

export default DataManagement; 
