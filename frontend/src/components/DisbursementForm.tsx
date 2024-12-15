import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  IconButton,
  Autocomplete,
  Button,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { DisbursementConfirmation } from './DisbursementConfirmation';

export interface MedicationRecord extends Record {
  drug_name: string;
  drug_category: string;
  stock: number;
  fixed_quantity: number;
  unit_size: string;
  dose: string;
}

export interface DisbursementItem {
  id?: string;
  medication: string;
  medicationDetails?: MedicationRecord;
  quantity: number;
  disbursement_multiplier: number;
  notes?: string;
}

interface DisbursementFormProps {
  encounterId?: string;
  queueItemId?: string;
  disabled?: boolean;
  mode?: 'create' | 'view' | 'edit' | 'pharmacy';
  initialDisbursements?: DisbursementItem[];
  onDisbursementsChange: (disbursements: DisbursementItem[]) => void;
  onDisbursementComplete?: () => void;
}

export const DisbursementForm: React.FC<DisbursementFormProps> = ({
  encounterId,
  queueItemId,
  disabled = false,
  mode,
  initialDisbursements = [],
  onDisbursementsChange,
  onDisbursementComplete,
}) => {
  const { records: medications, loading, error } = useRealtimeSubscription<MedicationRecord>(
    'inventory',
    { sort: 'drug_name' }
  );
  const [disbursements, setDisbursements] = useState<DisbursementItem[]>(
    initialDisbursements.length > 0 ? initialDisbursements : []
  );
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize disbursements from props if provided
  useEffect(() => {
    if (initialDisbursements?.length) {
      setDisbursements(initialDisbursements);
    }
  }, [initialDisbursements]);

  const handleAddDisbursement = () => {
    setDisbursements([
      ...disbursements,
      {
        medication: '',
        quantity: 1,
        disbursement_multiplier: 1,
        notes: '',
      },
    ]);
  };

  const handleRemoveDisbursement = (index: number) => {
    const newDisbursements = disbursements.filter((_, i) => i !== index);
    setDisbursements(newDisbursements);
    onDisbursementsChange(newDisbursements);
  };

  const handleDisbursementChange = (
    index: number,
    field: keyof DisbursementItem,
    value: any
  ) => {
    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};
    
    if (field === 'medication') {
      // If value is an object (from Autocomplete), use its ID
      const medicationId = typeof value === 'object' ? value?.id : value;
      if (medicationId) {
        const medicationRecord = medications?.find(m => m.id === medicationId);
        disbursement.medicationDetails = medicationRecord;
        disbursement.medication = medicationId;
        // Set the fixed quantity from the medication record
        if (medicationRecord) {
          disbursement.quantity = medicationRecord.fixed_quantity;
        }
      }
    } else if (field === 'quantity' || field === 'disbursement_multiplier') {
      const numValue = Number(value);
      const totalQuantity = field === 'quantity' 
        ? numValue * disbursement.disbursement_multiplier
        : disbursement.quantity * numValue;
        
      // Check stock level
      if (disbursement.medicationDetails && totalQuantity > disbursement.medicationDetails.stock) {
        alert(`Not enough stock. Available: ${disbursement.medicationDetails.stock}, Requested: ${totalQuantity}`);
        return;
      }
      disbursement[field] = numValue;
    } else {
      disbursement[field] = value;
    }
    
    newDisbursements[index] = disbursement;
    setDisbursements(newDisbursements);
    onDisbursementsChange(newDisbursements);
  };

  const calculateTotalQuantity = (disbursement: DisbursementItem) => {
    return disbursement.quantity * disbursement.disbursement_multiplier;
  };

  const handleConfirmDisbursement = () => {
    setShowConfirmation(true);
  };

  const handleConfirmationComplete = () => {
    setShowConfirmation(false);
    if (onDisbursementComplete) {
      onDisbursementComplete();
    }
  };

  return (
    <Box>
      {mode === 'pharmacy' && (
        <Typography variant="subtitle1" color="primary" gutterBottom>
          Please review and dispense the following medications:
        </Typography>
      )}
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error loading medications: {error.message}
        </Typography>
      )}
      {loading ? (
        <Typography>Loading medications...</Typography>
      ) : (
        <>
          {disbursements.map((disbursement, index) => (
            <Box key={index} sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      options={medications || []}
                      getOptionLabel={(option) => 
                        typeof option === 'string' ? option : `${option.drug_name} ${option.dose} (${option.unit_size})`
                      }
                      isOptionEqualToValue={(option, value) => 
                        option.id === (typeof value === 'string' ? value : value?.id)
                      }
                      value={disbursement.medicationDetails || null}
                      onChange={(_, newValue) => 
                        handleDisbursementChange(index, 'medication', newValue)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Medication"
                          required
                          fullWidth
                          error={!disbursement.medication}
                          helperText={!disbursement.medication ? 'Required' : ''}
                        />
                      )}
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Fixed Quantity"
                      type="number"
                      value={disbursement.medicationDetails?.fixed_quantity || disbursement.quantity}
                      disabled={true}
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                    {disbursement.medicationDetails && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="textSecondary">
                          Current Stock: {disbursement.medicationDetails.stock}
                        </Typography>
                        {disbursement.quantity && disbursement.disbursement_multiplier && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: 'block',
                              color: 'error.main'  // Always red for stock decrease
                            }}
                          >
                            {!disbursement.id && `→ ${disbursement.medicationDetails.stock - (disbursement.quantity * disbursement.disbursement_multiplier)}`}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Multiplier"
                      type="number"
                      value={disbursement.disbursement_multiplier}
                      onChange={(e) => 
                        handleDisbursementChange(index, 'disbursement_multiplier', Number(e.target.value))
                      }
                      disabled={disabled}
                      inputProps={{ min: 1 }}
                    />
                    {disbursement.medicationDetails && (
                      <Typography variant="caption" color="textSecondary">
                        Total: {calculateTotalQuantity(disbursement)}
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Notes"
                      value={disbursement.notes}
                      onChange={(e) => 
                        handleDisbursementChange(index, 'notes', e.target.value)
                      }
                      disabled={disabled}
                    />
                  </Grid>
                </Grid>
              </Box>
              {!disabled && (
                <IconButton
                  onClick={() => handleRemoveDisbursement(index)}
                  color="error"
                  sx={{ mt: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
          {mode !== 'view' && mode !== 'pharmacy' && (
            <Button
              variant="outlined"
              onClick={handleAddDisbursement}
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
            >
              Add Medication
            </Button>
          )}
        </>
      )}

      {showConfirmation && (
        <DisbursementConfirmation
          encounterId={encounterId}
          queueItemId={queueItemId}
          disbursements={disbursements}
          onConfirm={handleConfirmationComplete}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </Box>
  );
};
