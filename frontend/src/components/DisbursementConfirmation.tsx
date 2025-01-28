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
import { Record } from 'pocketbase';

interface ExistingDisbursement extends Record {
  medication: string;
  quantity: number;
  notes: string;
  encounter: string;
}

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
      // Get existing disbursements for this encounter
      const existingDisbursements = await pb.collection('disbursements').getList<ExistingDisbursement>(1, 50, {
        filter: `encounter = "${encounterId}"`,
      });
      const existingMap = new Map<string, ExistingDisbursement>(existingDisbursements.items.map(d => [d.id, d]));

      // First, verify all stock levels
      for (const disbursement of disbursements) {
        if (!disbursement.medication || !disbursement.quantity) continue;

        const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
        const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);

        if (disbursement.id) {
          const existing = existingMap.get(disbursement.id);
          if (existing) {
            // For existing disbursements, check if new quantity is more than original
            const stockChange = quantity - existing.quantity;
            if (stockChange > 0 && medication.stock < stockChange) {
              throw new Error(`Not enough stock for ${medication.drug_name}. Need ${stockChange} more but only ${medication.stock} available.`);
            }
          }
        } else {
          // For new disbursements, check full quantity
          if (medication.stock < quantity) {
            throw new Error(`Not enough stock for ${medication.drug_name}. Need ${quantity} but only ${medication.stock} available.`);
          }
        }
      }

      // Process all disbursements
      for (const disbursement of disbursements) {
        if (!disbursement.medication || !disbursement.quantity) continue;

        const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
        const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);

        if (disbursement.id) {
          // Update existing disbursement
          const existing = existingMap.get(disbursement.id);
          if (existing) {
            existingMap.delete(disbursement.id);
            
            // Only update if quantity or notes changed
            if (existing.quantity !== quantity || existing.notes !== disbursement.notes) {
              // Calculate stock change based on difference from original quantity
              const stockChange = quantity - existing.quantity;
              const newStock = medication.stock - stockChange;
              
              // Update inventory stock only if quantity changed
              if (stockChange !== 0) {
                await pb.collection('inventory').update(disbursement.medication, {
                  stock: newStock
                });
              }
              
              // Update disbursement
              await pb.collection('disbursements').update(disbursement.id, {
                quantity: quantity,
                notes: disbursement.notes || ''
              });
            }
          }
        } else {
          // Create new disbursement
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
      }

      // Handle deleted disbursements - restore their stock
      for (const [id, disbursement] of Array.from(existingMap.entries())) {
        const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
        // Restore stock for deleted disbursement
        await pb.collection('inventory').update(disbursement.medication, {
          stock: medication.stock + disbursement.quantity
        });
        
        // Delete the disbursement record
        await pb.collection('disbursements').delete(id);
      }

      // Update queue status to completed
      await pb.collection('queue').update(queueItemId, {
        status: 'completed',
        end_time: new Date().toISOString()
      });

      onConfirm();
    } catch (error) {
      console.error('Error processing disbursements:', error);
      alert('Failed to process disbursements: ' + (error as Error).message);
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
            {disbursements.map((d, index) => {
              const quantity = d.quantity * (d.disbursement_multiplier || 1);
              const stockChange = d.id && d.originalQuantity && d.originalMultiplier
                ? quantity - (d.originalQuantity * d.originalMultiplier)
                : quantity;
              
              return (
                <ListItem key={index}>
                  <ListItemText
                    primary={d.medicationDetails?.drug_name}
                    secondary={
                      `Quantity: ${quantity} ${d.medicationDetails?.unit_size}` +
                      (stockChange !== 0 ? ` (${stockChange > 0 ? '+' : ''}${stockChange} from previous)` : '')
                    }
                  />
                </ListItem>
              );
            })}
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