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
  originalQuantity?: number;
  originalMultiplier?: number;
}

interface DisbursementFormProps {
  encounterId?: string;
  queueItemId?: string;
  disabled?: boolean;
  mode?: 'create' | 'view' | 'edit' | 'pharmacy';
  initialDisbursements?: any[];
  onDisbursementsChange: (disbursements: any[]) => void;
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
  const [disbursements, setDisbursements] = useState<DisbursementItem[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Track initial state of medications when the encounter was loaded
  const [initialMedicationState, setInitialMedicationState] = useState<Map<string, { 
    quantity: number;
    multiplier: number;
    id: string;
    medicationDetails?: MedicationRecord;
  }>>(new Map());

  // Track medications that were deleted from their initial state
  const [deletedMedications, setDeletedMedications] = useState<Map<string, {
    quantity: number;
    multiplier: number;
    wasRestored: boolean;
  }>>(new Map());

  // Initialize disbursements and their initial state
  useEffect(() => {
    if (initialDisbursements?.length) {
      const newInitialState = new Map();
      const processedDisbursements = initialDisbursements.map(d => {
        // Only track initial state for disbursements that have an ID (exist in database)
        if (d.medication && d.id) {
          console.log('STOCK DEBUG: Tracking initial state for:', {
            id: d.id,
            medication: d.medication,
            quantity: d.quantity,
            multiplier: d.disbursement_multiplier,
            medicationDetails: d.medicationDetails
          });
          
          newInitialState.set(d.medication, {
            quantity: d.quantity,
            multiplier: d.disbursement_multiplier,
            id: d.id,  // Track the original ID
            medicationDetails: d.medicationDetails  // Track medication details
          });
        }
        return { ...d };
      });
      
      // Only set initial state if it hasn't been set before
      setInitialMedicationState(prev => {
        if (prev.size === 0) {
          console.log('STOCK DEBUG: Setting initial state for the first time');
          return newInitialState;
        }
        console.log('STOCK DEBUG: Preserving existing initial state:', {
          existing: Array.from(prev.entries()),
          attempted: Array.from(newInitialState.entries())
        });
        return prev;
      });
      
      setDisbursements(processedDisbursements);
      // Clear any deleted medications when initializing
      setDeletedMedications(new Map());
      
      console.log('STOCK DEBUG: Initialized with state:', {
        disbursements: processedDisbursements,
        initialState: Array.from(newInitialState.entries()),
        trackedMedications: Array.from(newInitialState.keys())
      });
    }
  }, [initialDisbursements]);

  const handleAddDisbursement = () => {
    const newDisbursement = {
      medication: '',
      quantity: 1,
      disbursement_multiplier: 1,
      notes: '',
    };
    
    console.log('STOCK DEBUG: [ADD] Adding new disbursement:', {
      currentInitialState: Array.from(initialMedicationState.entries()),
      currentDisbursements: disbursements.length,
      preservingInitialState: true
    });
    
    setDisbursements([...disbursements, newDisbursement]);
  };

  const handleRemoveDisbursement = (index: number) => {
    const disbursement = disbursements[index];
    
    // If this was an initial medication, track its deletion
    if (disbursement.medication && initialMedicationState.has(disbursement.medication)) {
      console.log('STOCK DEBUG: [REMOVE] Via trash button:', {
        medication: disbursement.medicationDetails?.drug_name,
        wasInitial: true,
        initialState: initialMedicationState.get(disbursement.medication),
        currentInitialState: Array.from(initialMedicationState.entries())
      });
      
      setDeletedMedications(prev => {
        const newMap = new Map(prev);
        newMap.set(disbursement.medication, {
          quantity: disbursement.quantity,
          multiplier: disbursement.disbursement_multiplier,
          wasRestored: false
        });
        return newMap;
      });
    }
    
    const newDisbursements = disbursements.filter((_, i) => i !== index);
    setDisbursements(newDisbursements);
    onDisbursementsChange(newDisbursements);
  };

  const calculateStockChange = (disbursement: DisbursementItem) => {
    if (!disbursement.medicationDetails || !disbursement.medication) return null;
    
    const currentTotal = disbursement.quantity * disbursement.disbursement_multiplier;
    const wasInitialMedication = initialMedicationState.has(disbursement.medication);
    const initialState = wasInitialMedication ? initialMedicationState.get(disbursement.medication) : null;
    
    console.log('STOCK DEBUG: Calculating stock for:', {
      medication: disbursement.medicationDetails.drug_name,
      currentTotal,
      currentStock: disbursement.medicationDetails.stock,
      wasInitialMedication,
      initialState
    });

    // Always check against initial state first
    if (wasInitialMedication && initialState) {
      const initialTotal = initialState.quantity * initialState.multiplier;
      const stockChange = currentTotal - initialTotal;
      
      console.log('STOCK DEBUG: Initial medication calculation:', {
        initialTotal,
        currentTotal,
        stockChange,
        newStock: disbursement.medicationDetails.stock - stockChange
      });
      
      if (stockChange === 0) {
        return 'No Change (Initial)';
      } else {
        const newStock = disbursement.medicationDetails.stock - stockChange;
        const changeSymbol = stockChange > 0 ? '-' : '+';
        return `→ ${newStock} (${changeSymbol}${Math.abs(stockChange)})`;
      }
    }
    
    // This is a completely new disbursement
    console.log('STOCK DEBUG: New disbursement:', {
      currentTotal,
      currentStock: disbursement.medicationDetails.stock,
      newStock: disbursement.medicationDetails.stock - currentTotal
    });
    
    const newStock = disbursement.medicationDetails.stock - currentTotal;
    return `→ ${newStock} (-${currentTotal})`;
  };

  const handleDisbursementChange = (
    index: number,
    field: keyof DisbursementItem,
    value: any
  ) => {
    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};
    const previousMedicationId = disbursement.medication;
    
    if (field === 'medication') {
      const medicationId = typeof value === 'object' ? value?.id : value;
      
      // If changing from one medication to another, and the previous was an initial medication
      if (previousMedicationId && previousMedicationId !== medicationId && 
          initialMedicationState.has(previousMedicationId)) {
        const initialStateForPrevious = initialMedicationState.get(previousMedicationId);
        console.log('STOCK DEBUG: [REMOVE] Via medication change:', {
          from: disbursement.medicationDetails?.drug_name,
          wasInitial: true,
          initialState: initialStateForPrevious,
          currentInitialState: Array.from(initialMedicationState.entries())
        });
        
        // Track the removal in deletedMedications but preserve initial state context
        setDeletedMedications(prev => {
          const newMap = new Map(prev);
          newMap.set(previousMedicationId, {
            quantity: disbursement.quantity,
            multiplier: disbursement.disbursement_multiplier,
            wasRestored: false
          });
          return newMap;
        });
      }

      if (medicationId) {
        const medicationRecord = medications?.find(m => m.id === medicationId);
        disbursement.medicationDetails = medicationRecord;
        disbursement.medication = medicationId;
        
        // Always check against initial state first
        const wasInitialMedication = initialMedicationState.has(medicationId);
        const initialState = wasInitialMedication ? initialMedicationState.get(medicationId) : null;
        
        console.log('STOCK DEBUG: [CHANGE] Medication selection:', {
          medication: medicationRecord?.drug_name,
          medicationId,
          wasInitialMedication,
          initialState,
          currentInitialState: Array.from(initialMedicationState.entries())
        });
        
        if (wasInitialMedication && initialState) {
          // This was part of the initial state - always use initial quantities as reference
          disbursement.quantity = initialState.quantity;
          disbursement.disbursement_multiplier = initialState.multiplier;
          disbursement.id = initialState.id; // Restore the original ID
          
          console.log('STOCK DEBUG: [RESTORE] Using initial state:', {
            medication: medicationRecord?.drug_name,
            quantity: initialState.quantity,
            multiplier: initialState.multiplier,
            total: initialState.quantity * initialState.multiplier,
            restoredId: initialState.id
          });
        } else if (medicationRecord) {
          // This is a truly new medication
          disbursement.quantity = medicationRecord.fixed_quantity;
          disbursement.disbursement_multiplier = 1;
          disbursement.id = undefined;
          
          console.log('STOCK DEBUG: [NEW] Setting new medication:', {
            medication: medicationRecord.drug_name,
            currentStock: medicationRecord.stock,
            fixedQuantity: medicationRecord.fixed_quantity,
            isCompletelyNew: true
          });
        }
      } else {
        // If clearing the medication, track removal if it was initial
        if (previousMedicationId && initialMedicationState.has(previousMedicationId)) {
          console.log('STOCK DEBUG: [REMOVE] Via clearing medication:', {
            medication: disbursement.medicationDetails?.drug_name,
            wasInitial: true,
            currentDeletedState: Array.from(deletedMedications.entries())
          });
          
          setDeletedMedications(prev => {
            const newMap = new Map(prev);
            newMap.set(previousMedicationId, {
              quantity: disbursement.quantity,
              multiplier: disbursement.disbursement_multiplier,
              wasRestored: false
            });
            return newMap;
          });
        }
        
        disbursement.medicationDetails = undefined;
        disbursement.medication = '';
        disbursement.id = undefined;
      }
    } else if (field === 'quantity' || field === 'disbursement_multiplier') {
      const numValue = Number(value);
      const newQuantity = field === 'quantity' ? numValue : disbursement.quantity;
      const newMultiplier = field === 'disbursement_multiplier' ? numValue : disbursement.disbursement_multiplier;
      const totalQuantity = newQuantity * newMultiplier;
      
      if (disbursement.medicationDetails && disbursement.medication) {
        let availableStock = disbursement.medicationDetails.stock;
        
        // Always check against initial state first
        const wasInitialMedication = initialMedicationState.has(disbursement.medication);
        if (wasInitialMedication) {
          const initial = initialMedicationState.get(disbursement.medication)!;
          const initialTotal = initial.quantity * initial.multiplier;
          availableStock += initialTotal;
          
          console.log('STOCK DEBUG: [MODIFY] Changing quantity of initial medication:', {
            medication: disbursement.medicationDetails.drug_name,
            newTotal: totalQuantity,
            initialTotal,
            availableStock
          });
        }
        
        if (totalQuantity > availableStock) {
          alert(`Not enough stock. Available: ${availableStock}, Requested: ${totalQuantity}`);
          return;
        }
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

  // Add a debug component to show current state
  const renderDebugState = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
        <Typography variant="subtitle2">Debug State:</Typography>
        <pre style={{ fontSize: '0.8em' }}>
          {JSON.stringify({
            initialState: Object.fromEntries(initialMedicationState),
            deletedState: Object.fromEntries(deletedMedications),
            currentDisbursements: disbursements.map(d => ({
              medication: d.medicationDetails?.drug_name,
              quantity: d.quantity,
              multiplier: d.disbursement_multiplier
            }))
          }, null, 2)}
        </pre>
      </Box>
    );
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
                              color: calculateStockChange(disbursement)?.includes('No Change') ? 'text.secondary' : 'error.main'
                            }}
                          >
                            {calculateStockChange(disbursement)}
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
          {mode !== 'view' && (
            <Button
              variant="outlined"
              onClick={handleAddDisbursement}
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
              disabled={disabled}
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
      {renderDebugState()}
    </Box>
  );
};
