import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
  IconButton,
  Divider,
  Autocomplete,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { pb } from '../atoms/auth';
import { BaseModel } from 'pocketbase';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { DisbursementForm } from '../components/DisbursementForm';
import type { DisbursementItem, MedicationRecord } from '../components/DisbursementForm';
import EncounterQuestions from '../components/EncounterQuestions';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

type QueueStatus = 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'at_checkout' | 'completed';

interface QueueItem extends BaseModel {
  patient: string;
  status: QueueStatus;
  assigned_to?: string;
  check_in_time: string;
  start_time?: string;
  end_time?: string;
  priority: number;
  line_number: number;
  expand?: {
    patient: {
      first_name: string;
      last_name: string;
    };
    assigned_to?: {
      id: string;
      username: string;
    };
    encounter?: {
      id: string;
    };
  };
}

interface Patient extends BaseModel {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
}

interface ChiefComplaint extends BaseModel {
  name: string;
  id: string;
  created: string;
  updated: string;
}

interface Disbursement extends BaseModel {
  encounter: string;
  medication: string;
  quantity: number;
  notes: string;
  expand?: {
    medication: MedicationRecord;
  };
}

interface InventoryItem extends BaseModel {
  drug_name: string;
  stock: number;
  unit: string;
  notes: string;
}

interface DisbursementWithId extends DisbursementItem {
  id?: string;  // Track if this is an existing disbursement
  isProcessed?: boolean;  // Track if this has been processed by pharmacy
}

interface EncounterRecord extends BaseModel {
  patient?: string;
  height_inches: number | null;
  weight: number | null;
  temperature: number | null;
  heart_rate: number | null;
  systolic_pressure: number | null;
  diastolic_pressure: number | null;
  chief_complaint?: string;
  other_chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  assessment?: string;
  plan?: string;
  disbursements: DisbursementWithId[];
  expand?: {
    chief_complaint?: {
      id: string;
      name: string;
    };
  };
}

interface EncounterProps {
  mode?: 'create' | 'view' | 'edit' | 'pharmacy' | 'checkout';
}

interface SavedEncounter {
  id: string;
  [key: string]: any;
}

export interface QuestionResponse extends BaseModel {
  encounter: string;
  question: string;
  response_value: string | boolean | number | null;
  expand?: {
    question?: EncounterQuestion;
  }
}

interface ExistingDisbursement extends BaseModel {
  encounter: string;
  medication: string;
  quantity: number;
  notes: string;
  processed?: boolean;
  expand?: {
    medication: MedicationRecord;
  };
}

interface EncounterQuestion extends BaseModel {
  id: string;
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  description?: string;
  options?: string[];
  category: string;
  order: number;
  required?: boolean;
  depends_on?: string;
  archived?: boolean;
  expand?: {
    category?: {
      type: 'counter' | 'survey';
    }
  }
}

interface EncounterResponseRecord extends BaseModel {
  encounter: string;
  question: string;
  response_value: string | boolean | number | null;
  expand?: {
    question?: EncounterQuestion;
  }
}

export type EncounterMode = 'create' | 'edit' | 'view' | 'pharmacy' | 'checkout';

export const Encounter: React.FC<EncounterProps> = ({ mode: initialMode = 'create' }) => {
  const { patientId, encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isNewEncounter, setIsNewEncounter] = useState(true);
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItem | null>(null);

  // Memoize the mode determination to prevent unnecessary re-renders
  const currentMode = React.useMemo(() => {
    const locationMode = location.state?.mode;
    const computedMode = (locationMode || initialMode);
    
    // If we're in checkout status, force checkout mode
    if (currentQueueItem?.status === 'at_checkout') {
      return 'checkout' as const;
    }
    
    return (computedMode === 'create' || (isNewEncounter && computedMode !== 'pharmacy')) ? 'edit' : computedMode;
  }, [location.state?.mode, initialMode, isNewEncounter, currentQueueItem?.status]);

  console.log('Current mode:', currentMode, 'Initial mode:', initialMode, 'Is new encounter:', isNewEncounter, 'Queue status:', currentQueueItem?.status);

  const [formData, setFormData] = useState<Partial<EncounterRecord>>({
    patient: patientId,
    height_inches: location.state?.initialVitals?.height_inches ?? null,
    weight: location.state?.initialVitals?.weight ?? null,
    temperature: location.state?.initialVitals?.temperature ?? null,
    heart_rate: location.state?.initialVitals?.heart_rate ?? null,
    systolic_pressure: location.state?.initialVitals?.systolic_pressure ?? null,
    diastolic_pressure: location.state?.initialVitals?.diastolic_pressure ?? null,
    chief_complaint: '',
    history_of_present_illness: '',
    past_medical_history: '',
    assessment: '',
    plan: '',
    disbursements: [],
  });
  const [chiefComplaints, setChiefComplaints] = useState<ChiefComplaint[]>([]);
  const [showOtherComplaint, setShowOtherComplaint] = useState(false);
  const [otherComplaintValue, setOtherComplaintValue] = useState('');
  const [questionResponses, setQuestionResponses] = useState<QuestionResponse[]>([]);
  const [savedEncounter, setSavedEncounter] = useState<SavedEncounter | null>(null);

  const OTHER_COMPLAINT_VALUE = '__OTHER__';

  useEffect(() => {
    const loadData = async () => {
      if (!patientId) {
        navigate('/patients');
        return;
      }
      try {
        // Load patient data and chief complaints
        const [patientRecord, complaintsResult] = await Promise.all([
          pb.collection('patients').getOne(patientId, {
            $autoCancel: false
          }),
          pb.collection('chief_complaints').getList<ChiefComplaint>(1, 50, {
            sort: 'name',
            $autoCancel: false
          })
        ]);
        
        setPatient(patientRecord as Patient);
        setChiefComplaints(complaintsResult.items.filter((c, index, self) => 
          index === self.findIndex(t => t.name === c.name)
        ));

        // Load encounter data if viewing, editing, or in pharmacy mode
        if (encounterId && (currentMode === 'view' || currentMode === 'edit' || currentMode === 'pharmacy')) {
          const [encounterRecord, disbursements] = await Promise.all([
            pb.collection('encounters').getOne<EncounterRecord>(encounterId, { 
              expand: 'chief_complaint',
              $autoCancel: false
            }),
            pb.collection('disbursements').getList(1, 50, {
              filter: `encounter = "${encounterId}"`,
              expand: 'medication',
              $autoCancel: false
            })
          ]);

          // Convert disbursements to DisbursementItems
          const disbursementItems = (disbursements.items as Disbursement[]).map(d => {
            const medication = d.expand?.medication as MedicationRecord;
            const multiplier = medication ? d.quantity / medication.fixed_quantity : 1;
            
            return {
              id: d.id,
              medication: d.medication,
              quantity: medication?.fixed_quantity || d.quantity,
              disbursement_multiplier: multiplier,
              notes: d.notes || '',
              medicationDetails: medication,
              isProcessed: d.processed || false
            };
          });

          const chiefComplaintName = encounterRecord.expand?.chief_complaint?.name || '';
          
          if (chiefComplaintName === 'OTHER (Custom Text Input)') {
            setShowOtherComplaint(true);
            setOtherComplaintValue(encounterRecord.other_chief_complaint || '');
          }

          setFormData({
            ...encounterRecord,
            height_inches: encounterRecord.height_inches,
            weight: encounterRecord.weight,
            temperature: encounterRecord.temperature,
            heart_rate: encounterRecord.heart_rate,
            systolic_pressure: encounterRecord.systolic_pressure,
            diastolic_pressure: encounterRecord.diastolic_pressure,
            chief_complaint: chiefComplaintName,
            disbursements: disbursementItems.length > 0 ? disbursementItems : [{
              medication: '',
              quantity: 1,
              disbursement_multiplier: 1,
              notes: '',
            }]
          });
        } else {
          // For new encounters, check if we have initial vitals from state
          const initialVitals = location.state?.initialVitals;
          if (initialVitals) {
            setFormData(prev => ({
              ...prev,
              height_inches: initialVitals.height_inches ?? null,
              weight: initialVitals.weight ?? null,
              temperature: initialVitals.temperature ?? null,
              heart_rate: initialVitals.heart_rate ?? null,
              systolic_pressure: initialVitals.systolic_pressure ?? null,
              diastolic_pressure: initialVitals.diastolic_pressure ?? null,
            }));
          }
        }
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading data:', error);
        if (!error?.message?.includes('autocancelled') && 
            !error?.message?.includes('aborted') && 
            !error?.isAbort) {
          alert('Error loading encounter data. Please try again.');
          navigate('/patients');
        }
      }
    };
    loadData();
  }, [patientId, encounterId, currentMode, navigate, location.state?.initialVitals]);

  // Subscribe to queue changes with auto-cancellation disabled
  const { records: queueRecords } = useRealtimeSubscription<QueueItem>(
    'queue',
    patientId ? {
      filter: `patient = "${patientId}" && status != "completed"`,
      expand: 'patient,assigned_to,encounter',
      $autoCancel: false  // Prevent auto-cancellation
    } : {}
  );

  // Update currentQueueItem when queue records change
  useEffect(() => {
    console.log('Queue records updated:', queueRecords);
    if (!queueRecords || queueRecords.length === 0) {
      console.log('No queue records found, clearing currentQueueItem');
      setCurrentQueueItem(null);
      return;
    }
    
    // Get the most recent queue item
    const latestQueueItem = queueRecords[0];
    console.log('Setting current queue item:', latestQueueItem);
    setCurrentQueueItem(latestQueueItem);

    // If we're in pharmacy mode and don't have patient data yet, load it
    if (currentMode === 'pharmacy' && !patient && latestQueueItem.patient) {
      console.log('Loading patient data for pharmacy mode');
      pb.collection('patients').getOne(latestQueueItem.patient, {
        $autoCancel: false  // Prevent auto-cancellation
      })
        .then((patientRecord) => {
          console.log('Patient data loaded:', patientRecord);
          setPatient(patientRecord as Patient);
        })
        .catch((error) => {
          // Only show error if it's not an auto-cancellation
          if (!error?.message?.includes('autocancelled') && !error?.isAbort) {
            console.error('Error loading patient data:', error);
          }
        });
    }
  }, [queueRecords, currentMode, patient]);

  // Load patient data when entering pharmacy mode
  useEffect(() => {
    const loadPharmacyData = async () => {
      console.log('Checking pharmacy data load:', { currentMode, patientId, hasPatient: !!patient });
      if (currentMode === 'pharmacy' && patientId && !patient) {
        try {
          console.log('Loading patient data for pharmacy mode');
          const patientRecord = await pb.collection('patients').getOne(patientId, {
            $autoCancel: false  // Prevent auto-cancellation
          });
          console.log('Patient data loaded:', patientRecord);
          setPatient(patientRecord as Patient);
        } catch (error: any) {
          // Only show error if it's not an auto-cancellation
          if (!error?.message?.includes('autocancelled') && !error?.isAbort) {
            console.error('Error loading patient data for pharmacy:', error);
          }
        }
      }
    };
    loadPharmacyData();
  }, [currentMode, patientId, patient]);

  // Handle pharmacy mode specific actions
  const handlePharmacyAction = async (action: 'save' | 'checkout') => {
    console.log('Pharmacy action triggered:', { action, currentQueueItem });
    try {
      if (!currentQueueItem) {
        console.error('No current queue item found');
        return;
      }

      // First save any disbursement changes
      console.log('Saving disbursement changes');
      await saveDisbursementChanges();

      if (action === 'checkout') {
        // Update queue status to at_checkout
        console.log('Sending to checkout');
        await pb.collection('queue').update(currentQueueItem.id, {
          status: 'at_checkout'
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error in pharmacy action:', error);
      alert('Failed to complete pharmacy action: ' + (error as Error).message);
    }
  };

  // Update pharmacy mode buttons
  const renderPharmacyButtons = () => {
    console.log('Rendering pharmacy buttons, mode:', currentMode);
    if (currentMode !== 'pharmacy') return null;

    return (
      <RoleBasedAccess requiredRole="pharmacy">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handlePharmacyAction('checkout')}
          >
            Send to Checkout
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handlePharmacyAction('save')}
          >
            Save Changes
          </Button>
        </Box>
      </RoleBasedAccess>
    );
  };

  const handleInputChange = (field: keyof EncounterRecord) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleComplaintChange = (_event: any, value: string | null) => {
    if (value === 'OTHER (Custom Text Input)') {
      setShowOtherComplaint(true);
      setOtherComplaintValue('');
      setFormData(prev => ({
        ...prev,
        chief_complaint: value,
        other_chief_complaint: '',
      }));
    } else {
      setShowOtherComplaint(false);
      setOtherComplaintValue('');
      setFormData(prev => ({
        ...prev,
        chief_complaint: value || '',
        other_chief_complaint: '',
      }));
    }
  };

  const handleOtherComplaintChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    setOtherComplaintValue(value);
    setFormData(prev => ({
      ...prev,
      other_chief_complaint: value,
    }));
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Form submission started');
    
    try {
      // Log the current state for debugging
      console.log('DEBUG Form Data:', {
        formData,
        mode: currentMode,
        patientId,
        encounterId,
        currentQueueItem
      });

      // Validate vital signs if this is a provider encounter
      if (currentMode !== 'pharmacy' && currentMode !== 'checkout') {
        console.log('DEBUG: Running provider validation');
        
        // Validate chief complaint first as it's always required
        if (!formData.chief_complaint && !formData.other_chief_complaint) {
          const message = 'Please select a chief complaint or enter a custom one';
          console.error('Validation failed:', message);
          alert(message);
          return;
        }
        console.log('DEBUG: Chief complaint validation passed');

        const requiredVitals = [
          { field: 'height_inches', label: 'Height' },
          { field: 'weight', label: 'Weight' },
          { field: 'temperature', label: 'Temperature' },
          { field: 'heart_rate', label: 'Heart Rate' },
          { field: 'systolic_pressure', label: 'Systolic Pressure' },
          { field: 'diastolic_pressure', label: 'Diastolic Pressure' },
        ];

        const missingVitals = requiredVitals.filter(
          vital => {
            const value = formData[vital.field as keyof typeof formData];
            console.log('DEBUG: Checking vital:', vital.field, 'Value:', value);
            return value === undefined || value === null || value === '';
          }
        );

        if (missingVitals.length > 0) {
          const message = `Please fill in all required vital signs:\n\n${missingVitals.map(v => v.label).join('\n')}`;
          console.error('Validation failed:', message);
          alert(message);
          return;
        }
        console.log('DEBUG: Vitals validation passed');
      }

      // Prepare encounter data
      const encounterData = {
        patient: patientId,
        // Only include chief_complaint if it's not "OTHER (Custom Text Input)"
        chief_complaint: formData.chief_complaint === 'OTHER (Custom Text Input)' ? null : 
          chiefComplaints.find(c => c.name === formData.chief_complaint)?.id || null,
        other_chief_complaint: formData.other_chief_complaint || '',
        subjective_notes: formData.subjective_notes || '',
        // Ensure these fields are properly typed for PocketBase
        height_inches: formData.height_inches ? Number(formData.height_inches) : null,
        weight: formData.weight ? Number(formData.weight) : null,
        temperature: formData.temperature ? Number(formData.temperature) : null,
        heart_rate: formData.heart_rate ? Number(formData.heart_rate) : null,
        systolic_pressure: formData.systolic_pressure ? Number(formData.systolic_pressure) : null,
        diastolic_pressure: formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null,
      };

      console.log('DEBUG: Prepared encounter data:', encounterData);

      let savedEncounter: SavedEncounter;
      try {
        // Always update if we have an encounterId, regardless of mode
        if (encounterId) {
          console.log('DEBUG: Updating existing encounter:', encounterId);
          // Update existing encounter
          savedEncounter = await pb.collection('encounters').update(encounterId, encounterData);
          console.log('DEBUG: Update successful:', savedEncounter);

          // Save disbursements if in pharmacy mode or if there are any disbursements
          if (currentMode === 'pharmacy' || (formData.disbursements && formData.disbursements.length > 0)) {
            console.log('DEBUG: Saving disbursements');
            await saveDisbursementChanges();
          }

          // Process all responses in a single batch
          console.log('DEBUG: Processing responses:', 
            questionResponses.map(r => ({
              question: r.expand?.question?.question_text,
              value: r.response_value,
              type: r.expand?.question?.input_type,
              isDependent: !!r.expand?.question?.depends_on,
              hasId: !!r.id,
              id: r.id
            }))
          );

          // First, get all existing responses for this encounter
          const existingResponses = await pb.collection('encounter_responses').getList<EncounterResponseRecord>(1, 200, {
            filter: `encounter = "${encounterId}"`,
            expand: 'question'
          });

          // Create a map of existing responses by question ID
          const existingResponseMap = new Map<string, EncounterResponseRecord>(
            existingResponses.items.map(r => [r.question, r])
          );

          // Process each response
          for (const response of questionResponses) {
            const existingResponse = existingResponseMap.get(response.question);
            
            if (existingResponse) {
              // Update existing response if value changed
              if (JSON.stringify(existingResponse.response_value) !== JSON.stringify(response.response_value)) {
                await pb.collection('encounter_responses').update(existingResponse.id, {
                  response_value: response.response_value
                });
              }
              // Remove from map to track which ones need to be deleted
              existingResponseMap.delete(response.question);
            } else {
              // Create new response
              await pb.collection('encounter_responses').create({
                encounter: encounterId,
                question: response.question,
                response_value: response.response_value
              });
            }
          }

          // Delete any remaining responses that weren't in the current set
          for (const [_, response] of Array.from(existingResponseMap)) {
            await pb.collection('encounter_responses').delete(response.id);
          }
        } else {
          console.log('DEBUG: Creating new encounter');
          savedEncounter = await pb.collection('encounters').create(encounterData);
          console.log('DEBUG: Create successful:', savedEncounter);

          // Save disbursements for new encounter
          if (formData.disbursements && formData.disbursements.length > 0) {
            console.log('DEBUG: Saving disbursements for new encounter');
            await saveDisbursementChanges();
          }

          // Process responses in sequence to avoid race conditions
          for (const response of questionResponses) {
            try {
              await pb.collection('encounter_responses').create({
                encounter: savedEncounter.id,
                question: response.question,
                response_value: response.response_value
              });
            } catch (error) {
              console.error('[Save Error]', {
                question: response.expand?.question?.question_text,
                error
              });
              throw error;
            }
          }
        }

        // Update queue item with encounter ID if needed
        if (currentQueueItem && savedEncounter) {
          console.log('DEBUG: Updating queue item with encounter ID');
          await pb.collection('queue').update(currentQueueItem.id, {
            encounter: savedEncounter.id
          });
        }

        // Show success message
        alert('Encounter saved successfully');

        // If this was a new encounter, navigate to the edit mode with the new ID
        if (!encounterId && savedEncounter.id) {
          navigate(`/encounter/${patientId}/${savedEncounter.id}/edit`);
          return;
        }
      } catch (error: any) {
        console.error('DEBUG: Error saving encounter:', {
          error,
          errorMessage: error.message,
          errorData: error.data,
          originalError: error.originalError
        });
        alert('Failed to save encounter: ' + error.message);
        throw error;
      }
    } catch (error: any) {
      // Handle any errors
      console.error('DEBUG: Form submission error:', {
        error,
        errorMessage: error.message,
        errorData: error.data,
        originalError: error.originalError
      });
      const errorMessage = error.message || 'An unknown error occurred';
      alert(`Failed to save encounter: ${errorMessage}\nPlease try again.`);
    }
  };

  const handleEdit = () => {
    navigate(`/encounter/${patientId}/${encounterId}/edit`);
  };

  const handleBack = () => {
    // Always go back to patient dashboard when viewing an encounter
    navigate(`/patient/${patientId}`);
  };

  const handleQueueStatusChange = async (newStatus: QueueStatus) => {
    if (!currentQueueItem) return;

    try {
      // First save any pending changes
      if (currentMode === 'edit' || currentMode === 'pharmacy') {
        // In pharmacy mode, directly call saveDisbursementChanges
        if (currentMode === 'pharmacy') {
          await saveDisbursementChanges();
        } else {
          // For edit mode, use the form submission approach
          const form = document.createElement('form');
          const nativeEvent = new Event('submit', { bubbles: true, cancelable: true });
          
          let defaultPrevented = false;
          let propagationStopped = false;
          
          const syntheticEvent = {
            preventDefault: () => { defaultPrevented = true; },
            target: form,
            currentTarget: form,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            eventPhase: 0,
            isTrusted: true,
            timeStamp: Date.now(),
            type: 'submit',
            nativeEvent,
            stopPropagation: () => { propagationStopped = true; },
            stopImmediatePropagation: () => { propagationStopped = true; },
            persist: () => {},
            isDefaultPrevented: () => defaultPrevented,
            isPropagationStopped: () => propagationStopped
          } as unknown as React.FormEvent<HTMLFormElement>;

          await handleSubmit(syntheticEvent);
        }
      }

      // Then update the queue status
      await pb.collection('queue').update(currentQueueItem.id, {
        status: newStatus,
        ...(newStatus === 'completed' ? {
          end_time: new Date().toISOString()
        } : {})
      });
      
      // Only navigate after both operations are complete
      if (newStatus === 'completed' || newStatus === 'ready_pharmacy') {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error updating queue status:', error);
      alert('Failed to update queue status');
    }
  };

  const saveDisbursementChanges = async () => {
    try {
      console.log('DEBUG: Starting saveDisbursementChanges with formData:', {
        allDisbursements: formData.disbursements,
        encounterId
      });

      // Only process disbursements that aren't marked for deletion
      const validDisbursements = formData.disbursements?.filter(d => 
        d.medication && 
        d.quantity > 0 && 
        !d.markedForDeletion
      ) || [];

      // Track disbursements marked for deletion separately
      const markedForDeletion = formData.disbursements?.filter(d => 
        d.id && 
        d.markedForDeletion
      ) || [];

      console.log('DEBUG: Filtered disbursements:', {
        validCount: validDisbursements.length,
        markedForDeletionCount: markedForDeletion.length,
        markedForDeletion
      });

      // Get existing disbursements and medications in a single batch
      const [existingDisbursementsResult, medicationsResult] = await Promise.all([
        pb.collection('disbursements').getList<ExistingDisbursement>(1, 50, {
          filter: `encounter = "${encounterId}"`,
          expand: 'medication'
        }),
        Promise.all(validDisbursements.map(d => 
          pb.collection('inventory').getOne<MedicationRecord>(d.medication)
        ))
      ]);

      console.log('DEBUG: ID Verification:', {
        markedForDeletion: markedForDeletion.map(d => ({
          id: d.id,
          medication: d.medicationDetails?.drug_name,
          fromForm: true
        })),
        existingInDB: existingDisbursementsResult.items.map(d => ({
          id: d.id,
          medication: d.expand?.medication?.drug_name,
          fromDB: true
        }))
      });

      const existingMap = new Map<string, ExistingDisbursement>(
        existingDisbursementsResult.items.map(d => [d.id, d])
      );

      // First handle deletions to free up stock
      for (const disbursement of markedForDeletion) {
        if (!disbursement.id) continue;

        console.log('DEBUG: Attempting deletion:', {
          formDisbursementId: disbursement.id,
          existsInDB: existingMap.has(disbursement.id),
          dbRecord: existingMap.get(disbursement.id),
          medication: disbursement.medicationDetails?.drug_name
        });

        const existing = existingMap.get(disbursement.id);
        if (existing && !existing.processed) {
          try {
            console.log('DEBUG: Attempting to delete disbursement:', {
              id: disbursement.id,
              existing: existing
            });
            
            // Delete the disbursement
            await pb.collection('disbursements').delete(disbursement.id);
            console.log('DEBUG: Successfully deleted disbursement');
            
            // Remove from existingMap so it's not processed again
            existingMap.delete(disbursement.id);
          } catch (error: any) {
            console.error('DEBUG: Error deleting disbursement:', {
              error,
              status: error?.status,
              response: error?.response,
              originalError: error?.originalError
            });
            throw error;
          }
        } else {
          console.log('DEBUG: Skipping deletion - disbursement already processed or not found');
        }
      }

      // Now verify stock levels for remaining valid disbursements
      for (const disbursement of validDisbursements) {
        const medication = medicationsResult.find(m => m.id === disbursement.medication);
        if (!medication) continue;

        const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
        
        // Only check stock for new or modified disbursements
        const existing = disbursement.id ? existingMap.get(disbursement.id) : null;
        if (!existing || existing.quantity !== quantity) {
          // For existing disbursements, only check the difference
          const stockChange = existing ? quantity - existing.quantity : quantity;
          const newStockLevel = medication.stock - stockChange;
          if (newStockLevel < 0) {
            throw new Error(`Not enough stock for ${medication.drug_name}. Available: ${medication.stock}, Needed: ${stockChange}`);
          }
        }
      }

      // Process all valid disbursements in sequence to prevent race conditions
      const processedDisbursements: Record<string, any>[] = [];
      for (const disbursement of validDisbursements) {
        const medication = medicationsResult.find(m => m.id === disbursement.medication);
        if (!medication) continue;

        const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
        
        if (disbursement.id) {
          // Update existing disbursement
          const existing = existingMap.get(disbursement.id);
          if (existing) {
            existingMap.delete(disbursement.id);

            // In pharmacy mode, we might be changing the medication
            const medicationChanged = existing.medication !== disbursement.medication;
            
            if (medicationChanged || existing.quantity !== quantity || existing.notes !== disbursement.notes) {
              // If medication changed, we need to handle stock for both old and new medication
              if (medicationChanged) {
                // Restore stock for old medication
                const oldMedication = await pb.collection('inventory').getOne<MedicationRecord>(existing.medication);
                await pb.collection('inventory').update(existing.medication, {
                  stock: oldMedication.stock + existing.quantity
                });
                
                // Reduce stock for new medication
                await pb.collection('inventory').update(disbursement.medication, {
                  stock: medication.stock - quantity
                });
              } else if (existing.quantity !== quantity) {
                // Only update stock if quantity changed
                const stockChange = quantity - existing.quantity;
                if (stockChange !== 0) {
                  // Get fresh medication record to ensure accurate stock
                  const updatedMedication = await pb.collection('inventory').getOne<MedicationRecord>(disbursement.medication);
                  const newStock = updatedMedication.stock - stockChange;
                  
                  if (newStock < 0) {
                    throw new Error(`Not enough stock for ${updatedMedication.drug_name}. Available: ${updatedMedication.stock}, Needed: ${quantity}`);
                  }

                  // Update stock first
                  try {
                    await pb.collection('inventory').update(disbursement.medication, {
                      stock: newStock,
                      disbursement_multiplier: 1 // Ensure this is set to prevent validation errors
                    });
                  } catch (error: any) {
                    console.error('DEBUG: Error updating inventory:', {
                      error,
                      medication: updatedMedication.drug_name,
                      currentStock: updatedMedication.stock,
                      requestedQuantity: quantity,
                      calculatedNewStock: newStock
                    });
                    throw error;
                  }
                }
              }
              
              // Update the disbursement record
              const updated = await pb.collection('disbursements').update(disbursement.id, {
                medication: disbursement.medication,
                quantity: quantity,
                notes: disbursement.notes || ''
              });
              processedDisbursements.push(updated);
            } else {
              processedDisbursements.push(existing);
            }
          }
        } else {
          // Create new disbursement
          // Get fresh medication record to ensure accurate stock
          const updatedMedication = await pb.collection('inventory').getOne<MedicationRecord>(disbursement.medication);
          const newStock = updatedMedication.stock - quantity;
          
          if (newStock < 0) {
            throw new Error(`Not enough stock for ${updatedMedication.drug_name}. Available: ${updatedMedication.stock}, Needed: ${quantity}`);
          }

          // Update stock first
          try {
            await pb.collection('inventory').update(disbursement.medication, {
              stock: newStock,
              disbursement_multiplier: 1 // Ensure this is set to prevent validation errors
            });
          } catch (error: any) {
            console.error('DEBUG: Error updating inventory:', {
              error,
              medication: updatedMedication.drug_name,
              currentStock: updatedMedication.stock,
              requestedQuantity: quantity,
              calculatedNewStock: newStock
            });
            throw error;
          }
          
          // Then create disbursement
          const created = await pb.collection('disbursements').create({
            encounter: encounterId,
            medication: disbursement.medication,
            quantity: quantity,
            notes: disbursement.notes || '',
            processed: false
          });
          processedDisbursements.push(created);
        }
      }

      // Update form data with processed disbursements to prevent double creation
      setFormData(prev => {
        // If we have no valid disbursements and some were marked for deletion,
        // we should clear the disbursements array
        if (validDisbursements.length === 0 && markedForDeletion.length > 0) {
          console.log('DEBUG: Clearing all disbursements from form data');
          return {
            ...prev,
            disbursements: []
          };
        }

        // Otherwise update with processed disbursements
        console.log('DEBUG: Updating form data with processed disbursements:', processedDisbursements);
        return {
          ...prev,
          disbursements: processedDisbursements.map(d => ({
            id: d.id,
            medication: d.medication,
            quantity: d.quantity,
            disbursement_multiplier: d.disbursement_multiplier || 1,
            notes: d.notes || '',
            medicationDetails: d.expand?.medication
          }))
        };
      });

      alert('Changes saved successfully');
    } catch (error) {
      console.error('Error saving disbursement changes:', error);
      alert('Failed to save changes: ' + (error as Error).message);
      throw error;
    }
  };

  // Add realtime subscription for disbursements
  const { records: disbursementRecords } = useRealtimeSubscription<Disbursement>(
    'disbursements',
    encounterId ? {
      filter: `encounter = "${encounterId}"`,
      expand: 'medication'
    } : {}
  );

  // Update form data when disbursements change
  useEffect(() => {
    if (!disbursementRecords) return;

    // Convert disbursements to DisbursementItems
    const disbursementItems = disbursementRecords.map(d => {
      const medication = d.expand?.medication as MedicationRecord;
      const multiplier = medication ? d.quantity / medication.fixed_quantity : 1;
      
      return {
        id: d.id,
        medication: d.medication,
        quantity: medication?.fixed_quantity || d.quantity,
        disbursement_multiplier: multiplier,
        notes: d.notes || '',
        medicationDetails: medication,
        isProcessed: d.processed || false,
        originalQuantity: medication?.fixed_quantity || d.quantity,
        originalMultiplier: multiplier
      };
    });

    // Only update if the disbursements have actually changed
    setFormData(prev => {
      // If we have local changes in progress, don't override them with realtime updates
      if (prev.disbursements?.some(d => !d.id && d.medication)) {
        return {
          ...prev,
          disbursements: prev.disbursements.map(d => {
            // Only update existing disbursements from realtime
            if (d.id) {
              const updatedItem = disbursementItems.find(item => item.id === d.id);
              return updatedItem || d;
            }
            return d;
          })
        };
      }

      // Otherwise, use the realtime data
      return {
        ...prev,
        disbursements: disbursementItems.length > 0 ? disbursementItems : [{
          medication: '',
          quantity: 1,
          disbursement_multiplier: 1,
          notes: '',
        }]
      };
    });
  }, [disbursementRecords]);

  // Subscribe to inventory changes
  const { records: inventoryRecords } = useRealtimeSubscription<InventoryItem>(
    'inventory'
  );

  // Update disbursement details when inventory changes
  useEffect(() => {
    if (!inventoryRecords || !formData.disbursements) return;

    // Create a map of inventory items for quick lookup
    const inventoryMap = new Map(inventoryRecords.map(item => [item.id, item]));

    // Only update if the inventory details have actually changed
    setFormData(prev => {
      const prevDisbursements = prev.disbursements || [];
      const updatedDisbursements = prevDisbursements.map(d => {
        if (!d.medication) return d;
        const medication = inventoryMap.get(d.medication);
        if (!medication) return d;
        
        // Only update if the medication details have changed
        if (d.medicationDetails?.stock === medication.stock) return d;
        
        return {
          ...d,
          medicationDetails: medication
        };
      });

      // Check if any disbursements were actually updated
      const hasChanges = updatedDisbursements.some((d, i) => 
        d.medicationDetails?.stock !== prevDisbursements[i].medicationDetails?.stock
      );

      if (!hasChanges) return prev;

      return {
        ...prev,
        disbursements: updatedDisbursements
      };
    });
  }, [inventoryRecords]);

  // Handle checkout mode specific actions
  const handleCheckoutAction = async (action: 'complete' | 'save') => {
    console.log('Checkout action triggered:', { action, currentQueueItem });
    try {
      if (!currentQueueItem) {
        console.error('No current queue item found');
        return;
      }

      // Create a form element
      const form = document.createElement('form');
      
      // Create a native event
      const nativeEvent = new Event('submit', { bubbles: true, cancelable: true });
      
      // Track event state
      let defaultPrevented = false;
      let propagationStopped = false;
      
      // Create a synthetic event using React's event interface
      const syntheticEvent = {
        preventDefault: () => { defaultPrevented = true; },
        target: form,
        currentTarget: form,
        bubbles: true,
        cancelable: true,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: true,
        timeStamp: Date.now(),
        type: 'submit',
        nativeEvent,
        stopPropagation: () => { propagationStopped = true; },
        stopImmediatePropagation: () => { propagationStopped = true; },
        persist: () => {},
        isDefaultPrevented: () => defaultPrevented,
        isPropagationStopped: () => propagationStopped
      } as unknown as React.FormEvent<HTMLFormElement>;

      // First save any changes
      await handleSubmit(syntheticEvent);

      if (action === 'complete') {
        console.log('Processing complete action');
        // Update queue status
        console.log('Updating queue status to completed');
        await pb.collection('queue').update(currentQueueItem.id, {
          status: 'completed',
          end_time: new Date().toISOString()
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error in checkout action:', error);
      alert('Failed to complete checkout action: ' + (error as Error).message);
    }
  };

  // Render checkout mode buttons
  const renderCheckoutButtons = () => {
    console.log('DEBUG Checkout Buttons:', {
      currentMode,
      queueStatus: currentQueueItem?.status,
      queueItem: currentQueueItem,
      location: location.state
    });
    
    if (currentMode !== 'checkout') {
      console.log('Checkout buttons not shown: mode is not checkout');
      return null;
    }

    return (
      <RoleBasedAccess requiredRole="provider">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleCheckoutAction('complete')}
          >
            Complete Checkout
          </Button>
        </Box>
      </RoleBasedAccess>
    );
  };

  // Add debug logging near the button render section
  console.log('DEBUG Action Buttons:', {
    currentMode,
    queueStatus: currentQueueItem?.status,
    showingPharmacyButtons: currentMode === 'pharmacy',
    showingCheckoutButtons: currentMode === 'checkout',
    location: location.state
  });

  // Add function to handle re-adding to queue
  const handleAddToQueue = async () => {
    try {
      if (!patientId || !encounterId) {
        console.error('Missing patient or encounter ID');
        return;
      }

      // Create new queue entry
      const queueData = {
        patient: patientId,
        status: 'at_checkout',
        priority: 3, // Default priority
        check_in_time: new Date().toISOString(),
        encounter: encounterId
      };

      await pb.collection('queue').create(queueData);
      alert('Patient added back to queue in checkout status');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add patient to queue: ' + (error as Error).message);
    }
  };

  if (loading || !patient) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4">
              {currentMode === 'create' ? 'New' : currentMode === 'edit' ? 'Edit' : ''} Encounter for {patient?.first_name} {patient?.last_name}
            </Typography>
          </Box>
          {currentMode === 'view' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<ArrowBack />}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleEdit}
              >
                Edit Encounter
              </Button>
              {!currentQueueItem && (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleAddToQueue}
                >
                  Add to Queue
                </Button>
              )}
            </Box>
          )}
        </Box>
        
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Vitals Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Vitals
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Height (inches)"
                    type="number"
                    value={formData.height_inches}
                    onChange={handleInputChange('height_inches')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Weight (lbs)"
                    type="number"
                    value={formData.weight}
                    onChange={handleInputChange('weight')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Temperature (°F)"
                    type="number"
                    inputProps={{ step: "0.1" }}
                    value={formData.temperature}
                    onChange={handleInputChange('temperature')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Heart Rate (bpm)"
                    type="number"
                    value={formData.heart_rate}
                    onChange={handleInputChange('heart_rate')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Systolic Pressure"
                    type="number"
                    value={formData.systolic_pressure}
                    onChange={handleInputChange('systolic_pressure')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Diastolic Pressure"
                    type="number"
                    value={formData.diastolic_pressure}
                    onChange={handleInputChange('diastolic_pressure')}
                    disabled={currentMode === 'view'}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Subjective Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Subjective
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Autocomplete
                      value={formData.chief_complaint || null}
                      onChange={handleComplaintChange}
                      options={chiefComplaints.map(c => c.name)}
                      disabled={currentMode === 'view'}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Chief Complaint"
                          placeholder="Search complaints..."
                        />
                      )}
                      ListboxProps={{
                        style: {
                          maxHeight: '200px'
                        }
                      }}
                    />
                  </FormControl>
                </Grid>
                {(showOtherComplaint || formData.other_chief_complaint) && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Specify Other Chief Complaint"
                      value={currentMode === 'view' ? formData.other_chief_complaint : otherComplaintValue}
                      onChange={handleOtherComplaintChange}
                      disabled={currentMode === 'view'}
                      placeholder="Enter new chief complaint"
                      helperText="Please use all caps for consistency"
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Subjective Notes"
                    placeholder="Any additional data regarding diagnosis, interesting items, etc."
                    value={formData.subjective_notes || ''}
                    onChange={handleInputChange('subjective_notes')}
                    disabled={currentMode === 'view'}
                    multiline
                    rows={4}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Disbursements Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Disbursements
              </Typography>
              <DisbursementForm
                encounterId={encounterId}
                disabled={currentMode === 'view'}
                mode={currentMode}
                initialDisbursements={formData.disbursements}
                onDisbursementsChange={(disbursements: DisbursementItem[]) => 
                  setFormData(prev => ({ ...prev, disbursements }))
                }
              />
            </Grid>

            {/* Additional Questions Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Additional Questions
                {currentMode !== 'view' && currentMode !== 'pharmacy' && (
                  <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                    * Required fields must be filled for survey questions
                  </Typography>
                )}
              </Typography>
              <EncounterQuestions
                encounterId={encounterId}
                disabled={currentMode === 'view'}
                mode={currentMode}
                defaultExpanded={currentMode === 'checkout'}
                onResponsesChange={(responses: QuestionResponse[]) => {
                  setQuestionResponses(responses);
                }}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                {/* Pharmacy Mode */}
                {currentMode === 'pharmacy' && renderPharmacyButtons()}

                {/* Checkout Mode */}
                {currentMode === 'checkout' && renderCheckoutButtons()}

                {/* Provider Mode */}
                {(currentMode === 'edit' || currentMode === 'create') && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                    >
                      Cancel
                    </Button>
                    {currentMode === 'edit' && !currentQueueItem?.status?.includes('checkout') && currentQueueItem && (
                      <RoleBasedAccess requiredRole="provider">
                        <Button
                          variant="contained"
                          color="secondary"
                          onClick={() => handleQueueStatusChange('ready_pharmacy')}
                        >
                          Ready for Pharmacy
                        </Button>
                      </RoleBasedAccess>
                    )}
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      {currentMode === 'edit' ? 'Save Changes' : 'Save Encounter'}
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default Encounter;

