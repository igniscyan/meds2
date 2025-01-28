import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  IconButton,
  Autocomplete,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  markedForDeletion?: boolean;
  isProcessed?: boolean;
  frequency?: 'QD' | 'BID' | 'TID' | 'QID' | 'QHS' | 'QAM' | 'QPM' | 'PRN' | 'Q#H' | 'STAT';
  frequency_hours?: number;
  associated_diagnosis?: string;
}

interface DisbursementFormProps {
  encounterId?: string;
  queueItemId?: string;
  disabled?: boolean;
  mode?: 'create' | 'view' | 'edit' | 'pharmacy';
  initialDisbursements?: any[];
  onDisbursementsChange: (disbursements: any[]) => void;
  onDisbursementComplete?: () => void;
  currentDiagnoses?: { id: string; name: string; }[];
}

export const DisbursementForm: React.FC<DisbursementFormProps> = ({
  encounterId,
  queueItemId,
  disabled = false,
  mode,
  initialDisbursements = [],
  onDisbursementsChange,
  onDisbursementComplete,
  currentDiagnoses = [],
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
    associated_diagnosis?: string;
    notes?: string;
    frequency?: 'QD' | 'BID' | 'TID' | 'QID' | 'QHS' | 'QAM' | 'QPM' | 'PRN' | 'Q#H' | 'STAT';
    frequency_hours?: number;
  }>>(new Map());

  // Track medications that were deleted from their initial state
  const [deletedMedications, setDeletedMedications] = useState<Map<string, {
    quantity: number;
    multiplier: number;
    wasRestored: boolean;
  }>>(new Map());

  // Track initial state of disbursements
  const [initialDisbursementState, setInitialDisbursementState] = useState<{
    medication: string;
    quantity: number;
    disbursement_multiplier: number;
    medicationDetails?: MedicationRecord;
    notes?: string;
    frequency?: string;
    frequency_hours?: number;
    associated_diagnosis?: string;
  }[]>([]);

  // Initialize disbursements and their initial state
  useEffect(() => {
    if (initialDisbursements?.length) {
      console.log('DEBUG: Initial disbursements received:', initialDisbursements.map(d => ({
        id: d.id,
        medication: d.medication,
        associated_diagnosis: d.associated_diagnosis,
        raw: d
      })));

      const newInitialState = new Map();
      const processedDisbursements = initialDisbursements.map(d => {
        // Only track initial state for disbursements that have an ID (exist in database)
        if (d.medication && d.id) {
          console.log('DEBUG: Processing disbursement for initial state:', {
            id: d.id,
            medication: d.medication,
            associated_diagnosis: d.associated_diagnosis,
            raw: d
          });
          
          newInitialState.set(d.medication, {
            quantity: d.quantity,
            multiplier: d.disbursement_multiplier,
            id: d.id,
            medicationDetails: d.medicationDetails,
            associated_diagnosis: d.associated_diagnosis,
            notes: d.notes,
            frequency: d.frequency as 'QD' | 'BID' | 'TID' | 'QID' | 'QHS' | 'QAM' | 'QPM' | 'PRN' | 'Q#H' | 'STAT',
            frequency_hours: d.frequency_hours
          });
        }
        return { ...d };
      });

      console.log('DEBUG: Processed disbursements:', processedDisbursements.map(d => ({
        id: d.id,
        medication: d.medication,
        associated_diagnosis: d.associated_diagnosis,
        raw: d
      })));
      
      // Only set initial state if it hasn't been set before
      setInitialMedicationState(prev => {
        const newState = prev.size === 0 ? newInitialState : prev;
        console.log('DEBUG: Setting initial medication state:', {
          hadPreviousState: prev.size > 0,
          newStateEntries: Array.from(newState.entries()).map(([key, value]) => ({
            medication: key,
            associated_diagnosis: value.associated_diagnosis
          }))
        });
        return newState;
      });
      
      setDisbursements(processedDisbursements);
    }
  }, [initialDisbursements]);

  useEffect(() => {
    if (initialDisbursements) {
      // Reset disbursements and their initial state when initialDisbursements changes
      setDisbursements(initialDisbursements);
      // Store the initial state for stock change calculations
      setInitialDisbursementState(initialDisbursements.map(d => ({
        medication: d.medication,
        quantity: d.quantity,
        disbursement_multiplier: d.disbursement_multiplier,
        medicationDetails: d.medicationDetails,
        notes: d.notes,
        frequency: d.frequency,
        frequency_hours: d.frequency_hours,
        associated_diagnosis: d.associated_diagnosis
      })));
    }
  }, [initialDisbursements]);

  const handleAddDisbursement = () => {
    const newDisbursement = {
      medication: '',
      quantity: 1,
      disbursement_multiplier: 1,
      notes: '',
      frequency: 'QD' as const, // Set default frequency
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
    const newDisbursements = [...disbursements];
    
    if (disbursement.id) {
      // This is an existing disbursement - mark it for deletion but keep tracking it
      console.log('STOCK DEBUG: [DELETE] Marking existing disbursement for deletion:', {
        medication: disbursement.medicationDetails?.drug_name,
        id: disbursement.id,
        wasInitial: initialMedicationState.has(disbursement.medication)
      });
      
      disbursement.markedForDeletion = true;
      newDisbursements[index] = disbursement;
      setDisbursements(newDisbursements);
      onDisbursementsChange(newDisbursements);
    } else {
      // This is a new disbursement - just remove it
      console.log('STOCK DEBUG: [DELETE] Removing new disbursement:', {
        medication: disbursement.medicationDetails?.drug_name,
        wasNew: true
      });
      
      const filteredDisbursements = disbursements.filter((_, i) => i !== index);
      setDisbursements(filteredDisbursements);
      onDisbursementsChange(filteredDisbursements);
    }
  };

  // Calculate stock changes based on initial state
  const calculateStockChange = (disbursement: DisbursementItem, index: number) => {
    if (!disbursement.medicationDetails || !disbursement.medication) return null;

    const currentQuantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
    const initialState = initialDisbursementState[index];
    
    // If this is a new disbursement (no ID), show the pending change
    if (!disbursement.id) {
      return -currentQuantity;
    }
    
    // If this disbursement matches its initial state, return null to show "No Change"
    if (initialState && 
        initialState.medication === disbursement.medication &&
        initialState.quantity === disbursement.quantity &&
        initialState.disbursement_multiplier === disbursement.disbursement_multiplier) {
      return null;
    }

    // If the medication changed, calculate full change
    if (!initialState || initialState.medication !== disbursement.medication) {
      return -currentQuantity;
    }

    // Calculate change from initial state
    const initialQuantity = initialState.quantity * (initialState.disbursement_multiplier || 1);
    return initialQuantity - currentQuantity;
  };

  const handleDisbursementChange = (
    index: number,
    field: keyof DisbursementItem,
    value: any
  ) => {
    console.log('DEBUG: Disbursement change:', {
      index,
      field,
      value,
      currentDisbursement: disbursements[index]
    });

    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};
    const previousMedicationId = disbursement.medication;

    if (field === 'associated_diagnosis') {
      console.log('DEBUG: Handling associated_diagnosis change:', {
        oldValue: disbursement.associated_diagnosis,
        newValue: value,
        disbursementId: disbursement.id,
        medication: disbursement.medication
      });
      
      disbursement.associated_diagnosis = value;
      newDisbursements[index] = disbursement;
      setDisbursements(newDisbursements);
      onDisbursementsChange(newDisbursements);
      return;
    }
    
    if (field === 'notes' || field === 'frequency' || field === 'frequency_hours') {
      disbursement[field] = value;
      newDisbursements[index] = disbursement;
      setDisbursements(newDisbursements);
      onDisbursementsChange(newDisbursements);
      return;
    }
    
    if (field === 'medication') {
      const medicationId = typeof value === 'object' ? value?.id : value;
      
      // If in pharmacy mode and we have an existing disbursement ID, preserve it
      const shouldPreserveId = mode === 'pharmacy' && disbursement.id;
      
      // If changing from one medication to another, and the previous was an initial medication
      if (previousMedicationId && previousMedicationId !== medicationId && 
          initialMedicationState.has(previousMedicationId) && !shouldPreserveId) {
        const initialStateForPrevious = initialMedicationState.get(previousMedicationId);
        console.log('STOCK DEBUG: [REMOVE] Via medication change:', {
          from: disbursement.medicationDetails?.drug_name,
          wasInitial: true,
          initialState: initialStateForPrevious,
          currentInitialState: Array.from(initialMedicationState.entries())
        });
        
        // Only track deletion if not in pharmacy mode
        if (mode !== 'pharmacy') {
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
          currentInitialState: Array.from(initialMedicationState.entries()),
          preservingId: shouldPreserveId
        });
        
        if (wasInitialMedication && initialState && !shouldPreserveId) {
          // This was part of the initial state - always use initial quantities as reference
          disbursement.quantity = initialState.quantity;
          disbursement.disbursement_multiplier = initialState.multiplier;
          disbursement.id = initialState.id; // Restore the original ID
          disbursement.associated_diagnosis = initialState.associated_diagnosis; // Restore associated diagnosis
          disbursement.notes = initialState.notes; // Restore notes
          disbursement.frequency = initialState.frequency; // Restore frequency
          disbursement.frequency_hours = initialState.frequency_hours; // Restore frequency hours
          
          console.log('STOCK DEBUG: [RESTORE] Using initial state:', {
            medication: medicationRecord?.drug_name,
            quantity: initialState.quantity,
            multiplier: initialState.multiplier,
            total: initialState.quantity * initialState.multiplier,
            restoredId: initialState.id,
            associated_diagnosis: initialState.associated_diagnosis,
            notes: initialState.notes,
            frequency: initialState.frequency,
            frequency_hours: initialState.frequency_hours
          });
        } else if (medicationRecord) {
          // In pharmacy mode, keep the existing ID and fields
          if (!shouldPreserveId) {
            disbursement.id = undefined;
            // Only clear these fields if not preserving state
            disbursement.associated_diagnosis = undefined;
            disbursement.notes = '';
            disbursement.frequency = 'QD';
            disbursement.frequency_hours = undefined;
          }
          // Set new quantities
          disbursement.quantity = medicationRecord.fixed_quantity;
          disbursement.disbursement_multiplier = 1;
        }
      } else {
        // If clearing the medication, track removal if it was initial and not in pharmacy mode
        if (previousMedicationId && initialMedicationState.has(previousMedicationId) && mode !== 'pharmacy') {
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
        // Only clear these fields if not in pharmacy mode
        if (!mode || mode !== 'pharmacy') {
          disbursement.id = undefined;
          disbursement.associated_diagnosis = undefined;
          disbursement.notes = '';
          disbursement.frequency = 'QD';
          disbursement.frequency_hours = undefined;
        }
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

  // Update the debug view to show deletion status
  const renderDebugState = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    const debugState = {
      initialState: Object.fromEntries(initialMedicationState),
      deletedState: Object.fromEntries(deletedMedications),
      currentDisbursements: disbursements.map(d => ({
        medication: d.medicationDetails?.drug_name,
        quantity: d.quantity,
        multiplier: d.disbursement_multiplier,
        id: d.id,
        markedForDeletion: d.markedForDeletion,
        status: d.id 
          ? (d.markedForDeletion ? 'Marked for Deletion' : 'Existing') 
          : 'New'
      }))
    };
    
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
        <Typography variant="subtitle2">Debug State:</Typography>
        <pre style={{ fontSize: '0.8em' }}>
          {JSON.stringify(debugState, null, 2)}
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
          {disbursements.map((disbursement, index) => {
            const stockChange = calculateStockChange(disbursement, index);
            const medication = disbursement.medicationDetails;
            const isProcessed = mode === 'pharmacy' && disbursement.isProcessed;
            const showStockChange = !disbursement.markedForDeletion && stockChange !== null;

            if (disbursement.markedForDeletion) return null;

            return (
              <Grid container spacing={2} alignItems="center" key={index} sx={{ mb: 2 }}>
                {/* Medication Selection - wider now */}
                <Grid item xs={4}>
                  <Autocomplete
                    value={medication || null}
                    onChange={(_, newValue) => handleDisbursementChange(index, 'medication', newValue)}
                    options={medications || []}
                    getOptionLabel={(option) => option.drug_name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Medication"
                        size="small"
                        disabled={disabled || isProcessed}
                      />
                    )}
                  />
                </Grid>

                {/* Fixed Quantity - narrower */}
                <Grid item xs={1}>
                  <TextField
                    fullWidth
                    label="Qty"
                    type="number"
                    size="small"
                    value={disbursement.quantity}
                    onChange={(e) => handleDisbursementChange(index, 'quantity', e.target.value)}
                    disabled={true}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Multiplier - narrower */}
                <Grid item xs={1}>
                  <TextField
                    fullWidth
                    label="×"
                    type="number"
                    size="small"
                    value={disbursement.disbursement_multiplier}
                    onChange={(e) => handleDisbursementChange(index, 'disbursement_multiplier', e.target.value)}
                    disabled={disabled || isProcessed}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Stock and Change Display */}
                <Grid item xs={1}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Stock: {medication?.stock || 0}
                    </Typography>
                    {!disbursement.markedForDeletion && (
                      <Typography
                        variant="body2"
                        color="error.main"
                        sx={{ fontWeight: 'medium' }}
                      >
                        ({-calculateTotalQuantity(disbursement)})
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {/* Frequency */}
                <Grid item xs={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={disbursement.frequency || 'QD'}
                      onChange={(e) => handleDisbursementChange(index, 'frequency', e.target.value)}
                      disabled={disabled || isProcessed}
                      label="Frequency"
                    >
                      <MenuItem value="QD">QD (Once daily)</MenuItem>
                      <MenuItem value="BID">BID (Twice daily)</MenuItem>
                      <MenuItem value="TID">TID (Three times daily)</MenuItem>
                      <MenuItem value="QID">QID (Four times daily)</MenuItem>
                      <MenuItem value="QHS">QHS (At bedtime)</MenuItem>
                      <MenuItem value="QAM">QAM (Every morning)</MenuItem>
                      <MenuItem value="QPM">QPM (Every evening)</MenuItem>
                      <MenuItem value="PRN">PRN (As needed)</MenuItem>
                      <MenuItem value="Q#H">Q#H (Every # hours)</MenuItem>
                      <MenuItem value="STAT">STAT (Immediately)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Hours field if Q#H is selected */}
                {disbursement.frequency === 'Q#H' && (
                  <Grid item xs={1}>
                    <TextField
                      fullWidth
                      label="Hours"
                      type="number"
                      size="small"
                      value={disbursement.frequency_hours || ''}
                      onChange={(e) => handleDisbursementChange(index, 'frequency_hours', e.target.value)}
                      disabled={disabled || isProcessed}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                )}

                {/* Associated Diagnosis - before Notes */}
                <Grid item xs={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Associated Diagnosis</InputLabel>
                    <Select
                      value={disbursement.associated_diagnosis || ''}
                      onChange={(e) => handleDisbursementChange(index, 'associated_diagnosis', e.target.value)}
                      disabled={disabled || isProcessed}
                      label="Associated Diagnosis"
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {currentDiagnoses.map((diagnosis) => (
                        <MenuItem key={diagnosis.id} value={diagnosis.id}>
                          {diagnosis.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Notes - adjust width based on Q#H and diagnosis field */}
                <Grid item xs={disbursement.frequency === 'Q#H' ? 1 : 1}>
                  <TextField
                    fullWidth
                    label="Notes"
                    size="small"
                    value={disbursement.notes}
                    onChange={(e) => handleDisbursementChange(index, 'notes', e.target.value)}
                    disabled={disabled || isProcessed}
                  />
                </Grid>

                {/* Delete button */}
                <Grid item xs={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconButton
                      onClick={() => handleRemoveDisbursement(index)}
                      disabled={disabled || isProcessed}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Grid>
              </Grid>
            );
          })}
          {mode !== 'view' && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddDisbursement}
                disabled={disabled}
              >
                Add Medication
              </Button>
            </Box>
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
