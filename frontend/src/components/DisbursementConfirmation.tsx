import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { DisbursementItem, MedicationRecord } from './DisbursementForm';
import { pb } from '../atoms/auth';
import { RoleBasedAccess } from './RoleBasedAccess';

interface DisbursementConfirmationProps {
  encounterId?: string;
  queueItemId?: string;
  disbursements: DisbursementItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DisbursementConfirmation: React.FC<DisbursementConfirmationProps> = ({
  encounterId,
  queueItemId,
  disbursements,
  onConfirm,
  onCancel,
}) => {
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!encounterId || !queueItemId) {
      console.error('Missing required IDs');
      return;
    }
    setProcessing(true);
    try {
      // Process all disbursements
      for (const disbursement of disbursements) {
        if (!disbursement.medication || !disbursement.quantity) continue;

        const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
        const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);

        // Update inventory stock
        await pb.collection('inventory').update(disbursement.medication, {
          stock: medication.stock - quantity
        });

        // Create disbursement record
        await pb.collection('disbursements').create({
          encounter: encounterId,
          medication: disbursement.medication,
          quantity: quantity,
          notes: disbursement.notes || '',
        });
      }

      // Update queue status to completed
      await pb.collection('queue').update(queueItemId, {
        status: 'completed',
        end_time: new Date().toISOString()
      });

      onConfirm();
    } catch (error) {
      console.error('Error processing disbursements:', error);
      alert('Failed to process disbursements');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <RoleBasedAccess requiredRole="pharmacy">
      <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Medication Disbursement</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please confirm the following medications will be disbursed:
          </Typography>
          <List>
            {disbursements.map((d, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={d.medicationDetails?.drug_name}
                  secondary={`Quantity: ${d.quantity * (d.disbursement_multiplier || 1)} ${d.medicationDetails?.unit_size}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            variant="contained"
            disabled={processing}
          >
            Confirm Disbursement
          </Button>
        </DialogActions>
      </Dialog>
    </RoleBasedAccess>
  );
}; 