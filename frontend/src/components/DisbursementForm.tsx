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
  frequency?: 'QD' | 'BID' | 'TID' | 'QID' | 'QHS' | 'QAM' | 'QPM' | 'PRN' | 'Q#H' | 'STAT';
  frequency_hours?: number;
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

  // Track initial state of disbursements
  const [initialDisbursementState, setInitialDisbursementState] = useState<{
    medication: string;
    quantity: number;
    disbursement_multiplier: number;
    medicationDetails?: MedicationRecord;
  }[]>([]);

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

  useEffect(() => {
    if (initialDisbursements) {
      // Reset disbursements and their initial state when initialDisbursements changes
      setDisbursements(initialDisbursements);
      // Store the initial state for stock change calculations
      setInitialDisbursementState(initialDisbursements.map(d => ({
        medication: d.medication,
        quantity: d.quantity,
        disbursement_multiplier: d.disbursement_multiplier,
        medicationDetails: d.medicationDetails
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
    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};
    const previousMedicationId = disbursement.medication;
    
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
          
          console.log('STOCK DEBUG: [RESTORE] Using initial state:', {
            medication: medicationRecord?.drug_name,
            quantity: initialState.quantity,
            multiplier: initialState.multiplier,
            total: initialState.quantity * initialState.multiplier,
            restoredId: initialState.id
          });
        } else if (medicationRecord) {
          // In pharmacy mode, keep the existing ID
          if (!shouldPreserveId) {
            disbursement.id = undefined;
          }
          // Set new quantities
          disbursement.quantity = medicationRecord.fixed_quantity;
          disbursement.disbursement_multiplier = 1;
          
          console.log('STOCK DEBUG: [NEW] Setting new medication:', {
            medication: medicationRecord.drug_name,
            currentStock: medicationRecord.stock,
            fixedQuantity: medicationRecord.fixed_quantity,
            isCompletelyNew: !shouldPreserveId,
            preservingId: shouldPreserveId
          });
        }
      } else {
        // If clearing the medication, track removal if it was initial and not in pharmacy mode
        if (previousMedicationId && initialMedicationState.has(previousMedicationId) && mode !== 'pharmacy') {
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
        // Only clear ID if not in pharmacy mode
        if (mode !== 'pharmacy') {
          disbursement.id = undefined;
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
          {disbursements.map((disbursement, index) => (
            <Box 
              key={index} 
              sx={{ 
                mb: 2, 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 2,
                opacity: disbursement.markedForDeletion ? 0.5 : 1,
                position: 'relative'
              }}
            >
              {disbursement.markedForDeletion && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    position: 'absolute', 
                    top: -10, 
                    left: 0, 
                    color: 'error.main',
                    backgroundColor: 'background.paper',
                    px: 1
                  }}
                >
                  Marked for Deletion
                </Typography>
              )}
              <Box sx={{ flex: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      options={medications || []}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        const parts = [];
                        parts.push(option.drug_name);
                        if (option.dose) parts.push(option.dose);
                        if (option.unit_size) parts.push(`(${option.unit_size})`);
                        return parts.join(' ');
                      }}
                      filterOptions={(options, { inputValue }) => {
                        const searchTerms = inputValue.toLowerCase().split(' ');
                        return options.filter(option => {
                          if (typeof option === 'string') return false;
                          const drugName = option.drug_name.toLowerCase();
                          const category = option.drug_category.toLowerCase();
                          
                          // Check if all search terms are found in either drug name or category
                          return searchTerms.every(term => 
                            drugName.includes(term) || category.includes(term)
                          );
                        });
                      }}
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
                          fullWidth
                          placeholder="Search by name or category..."
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box sx={{ 
                            width: '100%', 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <Typography>
                              {option.drug_name}
                              {option.dose && ` ${option.dose}`}
                              {option.unit_size && ` (${option.unit_size})`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                              {option.drug_category}
                            </Typography>
                          </Box>
                        </li>
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
                              color: calculateStockChange(disbursement, index) === null ? 'text.secondary' : 'error.main'
                            }}
                          >
                            {(() => {
                              const stockChange = calculateStockChange(disbursement, index);
                              if (stockChange === null) {
                                return 'No Change (Initial)';
                              }
                              return `→ ${disbursement.medicationDetails.stock + stockChange} (${stockChange})`;
                            })()}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth>
                      <InputLabel>Frequency</InputLabel>
                      <Select
                        value={disbursement.frequency || 'QD'}
                        label="Frequency"
                        onChange={(e) => handleDisbursementChange(index, 'frequency', e.target.value)}
                        disabled={disabled}
                      >
                        <MenuItem value="QD">Once daily (QD)</MenuItem>
                        <MenuItem value="BID">Twice daily (BID)</MenuItem>
                        <MenuItem value="TID">Three times daily (TID)</MenuItem>
                        <MenuItem value="QID">Four times daily (QID)</MenuItem>
                        <MenuItem value="QHS">At bedtime (QHS)</MenuItem>
                        <MenuItem value="QAM">Every morning (QAM)</MenuItem>
                        <MenuItem value="QPM">Every evening (QPM)</MenuItem>
                        <MenuItem value="PRN">As needed (PRN)</MenuItem>
                        <MenuItem value="Q#H">Every # hours (Q#H)</MenuItem>
                        <MenuItem value="STAT">Immediately (STAT)</MenuItem>
                      </Select>
                    </FormControl>
                    {disbursement.frequency === 'Q#H' && (
                      <TextField
                        fullWidth
                        label="Hours"
                        type="number"
                        value={disbursement.frequency_hours || ''}
                        onChange={(e) => handleDisbursementChange(index, 'frequency_hours', e.target.value)}
                        disabled={disabled}
                        InputProps={{
                          inputProps: {
                            min: 1,
                            max: 24
                          }
                        }}
                        sx={{ mt: 2 }}
                      />
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
