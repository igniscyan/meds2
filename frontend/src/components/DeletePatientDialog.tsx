import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { pb } from '../atoms/auth';
import { useNavigate } from 'react-router-dom';

interface DeletePatientDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  onDeleted?: () => void;
  redirectToList?: boolean;
}

export const DeletePatientDialog: React.FC<DeletePatientDialogProps> = ({
  open,
  onClose,
  patientId,
  patientName,
  onDeleted,
  redirectToList = false,
}) => {
  const navigate = useNavigate();
  const [hasDisbursements, setHasDisbursements] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDisbursements = async () => {
      if (!open || !patientId) return;
      
      try {
        setLoading(true);
        // First, get all encounters for this patient
        const encounters = await pb.collection('encounters').getList(1, 100, {
          filter: `patient = "${patientId}"`,
        });

        // Check for disbursements in each encounter
        for (const encounter of encounters.items) {
          const disbursements = await pb.collection('disbursements').getList(1, 1, {
            filter: `encounter = "${encounter.id}"`,
          });

          if (disbursements.totalItems > 0) {
            setHasDisbursements(true);
            break;
          }
        }
      } catch (error) {
        console.error('Error checking disbursements:', error);
      } finally {
        setLoading(false);
      }
    };

    checkDisbursements();
  }, [open, patientId]);

  const handleDelete = async () => {
    try {
      // First, get all encounters for this patient
      const encounters = await pb.collection('encounters').getList(1, 100, {
        filter: `patient = "${patientId}"`,
      });

      // Delete all disbursements for each encounter
      for (const encounter of encounters.items) {
        const disbursements = await pb.collection('disbursements').getList(1, 100, {
          filter: `encounter = "${encounter.id}"`,
        });

        // Delete each disbursement
        for (const disbursement of disbursements.items) {
          await pb.collection('disbursements').delete(disbursement.id);
        }

        // Delete encounter responses
        const responses = await pb.collection('encounter_responses').getList(1, 100, {
          filter: `encounter = "${encounter.id}"`,
        });

        for (const response of responses.items) {
          await pb.collection('encounter_responses').delete(response.id);
        }

        // Delete the encounter
        await pb.collection('encounters').delete(encounter.id);
      }

      // Delete any queue items for this patient
      const queueItems = await pb.collection('queue').getList(1, 100, {
        filter: `patient = "${patientId}"`,
      });

      for (const queueItem of queueItems.items) {
        await pb.collection('queue').delete(queueItem.id);
      }

      // Finally, delete the patient
      await pb.collection('patients').delete(patientId);
      
      // Call the onDeleted callback if provided
      if (onDeleted) {
        onDeleted();
      }

      // Close the dialog
      onClose();

      // Redirect to patient list if requested
      if (redirectToList) {
        navigate('/patients');
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Failed to delete patient and associated records. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Confirm Patient Deletion</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete the patient record for:
          </Typography>
          <Typography variant="h6" color="error">
            {patientName}
          </Typography>
        </Box>
        
        {hasDisbursements && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              This patient has medication disbursements. To properly manage inventory:
            </Typography>
            <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Open the patient's encounter</li>
              <li>Delete individual disbursements (this will automatically restore inventory)</li>
              <li>Return here to delete the patient record</li>
            </ol>
            <Typography variant="body2">
              This ensures accurate inventory management and proper tracking of medication returns.
            </Typography>
          </Alert>
        )}

        <Typography variant="body2" color="error">
          Warning: This action cannot be undone. This will permanently delete:
        </Typography>
        <ul>
          <li>Patient's personal information</li>
          <li>All encounter records</li>
          <li>All medication disbursement records</li>
          <li>All associated queue items</li>
          <li>All encounter responses and survey data</li>
        </ul>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleDelete} 
          color="error" 
          variant="contained"
        >
          Delete Patient
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeletePatientDialog; 