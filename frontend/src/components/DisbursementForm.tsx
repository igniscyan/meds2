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

export interface MedicationRecord extends Record {
  drug_name: string;
  drug_category: string;
  stock: number;
  fixed_quantity: number;
  unit_size: string;
  dose: string;
}

export interface DisbursementItem {
  medication: string;
  medicationDetails?: MedicationRecord;
  quantity: number;
  disbursement_multiplier: number;
  notes?: string;
}

interface DisbursementFormProps {
  encounterId?: string;
  disabled?: boolean;
  initialDisbursements?: DisbursementItem[];
  onDisbursementsChange: (disbursements: DisbursementItem[]) => void;
}

const DisbursementForm: React.FC<DisbursementFormProps> = ({
  encounterId,
  disabled = false,
  initialDisbursements,
  onDisbursementsChange,
}) => {
  const { records: medications, loading, error } = useRealtimeSubscription<MedicationRecord>(
    'inventory',
    { sort: 'drug_name' }
  );
  const [disbursements, setDisbursements] = useState<DisbursementItem[]>(initialDisbursements || [{
    medication: '',
    quantity: 0,
    disbursement_multiplier: 1,
    notes: '',
  }]);

  // Initialize disbursements from props if provided
  useEffect(() => {
    if (initialDisbursements?.length) {
      const disbursementsWithDetails = initialDisbursements.map(async d => {
        if (d.medication) {
          try {
            const medicationRecord = await pb.collection('inventory').getOne(d.medication);
            return {
              ...d,
              medicationDetails: medicationRecord as MedicationRecord
            };
          } catch (error) {
            console.error('Error loading medication details:', error);
            return d;
          }
        }
        return d;
      });

      Promise.all(disbursementsWithDetails).then(resolvedDisbursements => {
        setDisbursements(resolvedDisbursements);
      });
    }
  }, [initialDisbursements]);

  const handleAddDisbursement = () => {
    setDisbursements([
      ...disbursements,
      {
        medication: '',
        quantity: 0,
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

  return (
    <Box>
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
            <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
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
                          color: disbursement.disbursement_multiplier >= 1 
                            ? 'error.main'  // Red for stock decrease
                            : 'success.main' // Green for stock increase
                        }}
                      >
                        {disbursement.disbursement_multiplier >= 1 
                          ? `→ ${disbursement.medicationDetails.stock - (disbursement.quantity * disbursement.disbursement_multiplier)}`
                          : `→ ${disbursement.medicationDetails.stock + (disbursement.quantity * (1 - disbursement.disbursement_multiplier))}`
                        }
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
              <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'center' }}>
                {!disabled && disbursements.length > 1 && (
                  <IconButton
                    onClick={() => handleRemoveDisbursement(index)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Grid>
            </Grid>
          ))}
          {!disabled && (
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddDisbursement}
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Add Medication
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default DisbursementForm;
