import React, { useState, useEffect, useCallback } from 'react';
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
import UndoIcon from '@mui/icons-material/Undo';
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

  // Add a ref to track local state changes
  const [localStateChanges, setLocalStateChanges] = useState<Map<string, boolean>>(new Map());

  // Modify useEffect to respect local state changes
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

        // Check if this disbursement has a local state change
        const shouldBeDeleted = d.id ? localStateChanges.get(d.id) : false;
        return { ...d, markedForDeletion: shouldBeDeleted ?? false };
      });

      // Only set initial state if it hasn't been set before
      setInitialMedicationState(prev => {
        const newState = prev.size === 0 ? newInitialState : prev;
        return newState;
      });

      setDisbursements(processedDisbursements);
    }
  }, [initialDisbursements, localStateChanges]);

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
    console.log('DEBUG: handleRemoveDisbursement called', {
      index,
      currentDisbursement: disbursements[index],
      allDisbursements: disbursements.map(d => ({
        id: d.id,
        medication: d.medication,
        markedForDeletion: d.markedForDeletion
      }))
    });

    const disbursementToUpdate = { ...disbursements[index] };
    
    // If this is a new disbursement (no ID), remove it immediately
    if (!disbursementToUpdate.id) {
      const newDisbursements = disbursements.filter((_, idx) => idx !== index);
      setDisbursements(newDisbursements);
      onDisbursementsChange(newDisbursements);
      return;
    }

    // Otherwise, handle existing disbursement deletion
    disbursementToUpdate.markedForDeletion = true;

    // Update local state changes map
    setLocalStateChanges(prev => {
      const newChanges = new Map(prev);
      newChanges.set(disbursementToUpdate.id!, true);
      return newChanges;
    });

    const newDisbursements = disbursements.map((d, idx) => 
      idx === index ? disbursementToUpdate : d
    );

    console.log('DEBUG: After marking for deletion', {
      updatedDisbursement: disbursementToUpdate,
      allNewDisbursements: newDisbursements.map(d => ({
        id: d.id,
        medication: d.medication,
        markedForDeletion: d.markedForDeletion
      }))
    });

    setDisbursements(newDisbursements);

    setDeletedMedications(prev => {
      const newDeletedMeds = new Map(prev);
      newDeletedMeds.set(disbursementToUpdate.id!, {
        quantity: disbursementToUpdate.quantity,
        multiplier: disbursementToUpdate.disbursement_multiplier,
        wasRestored: false
      });
      return newDeletedMeds;
    });

    onDisbursementsChange(newDisbursements);
  };

  // Update getAvailableMedications to handle both deleted and removed items
  const getAvailableMedications = useCallback((currentIndex: number) => {
    if (!medications) return [];
    
    // Get all currently selected medications except the current index
    // For new items that were removed, they won't be in the list at all
    // For existing items that were marked for deletion, we still need to exclude them
    const selectedMedications = disbursements
      .filter((d, idx) => idx !== currentIndex && !d.markedForDeletion)
      .map(d => d.medication);
    
    // Return only medications that aren't already selected
    return medications.filter(med => !selectedMedications.includes(med.id));
  }, [medications, disbursements]);

  // Modify the medication selection rendering to use available medications
  const renderMedicationSelect = (index: number, disbursement: DisbursementItem) => {
    const availableMedications = getAvailableMedications(index);
    const isDeleted = disbursement.markedForDeletion;

    return (
      <Autocomplete
        value={disbursement.medicationDetails || null}
        onChange={(_, newValue) => handleDisbursementChange(index, 'medication', newValue)}
        options={availableMedications}
        getOptionLabel={(option) => option.drug_name || ''}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Medication"
            size="small"
            required
            error={!disbursement.medication && !isDeleted}
          />
        )}
        disabled={disabled || isDeleted}
        sx={{
          opacity: isDeleted ? 0.5 : 1,
          textDecoration: isDeleted ? 'line-through' : 'none',
          width: '100%',
          '& .MuiInputBase-root': {
            minHeight: '40px',
            height: 'auto',
            paddingRight: '39px !important' // Ensure space for dropdown arrow
          },
          '& .MuiAutocomplete-input': {
            padding: '0 !important'  // Remove extra padding from input
          }
        }}
      />
    );
  };

  // Calculate stock changes based on initial state and current disbursements
  const calculateStockChange = (disbursement: DisbursementItem, index: number) => {
    if (!disbursement.medicationDetails || !disbursement.medication || disbursement.markedForDeletion) {
      return null;
    }

    const currentTotalQuantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
    
    // Get all current disbursements for this medication (excluding marked for deletion)
    const allDisbursementsForMed = disbursements.filter((d, idx) => 
      d.medication === disbursement.medication && 
      !d.markedForDeletion &&
      idx !== index  // Exclude current disbursement to avoid double counting
    );

    // Calculate total quantity being disbursed for this medication
    const totalDisbursedQuantity = allDisbursementsForMed.reduce((total, d) => 
      total + (d.quantity * (d.disbursement_multiplier || 1)), 0
    ) + currentTotalQuantity;

    // Get initial stock level
    const initialStock = disbursement.medicationDetails.stock || 0;
    
    // Return the change in stock (negative means reduction)
    return -totalDisbursedQuantity;
  };

  const handleDisbursementChange = (
    index: number,
    field: keyof DisbursementItem,
    value: any
  ) => {
    console.log('DEBUG: handleDisbursementChange called', {
      index,
      field,
      value,
      currentDisbursement: disbursements[index]
    });

    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};

    // If this is a medication being restored, clear the deletion flag
    if (field === 'markedForDeletion' && value === false) {
      console.log('DEBUG: Attempting to restore medication', {
        previousState: disbursement.markedForDeletion,
        newState: value
      });
      
      disbursement.markedForDeletion = false;
      
      // Clear local state change
      if (disbursement.id) {
        setLocalStateChanges(prev => {
          const newChanges = new Map(prev);
          newChanges.delete(disbursement.id!);
          return newChanges;
        });
      }

      newDisbursements[index] = disbursement;
      setDisbursements(newDisbursements);
      onDisbursementsChange(newDisbursements);
      return;
    }

    // Handle medication change
    if (field === 'medication') {
      const medicationId = typeof value === 'object' ? value?.id : value;
      
      disbursement.markedForDeletion = false;
      disbursement.medication = medicationId;
      disbursement.medicationDetails = value;
      
      // Reset quantity and multiplier when medication changes
      disbursement.quantity = value?.fixed_quantity || 1;
      disbursement.disbursement_multiplier = 1;
    } else {
      // For quantity and multiplier changes, validate against current stock
      if (field === 'quantity' || field === 'disbursement_multiplier') {
        const newValue = Number(value) || 0;
        const currentStock = disbursement.medicationDetails?.stock || 0;
        const otherDisbursementsTotal = disbursements
          .filter((d, idx) => d.medication === disbursement.medication && idx !== index && !d.markedForDeletion)
          .reduce((total, d) => total + (d.quantity * (d.disbursement_multiplier || 1)), 0);
        
        // Calculate total after this change
        const newTotal = field === 'quantity' 
          ? newValue * (disbursement.disbursement_multiplier || 1)
          : (disbursement.quantity || 0) * newValue;
        
        // Only update if we have enough stock
        if (newTotal + otherDisbursementsTotal <= currentStock) {
          disbursement[field] = newValue;
        }
      } else {
        disbursement[field] = value;
      }
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
    // Just close the confirmation dialog and call the parent's callback
    setShowConfirmation(false);
    
    if (onDisbursementComplete) {
      onDisbursementComplete();
    }
  };

  // Update the debug view to show more comprehensive state
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
        rawDisbursement: {
          ...d,
          medicationDetails: undefined // Exclude circular reference
        },
        deletionTracked: d.id ? deletedMedications.has(d.id) : false,
        status: d.id 
          ? (d.markedForDeletion ? 'Marked for Deletion' : 'Existing') 
          : 'New'
      })),
      disbursementCount: disbursements.length,
      activeCount: disbursements.filter(d => !d.markedForDeletion).length,
      deletedCount: disbursements.filter(d => d.markedForDeletion).length,
      stateSnapshot: {
        timestamp: new Date().toISOString(),
        hasRealtimeUpdates: !!medications?.length
      }
    };
    
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
        <Typography variant="subtitle2">Debug State:</Typography>
        <pre style={{ fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
            const isDeleted = disbursement.markedForDeletion;
            const medication = disbursement.medicationDetails;
            const currentStock = medication?.stock || 0;
            const isProcessed = mode === 'pharmacy' && disbursement.isProcessed;
            const totalQuantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
            
            // Only calculate stock-related values if a medication is selected
            const hasMedication = !!disbursement.medication;
            const otherDisbursementsTotal = hasMedication ? disbursements
              .filter((d, idx) => d.medication === disbursement.medication && idx !== index && !d.markedForDeletion)
              .reduce((total, d) => total + (d.quantity * (d.disbursement_multiplier || 1)), 0) : 0;
            
            // Calculate the actual change in stock, accounting for initial state
            const initialState = disbursement.id ? initialMedicationState.get(disbursement.medication) : null;
            const initialQuantity = initialState ? initialState.quantity * (initialState.multiplier || 1) : 0;
            
            // For new medications, show the full deduction
            // For existing medications, only show the difference from initial state
            const stockChangeAmount = disbursement.id
              ? totalQuantity - initialQuantity  // Only show the difference for existing medications
              : totalQuantity;                   // Show full amount for new medications
            
            const hasStockChange = hasMedication && stockChangeAmount !== 0;
            const exceedsStock = hasMedication && (totalQuantity + otherDisbursementsTotal > currentStock);

            return (
              <Grid 
                container 
                spacing={2} 
                alignItems="center" 
                key={index} 
                sx={{ 
                  mb: 2, 
                  opacity: isDeleted ? 0.7 : 1,
                  backgroundColor: isDeleted ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  transition: 'all 0.3s ease-in-out',
                  padding: 1,
                  borderRadius: 1,
                  position: 'relative',
                  border: isDeleted ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
                  '&::before': isDeleted ? {
                    content: '"Marked for Deletion"',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'text.secondary',
                    fontSize: '1.2rem',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    pointerEvents: 'none',
                    zIndex: 1,
                    textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)'
                  } : {}
                }}
              >
                {/* Medication Selection */}
                <Grid item xs={12} sm={3} sx={{ 
                  opacity: isDeleted ? 0.3 : 1,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {renderMedicationSelect(index, disbursement)}
                </Grid>

                {/* Quantity and Multiplier Group */}
                <Grid item container xs={12} sm={3} spacing={1} sx={{ opacity: isDeleted ? 0.3 : 1 }}>
                  <Grid item xs={6} sm={4}>
                    <TextField
                      fullWidth
                      label="Qty"
                      type="number"
                      size="small"
                      value={disbursement.quantity}
                      disabled={true}
                      InputLabelProps={{ shrink: true }}
                      error={hasMedication && exceedsStock}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField
                      fullWidth
                      label="×"
                      type="number"
                      size="small"
                      value={disbursement.disbursement_multiplier}
                      onChange={(e) => handleDisbursementChange(index, 'disbursement_multiplier', e.target.value)}
                      disabled={disabled || isProcessed || isDeleted || !hasMedication}
                      InputLabelProps={{ shrink: true }}
                      error={hasMedication && exceedsStock}
                      helperText={hasMedication && exceedsStock ? "Exceeds available stock" : ""}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'row', sm: 'column' }, 
                      alignItems: 'center',
                      justifyContent: { xs: 'space-between', sm: 'center' },
                      px: { xs: 0, sm: 1 },
                      height: '100%',
                      minHeight: '40px'
                    }}>
                      <Typography variant="body2" color="text.secondary">
                        Stock: {hasMedication ? currentStock : '-'}
                      </Typography>
                      {hasMedication && !isDeleted && hasStockChange && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'medium',
                            ml: { xs: 2, sm: 0 },
                            color: 'error.main'
                          }}
                        >
                          ({-stockChangeAmount})
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                {/* Frequency Group */}
                <Grid item xs={12} sm={2} sx={{ opacity: isDeleted ? 0.3 : 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={disbursement.frequency || 'QD'}
                      onChange={(e) => handleDisbursementChange(index, 'frequency', e.target.value)}
                      disabled={disabled || isProcessed || isDeleted || !hasMedication}
                      label="Frequency"
                    >
                      <MenuItem value="QD">QD</MenuItem>
                      <MenuItem value="BID">BID</MenuItem>
                      <MenuItem value="TID">TID</MenuItem>
                      <MenuItem value="QID">QID</MenuItem>
                      <MenuItem value="QHS">QHS</MenuItem>
                      <MenuItem value="QAM">QAM</MenuItem>
                      <MenuItem value="QPM">QPM</MenuItem>
                      <MenuItem value="PRN">PRN</MenuItem>
                      <MenuItem value="Q#H">Q#H</MenuItem>
                      <MenuItem value="STAT">STAT</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Hours field - only show if Q#H selected */}
                {disbursement.frequency === 'Q#H' && (
                  <Grid item xs={6} sm={1} sx={{ opacity: isDeleted ? 0.3 : 1 }}>
                    <TextField
                      fullWidth
                      label="Hours"
                      type="number"
                      size="small"
                      value={disbursement.frequency_hours || ''}
                      onChange={(e) => handleDisbursementChange(index, 'frequency_hours', e.target.value)}
                      disabled={disabled || isProcessed || isDeleted || !hasMedication}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                )}

                {/* Associated Diagnosis */}
                <Grid item xs={12} sm={2} sx={{ opacity: isDeleted ? 0.3 : 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Diagnosis</InputLabel>
                    <Select
                      value={disbursement.associated_diagnosis || ''}
                      onChange={(e) => handleDisbursementChange(index, 'associated_diagnosis', e.target.value)}
                      disabled={disabled || isProcessed || isDeleted || !hasMedication}
                      label="Diagnosis"
                    >
                      <MenuItem value="">None</MenuItem>
                      {currentDiagnoses.map((diagnosis) => (
                        <MenuItem key={diagnosis.id} value={diagnosis.id}>
                          {diagnosis.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Notes */}
                <Grid item xs={12} sm={disbursement.frequency === 'Q#H' ? 1.5 : 1.5} sx={{ opacity: isDeleted ? 0.3 : 1 }}>
                  <TextField
                    fullWidth
                    label="Notes"
                    size="small"
                    value={disbursement.notes}
                    onChange={(e) => handleDisbursementChange(index, 'notes', e.target.value)}
                    disabled={disabled || isProcessed || isDeleted || !hasMedication}
                  />
                </Grid>

                {/* Delete/Restore Button - No opacity reduction */}
                <Grid item xs={12} sm={0.5}>
                  <IconButton
                    onClick={() => isDeleted ? 
                      handleDisbursementChange(index, 'markedForDeletion', false) : 
                      handleRemoveDisbursement(index)}
                    disabled={disabled || isProcessed}
                    color={isDeleted ? "primary" : "default"}
                    sx={{ opacity: 1 }}  // Force full opacity for the undo button
                  >
                    {isDeleted ? <UndoIcon /> : <DeleteIcon />}
                  </IconButton>
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
