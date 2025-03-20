import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  Collapse,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { DisbursementConfirmation } from './DisbursementConfirmation';
import { 
  parseMultiplier, 
  isValidMultiplier, 
  calculateDisbursementQuantity,
  calculateSingleDisbursementStockChange
} from '../utils/disbursementUtils';

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
  multiplier: string;  // Always store as string for input handling
  notes?: string;
  originalQuantity?: number;
  originalMultiplier?: number;
  markedForDeletion?: boolean;
  isProcessed?: boolean;
  frequency?: string;
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

// Add debug panel component
const DebugPanel: React.FC<{
  disbursement: DisbursementItem;
  databaseValue?: number;
  onCalculateStockChange: (d: DisbursementItem, index: number) => any;
}> = ({ disbursement, databaseValue, onCalculateStockChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <Paper sx={{ p: 1, my: 1, backgroundColor: '#f5f5f5' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Debug Info</Typography>
        <IconButton size="small" onClick={() => setOpen(!open)}>
          {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify({
              id: disbursement.id,
              medication: disbursement.medicationDetails?.drug_name,
              currentMultiplier: disbursement.multiplier,
              databaseMultiplier: databaseValue,
              currentQuantity: disbursement.quantity,
              fixed_quantity: disbursement.medicationDetails?.fixed_quantity,
              stockChange: onCalculateStockChange(disbursement, -1)
            }, null, 2)}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

// Update DisbursementConfirmation props interface to match the actual component
interface DisbursementConfirmationProps {
  encounterId?: string;
  queueItemId?: string;
  disbursements: DisbursementItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DisbursementForm = forwardRef<
  { resetLocalState: () => void },
  DisbursementFormProps
>((props, ref) => {
  const {
    encounterId,
    queueItemId,
    disabled = false,
    mode = 'create',
    initialDisbursements = [],
    onDisbursementsChange,
    onDisbursementComplete,
    currentDiagnoses = []
  } = props;

  // State for disbursements
  const [disbursements, setDisbursements] = useState<DisbursementItem[]>(initialDisbursements);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [databaseValues, setDatabaseValues] = useState<Map<string, number>>(new Map());
  
  // Track initial state of medications for comparison
  const [initialMedicationState] = useState<Map<string, DisbursementItem>>(
    new Map(initialDisbursements.map(d => [d.id || '', { ...d }]))
  );

  // Subscribe to inventory for medication options
  const { records: medications, loading, error } = useRealtimeSubscription<MedicationRecord>(
    'inventory',
    {
      sort: 'drug_name',
      filter: 'stock > 0'
    }
  );

  // Update parent component when disbursements change
  useEffect(() => {
    onDisbursementsChange(disbursements);
  }, [disbursements, onDisbursementsChange]);

  // Expose resetLocalState method to parent
  useImperativeHandle(ref, () => ({
    resetLocalState: () => {
      // Reset to initial state
      setDisbursements(initialDisbursements);
    }
  }));

  // Calculate stock change for a disbursement
  const calculateStockChange = (disbursement: DisbursementItem, index: number) => {
    if (!disbursement.medicationDetails || !disbursement.medication || disbursement.markedForDeletion) {
      return null;
    }

    // Get all current disbursements for this medication (excluding marked for deletion and current one)
    const otherDisbursements = disbursements.filter((d, idx) => 
      d.medicationDetails?.drug_name === disbursement.medicationDetails?.drug_name &&
      d.medicationDetails?.unit_size === disbursement.medicationDetails?.unit_size &&
      !d.markedForDeletion &&
      idx !== index
    );

    // Get the original disbursement if it exists
    const originalDisbursement = disbursement.id 
      ? initialMedicationState.get(disbursement.id) 
      : null;

    // Use the utility function to calculate stock change
    return calculateSingleDisbursementStockChange(
      disbursement,
      otherDisbursements,
      originalDisbursement || null,
      mode === 'pharmacy'
    );
  };

  // Fix the handleDisbursementChange function to address the 'never' type issue
  const handleDisbursementChange = <T extends keyof DisbursementItem>(
    index: number,
    field: T,
    value: DisbursementItem[T]
  ) => {
    const newDisbursements = [...disbursements];
    const disbursement = {...newDisbursements[index]};

    // If this is a medication being restored, clear the deletion flag
    if (field === 'markedForDeletion' && value === false) {
      disbursement.markedForDeletion = false;
    } else if (field === 'medication') {
      // When medication changes, update medicationDetails and reset quantity/multiplier
      const medication = medications?.find(m => m.id === value);
      disbursement.medicationDetails = medication;
      disbursement.quantity = medication?.fixed_quantity || 1;
      disbursement.multiplier = '1';
      disbursement[field] = value as any;
    } else {
      // For other fields, just update the value
      disbursement[field] = value as any;
    }

    newDisbursements[index] = disbursement;
    setDisbursements(newDisbursements);
  };

  // Add a new disbursement
  const handleAddDisbursement = () => {
    setDisbursements([
      ...disbursements,
      {
        medication: '',
        quantity: 1,
        multiplier: '1',
        notes: '',
        markedForDeletion: false
      }
    ]);
  };

  // Mark a disbursement for deletion
  const handleRemoveDisbursement = (index: number) => {
    const newDisbursements = [...disbursements];
    const disbursement = newDisbursements[index];
    
    // If it has an ID, mark for deletion, otherwise remove it
    if (disbursement.id) {
      disbursement.markedForDeletion = true;
      newDisbursements[index] = disbursement;
    } else {
      newDisbursements.splice(index, 1);
    }
    
    setDisbursements(newDisbursements);
  };

  // Restore a disbursement that was marked for deletion
  const handleRestoreDisbursement = (index: number) => {
    const newDisbursements = [...disbursements];
    newDisbursements[index].markedForDeletion = false;
    setDisbursements(newDisbursements);
  };

  // Render medication select dropdown
  const renderMedicationSelect = (index: number, disbursement: DisbursementItem) => {
    const isDeleted = disbursement.markedForDeletion;
    const isProcessed = mode === 'pharmacy' && disbursement.isProcessed;
    
    return (
      <Autocomplete
        options={medications || []}
        getOptionLabel={(option) => 
          typeof option === 'string' 
            ? option 
            : `${option.drug_name} (${option.unit_size})`
        }
        value={disbursement.medicationDetails || null}
        onChange={(_, newValue) => {
          handleDisbursementChange(index, 'medication', newValue?.id || '');
        }}
        disabled={disabled || isProcessed || isDeleted}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Medication"
            size="small"
            error={!disbursement.medication && disbursements.length > 1}
            sx={{ 
              '& .MuiInputBase-root': {
                height: '32px',
                fontSize: '0.875rem'
              },
              '& .MuiInputLabel-root': {
                transform: 'translate(14px, -12px) scale(0.75)'
              }
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <div>
              <Typography variant="body2">{option.drug_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {option.unit_size} - Stock: {option.stock}
              </Typography>
            </div>
          </li>
        )}
      />
    );
  };

  // Render the form
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
            const totalQuantity = calculateDisbursementQuantity(
              disbursement.quantity, 
              disbursement.multiplier
            );
            
            // Calculate stock change
            const stockChangeResult = calculateStockChange(disbursement, index);
            const exceedsStock = stockChangeResult?.exceedsStock || false;
            const hasMedication = !!disbursement.medication;

            return (
              <Grid 
                container 
                spacing={1} 
                alignItems="center" 
                key={index} 
                sx={{ 
                  mb: 1, 
                  opacity: isDeleted ? 0.7 : 1,
                  backgroundColor: isDeleted ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  transition: 'opacity 0.3s ease-in-out, background-color 0.3s ease-in-out',
                  padding: 0.5,
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
                {/* Medication Name */}
                <Grid item xs={3}>
                  {renderMedicationSelect(index, disbursement)}
                </Grid>

                {/* Quantity */}
                <Grid item style={{ width: '80px' }}>
                  <TextField
                    label="Qty"
                    type="number"
                    size="small"
                    value={disbursement.quantity}
                    disabled={true}
                    InputLabelProps={{ shrink: true }}
                    error={hasMedication && exceedsStock}
                    sx={{ 
                      width: '100%',
                      '& .MuiInputBase-root': {
                        height: '32px',
                        fontSize: '0.875rem'
                      },
                      '& .MuiInputLabel-root': {
                        transform: 'translate(14px, -12px) scale(0.75)'
                      }
                    }}
                  />
                </Grid>

                {/* × symbol */}
                <Grid item sx={{ px: 0, width: 'auto' }}>
                  <Typography>×</Typography>
                </Grid>

                {/* Multiplier */}
                <Grid item style={{ width: '80px' }}>
                  <TextField
                    label="Mult."
                    type="text"
                    size="small"
                    value={disbursement.multiplier?.toString() || ''}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      handleDisbursementChange(index, 'multiplier', inputValue);
                    }}
                    disabled={disabled || isProcessed || isDeleted || !hasMedication}
                    error={hasMedication && !isValidMultiplier(disbursement.multiplier)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ 
                      width: '100%',
                      '& .MuiInputBase-root': {
                        height: '32px',
                        fontSize: '0.875rem'
                      },
                      '& .MuiInputLabel-root': {
                        transform: 'translate(14px, -12px) scale(0.75)'
                      }
                    }}
                  />
                </Grid>

                {/* Total */}
                <Grid item style={{ width: '80px' }}>
                  <TextField
                    label="Total"
                    type="text"
                    size="small"
                    value={totalQuantity}
                    disabled={true}
                    InputLabelProps={{ shrink: true }}
                    error={hasMedication && exceedsStock}
                    sx={{ 
                      width: '100%',
                      '& .MuiInputBase-root': {
                        height: '32px',
                        fontSize: '0.875rem'
                      },
                      '& .MuiInputLabel-root': {
                        transform: 'translate(14px, -12px) scale(0.75)'
                      }
                    }}
                  />
                </Grid>

                {/* Stock Change */}
                {hasMedication && stockChangeResult && (
                  <Grid item style={{ width: '120px' }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      color: exceedsStock ? 'error.main' : 'success.main'
                    }}>
                      <Typography variant="body2">
                        Stock: {currentStock} {exceedsStock ? '❌' : '✓'}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {/* Notes */}
                <Grid item xs>
                  <TextField
                    label="Notes"
                    size="small"
                    value={disbursement.notes || ''}
                    onChange={(e) => handleDisbursementChange(index, 'notes', e.target.value)}
                    disabled={disabled || isProcessed || isDeleted}
                    InputLabelProps={{ shrink: true }}
                    sx={{ 
                      width: '100%',
                      '& .MuiInputBase-root': {
                        height: '32px',
                        fontSize: '0.875rem'
                      },
                      '& .MuiInputLabel-root': {
                        transform: 'translate(14px, -12px) scale(0.75)'
                      }
                    }}
                  />
                </Grid>

                {/* Frequency */}
                <Grid item style={{ width: '120px' }}>
                  <FormControl size="small" fullWidth disabled={disabled || isProcessed || isDeleted}>
                    <InputLabel id={`frequency-label-${index}`} sx={{ transform: 'translate(14px, -12px) scale(0.75)' }}>
                      Frequency
                    </InputLabel>
                    <Select
                      labelId={`frequency-label-${index}`}
                      value={disbursement.frequency || 'QD'}
                      onChange={(e) => handleDisbursementChange(index, 'frequency', e.target.value)}
                      sx={{ 
                        height: '32px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <MenuItem value="QD">QD (once daily)</MenuItem>
                      <MenuItem value="BID">BID (twice daily)</MenuItem>
                      <MenuItem value="TID">TID (three times daily)</MenuItem>
                      <MenuItem value="QID">QID (four times daily)</MenuItem>
                      <MenuItem value="Q#H">Q#H (every # hours)</MenuItem>
                      <MenuItem value="PRN">PRN (as needed)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Hours for Q#H frequency */}
                {disbursement.frequency === 'Q#H' && (
                  <Grid item style={{ width: '80px' }}>
                    <TextField
                      label="Hours"
                      type="number"
                      size="small"
                      value={disbursement.frequency_hours || ''}
                      onChange={(e) => handleDisbursementChange(index, 'frequency_hours', parseInt(e.target.value) || 0)}
                      disabled={disabled || isProcessed || isDeleted}
                      InputLabelProps={{ shrink: true }}
                      sx={{ 
                        width: '100%',
                        '& .MuiInputBase-root': {
                          height: '32px',
                          fontSize: '0.875rem'
                        },
                        '& .MuiInputLabel-root': {
                          transform: 'translate(14px, -12px) scale(0.75)'
                        }
                      }}
                    />
                  </Grid>
                )}

                {/* Associated Diagnosis */}
                {currentDiagnoses.length > 0 && (
                  <Grid item style={{ width: '200px' }}>
                    <FormControl size="small" fullWidth disabled={disabled || isProcessed || isDeleted}>
                      <InputLabel id={`diagnosis-label-${index}`} sx={{ transform: 'translate(14px, -12px) scale(0.75)' }}>
                        For Diagnosis
                      </InputLabel>
                      <Select
                        labelId={`diagnosis-label-${index}`}
                        value={disbursement.associated_diagnosis || ''}
                        onChange={(e) => handleDisbursementChange(index, 'associated_diagnosis', e.target.value)}
                        sx={{ 
                          height: '32px',
                          fontSize: '0.875rem'
                        }}
                      >
                        <MenuItem value="">None</MenuItem>
                        {currentDiagnoses.map(diagnosis => (
                          <MenuItem key={diagnosis.id} value={diagnosis.id}>
                            {diagnosis.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {/* Action Buttons */}
                <Grid item>
                  {isDeleted ? (
                    <IconButton 
                      size="small" 
                      onClick={() => handleRestoreDisbursement(index)}
                      disabled={disabled || isProcessed}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton 
                      size="small" 
                      onClick={() => handleRemoveDisbursement(index)}
                      disabled={disabled || isProcessed}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            );
          })}

          {/* Add Button */}
          {!disabled && (
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddDisbursement}
              sx={{ mt: 1 }}
              disabled={mode === 'view'}
            >
              Add Medication
            </Button>
          )}

          {/* Complete Button for Pharmacy Mode */}
          {mode === 'pharmacy' && onDisbursementComplete && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowConfirmation(true)}
              sx={{ mt: 2 }}
              disabled={disabled || disbursements.some(d => !d.markedForDeletion && !d.isProcessed)}
            >
              Complete Disbursement
            </Button>
          )}

          {/* Confirmation Dialog */}
          {showConfirmation && (
            <DisbursementConfirmation
              encounterId={encounterId}
              queueItemId={queueItemId}
              disbursements={disbursements.filter(d => !d.markedForDeletion)}
              onConfirm={() => {
                setShowConfirmation(false);
                onDisbursementComplete?.();
              }}
              onCancel={() => setShowConfirmation(false)}
            />
          )}
        </>
      )}
    </Box>
  );
});

export default DisbursementForm; 