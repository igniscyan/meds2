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
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { pb } from '../atoms/auth';
import { BaseModel } from 'pocketbase';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { DisbursementForm } from '../components/DisbursementForm';
import type { DisbursementItem, MedicationRecord } from '../components/DisbursementForm';
import EncounterQuestions from '../components/EncounterQuestions';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

type QueueStatus = 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'completed';

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
  mode?: 'create' | 'view' | 'edit' | 'pharmacy';
  queueItem?: QueueItem;
}

interface SavedEncounter {
  id: string;
  [key: string]: any;
}

export interface QuestionResponse extends BaseModel {
  encounter: string;
  question: string;
  response_value: any;
  expand?: {
    question?: {
      question_text: string;
      input_type: 'checkbox' | 'text' | 'select';
      required?: boolean;
      category: string;
      expand?: {
        category?: {
          type: 'counter' | 'survey';
        }
      }
    }
  }
}

export const CHIEF_COMPLAINTS: string[] = [
  "ABDOMINAL PAIN",
  "ANXIETY/NERVOUSNESS",
  "BACK PAIN",
  "CHEST PAIN",
  "COUGH",
  "DEPRESSION",
  "DIARRHEA",
  "DIZZINESS",
  "EARACHE",
  "FATIGUE",
  "FEVER/CHILLS/SWEATS",
  "HEADACHE",
  "JOINT PAIN",
  "NAUSEA",
  "NECK MASS",
  "NUMBNESS",
  "OTHER",
  "PALPITATIONS",
  "RASH",
  "SHORTNESS OF BREATH",
  "SOFT TISSUE INJURY",
  "SORE THROAT",
  "SWOLLEN GLANDS",
  "TENDER NECK",
  "UPPER RESPIRATORY SYMPTOMS",
  "URINARY SYMPTOMS",
  "VAGINAL DISCHARGE",
  "VOMITING",
  "VISION CHANGES",
];

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
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  required?: boolean;
  category: string;
  expand?: {
    category?: {
      type: 'counter' | 'survey';
    }
  }
}

interface EncounterResponseRecord extends BaseModel {
  encounter: string;
  question: string;
  response_value: any;
}

const Encounter: React.FC<EncounterProps> = ({ mode = 'create' }) => {
  const { patientId, encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNewEncounter, setIsNewEncounter] = useState(true);

  // Memoize the mode determination to prevent unnecessary re-renders
  const currentMode = React.useMemo(() => {
    const initialMode = location.state?.mode || mode;
    const computedMode = (initialMode === 'create' || (isNewEncounter && initialMode !== 'pharmacy')) ? 'edit' : initialMode;
    console.log('Mode computation:', { 
      initialMode, 
      isNewEncounter, 
      computedMode, 
      locationState: location.state,
      mode 
    });
    return computedMode;
  }, [location.state?.mode, mode, isNewEncounter]);

  console.log('Current mode:', currentMode, 'Initial mode:', mode, 'Is new encounter:', isNewEncounter);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<Partial<EncounterRecord>>({
    patient: patientId,
    height_inches: null,
    weight: null,
    temperature: null,
    heart_rate: null,
    systolic_pressure: null,
    diastolic_pressure: null,
    chief_complaint: '',
    history_of_present_illness: '',
    past_medical_history: '',
    assessment: '',
    plan: '',
    disbursements: [],
  });
  const [loading, setLoading] = useState(true);
  const [chiefComplaints, setChiefComplaints] = useState<ChiefComplaint[]>([]);
  const [showOtherComplaint, setShowOtherComplaint] = useState(false);
  const [otherComplaintValue, setOtherComplaintValue] = useState('');
  const [questionResponses, setQuestionResponses] = useState<QuestionResponse[]>([]);
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItem | null>(null);
  const [savedEncounter, setSavedEncounter] = useState<SavedEncounter | null>(null);

  const OTHER_COMPLAINT_VALUE = '__OTHER__';

  useEffect(() => {
    const loadData = async () => {
      if (!patientId) {
        navigate('/patients');
        return;
      }
      try {
        // Load patient data
        const [patientRecord, complaintsResult] = await Promise.all([
          pb.collection('patients').getOne(patientId, {
            $autoCancel: false  // Prevent auto-cancellation
          }),
          pb.collection('chief_complaints').getList(1, 50, {
            sort: 'name',
            $autoCancel: false  // Prevent auto-cancellation
          })
        ]);
        
        setPatient(patientRecord as Patient);
        setChiefComplaints(complaintsResult.items as ChiefComplaint[]);

        // Load encounter data if viewing, editing, or in pharmacy mode
        if (encounterId && (currentMode === 'view' || currentMode === 'edit' || currentMode === 'pharmacy')) {
          const [encounterRecord, disbursements] = await Promise.all([
            pb.collection('encounters').getOne<EncounterRecord>(encounterId, { 
              expand: 'chief_complaint',
              $autoCancel: false  // Prevent auto-cancellation
            }),
            pb.collection('disbursements').getList(1, 50, {
              filter: `encounter = "${encounterId}"`,
              expand: 'medication',
              $autoCancel: false  // Prevent auto-cancellation
            })
          ]);

          // Convert disbursements to DisbursementItems
          const disbursementItems = (disbursements.items as Disbursement[]).map(d => {
            // Calculate the multiplier based on the actual quantity and the medication's fixed quantity
            const medication = d.expand?.medication as MedicationRecord;
            const multiplier = medication ? d.quantity / medication.fixed_quantity : 1;
            
            return {
              id: d.id,  // Keep track of existing disbursement ID
              medication: d.medication,
              quantity: medication?.fixed_quantity || d.quantity,
              disbursement_multiplier: multiplier,
              notes: d.notes || '',
              medicationDetails: medication,
              isProcessed: d.processed || false
            };
          });

          // Get the chief complaint name from the expanded relation
          const chiefComplaintName = encounterRecord.expand?.chief_complaint?.name || '';
          
          // If the chief complaint is "OTHER (Custom Text Input)", show the custom complaint
          if (chiefComplaintName === 'OTHER (Custom Text Input)') {
            setShowOtherComplaint(true);
            setOtherComplaintValue(encounterRecord.other_chief_complaint || '');
          }

          setFormData({
            ...encounterRecord,
            chief_complaint: chiefComplaintName,
            disbursements: disbursementItems.length > 0 ? disbursementItems : [{
              medication: '',
              quantity: 1,
              disbursement_multiplier: 1,
              notes: '',
            }]
          });
        }
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading data:', error);
        // Only navigate away if it's not an auto-cancellation and not an abort error
        if (!error?.message?.includes('autocancelled') && 
            !error?.message?.includes('aborted') && 
            !error?.isAbort) {
          alert('Error loading encounter data. Please try again.');
          navigate('/patients');
        }
      }
    };
    loadData();
  }, [patientId, encounterId, currentMode, navigate]);

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
  const handlePharmacyAction = async (action: 'complete' | 'save') => {
    console.log('Pharmacy action triggered:', { action, currentQueueItem });
    try {
      if (!currentQueueItem) {
        console.error('No current queue item found');
        return;
      }

      // First save any disbursement changes
      console.log('Saving disbursement changes');
      await saveDisbursementChanges();

      if (action === 'complete') {
        console.log('Processing complete action');
        // Mark all disbursements as processed
        const validDisbursements = formData.disbursements?.filter(d => d.medication && d.quantity > 0) || [];
        console.log('Valid disbursements to process:', validDisbursements);
        
        for (const disbursement of validDisbursements) {
          if (disbursement.id) {
            console.log('Marking disbursement as processed:', disbursement);
            await pb.collection('disbursements').update(disbursement.id, {
              processed: true
            });
          }
        }

        // Update queue status
        console.log('Updating queue status to completed');
        await pb.collection('queue').update(currentQueueItem.id, {
          status: 'completed',
          end_time: new Date().toISOString()
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
        <>
          <Button
            variant="outlined"
            onClick={handleBack}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => handlePharmacyAction('save')}
          >
            Save Changes
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handlePharmacyAction('complete')}
          >
            Medications Disbursed
          </Button>
        </>
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

  const handleComplaintChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
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
        chief_complaint: value,
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
    try {
      console.log('Starting form submission with responses:', questionResponses);

      // Get all required survey questions first
      const allRequiredQuestions = await pb.collection('encounter_questions').getList<EncounterQuestion>(1, 100, {
        filter: 'required = true',
        expand: 'category',
      });

      console.log('Found required questions:', allRequiredQuestions.items);

      // Filter to only survey questions that are actually required
      const requiredSurveyQuestions = allRequiredQuestions.items.filter(question => 
        question.expand?.category?.type === 'survey' && question.required
      );

      console.log('Filtered survey questions:', requiredSurveyQuestions);

      // Check for missing required questions
      const missingRequiredQuestions = requiredSurveyQuestions.filter(question => {
        const response = questionResponses.find(r => r.question === question.id);
        console.log('Checking question:', question.question_text, 'Response:', response);
        
        // If no response exists at all, it's missing
        if (!response) return true;

        const value = response.response_value;
        const questionType = response.expand?.question?.input_type || question.input_type;
        
        // Handle different input types
        switch (questionType) {
          case 'select':
            return !value || value === '';
          case 'text':
            return !value || value.trim() === '';
          case 'checkbox':
            // For checkboxes, undefined/null is invalid, but false is valid
            return value === undefined || value === null;
          default:
            return true;
        }
      });

      console.log('Missing required questions:', missingRequiredQuestions);

      if (missingRequiredQuestions.length > 0) {
        const missingFields = missingRequiredQuestions
          .map(q => q.question_text)
          .filter(Boolean);

        alert(`Please fill in all required survey questions:\n\n${missingFields.join('\n')}`);
        return;
      }

      // Get the ID of the selected complaint
      let chiefComplaintId = null;
      if (formData.chief_complaint) {
        const selectedComplaint = chiefComplaints.find(c => c.name === formData.chief_complaint);
        if (selectedComplaint) {
          chiefComplaintId = selectedComplaint.id;
        }
      }

      // Validate vital signs if this is a provider encounter
      if (currentMode !== 'pharmacy') {
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
            return value === undefined || value === null || value === '';
          }
        );

        if (missingVitals.length > 0) {
          alert(`Please fill in all required vital signs:\n\n${missingVitals.map(v => v.label).join('\n')}`);
          return;
        }

        // Validate chief complaint
        if (!chiefComplaintId && !formData.other_chief_complaint) {
          alert('Please select a chief complaint or enter a custom one');
          return;
        }
      }

      // Convert string values to numbers for numeric fields
      const encounterData = {
        patient: patientId,
        height_inches: formData.height_inches ? Number(formData.height_inches) : null,
        weight: formData.weight ? Number(formData.weight) : null,
        temperature: formData.temperature ? Number(formData.temperature) : null,
        heart_rate: formData.heart_rate ? Number(formData.heart_rate) : null,
        systolic_pressure: formData.systolic_pressure ? Number(formData.systolic_pressure) : null,
        diastolic_pressure: formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null,
        chief_complaint: chiefComplaintId,
        other_chief_complaint: formData.other_chief_complaint || '',
        history_of_present_illness: formData.history_of_present_illness || '',
        past_medical_history: formData.past_medical_history || '',
        assessment: formData.assessment || '',
        plan: formData.plan || '',
      };

      let savedEncounter: SavedEncounter;
      try {
        if (currentMode === 'edit' && encounterId) {
          // Update existing encounter
          savedEncounter = await pb.collection('encounters').update(encounterId, encounterData);

          // Save disbursements
          await saveDisbursementChanges();
          
          // Process all responses in a single batch
          console.log('Processing responses for update:', questionResponses);
          const responsePromises = questionResponses
            .filter(response => {
              const value = response.response_value;
              console.log('Filtering response:', { 
                question: response.expand?.question?.question_text,
                value,
                type: response.expand?.question?.input_type
              });
              // Keep checkbox responses even if false
              if (response.expand?.question?.input_type === 'checkbox') {
                return value !== undefined && value !== null;
              }
              // Filter out empty/null responses for other types
              return value !== undefined && value !== '' && value !== null;
            })
            .map(async (response) => {
              try {
                console.log('Saving response:', {
                  id: response.id,
                  question: response.expand?.question?.question_text,
                  value: response.response_value
                });
                if (response.id) {
                  return pb.collection('encounter_responses').update(response.id, {
                    response_value: response.response_value
                  });
                } else {
                  return pb.collection('encounter_responses').create({
                    encounter: encounterId,
                    question: response.question,
                    response_value: response.response_value
                  });
                }
              } catch (error) {
                console.error('Error saving response:', error);
                throw error;
              }
            });

          const results = await Promise.all(responsePromises);
          console.log('Response save results:', results);
        } else {
          // Create new encounter
          savedEncounter = await pb.collection('encounters').create(encounterData);

          // Create initial responses
          console.log('Creating initial responses:', questionResponses);
          const responsePromises = questionResponses
            .filter(response => {
              const value = response.response_value;
              console.log('Filtering new response:', {
                question: response.expand?.question?.question_text,
                value,
                type: response.expand?.question?.input_type
              });
              // Keep checkbox responses even if false
              if (response.expand?.question?.input_type === 'checkbox') {
                return value !== undefined && value !== null;
              }
              // Filter out empty/null responses for other types
              return value !== undefined && value !== '' && value !== null;
            })
            .map(response => 
              pb.collection('encounter_responses').create({
                encounter: savedEncounter.id,
                question: response.question,
                response_value: response.response_value
              })
            );

          const results = await Promise.all(responsePromises);
          console.log('Initial response save results:', results);
        }

        // Update queue item with encounter ID if needed
        if (currentQueueItem && savedEncounter) {
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
        // Only show error if it's not an autocancellation
        if (!error.message?.includes('autocancelled')) {
          console.error('Error saving encounter:', error);
          alert('Failed to save encounter. Please try again.');
        }
      }
    } catch (error: any) {
      // Handle any other errors
      if (!error.message?.includes('autocancelled')) {
        console.error('Error in form submission:', error);
        alert('An error occurred. Please try again.');
      }
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

        await handleSubmit(syntheticEvent);
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
      const validDisbursements = formData.disbursements?.filter(d => d.medication && d.quantity > 0) || [];
      if (validDisbursements.length > 0) {
        // Get existing disbursements
        const existingDisbursements = await pb.collection('disbursements').getList<ExistingDisbursement>(1, 50, {
          filter: `encounter = "${encounterId}"`,
          expand: 'medication'
        });
        const existingMap = new Map<string, ExistingDisbursement>(existingDisbursements.items.map(d => [d.id, d]));

        // First verify all stock levels
        for (const disbursement of validDisbursements) {
          const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
          const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
          
          // Only check stock for new or modified disbursements
          const existing = disbursement.id ? existingMap.get(disbursement.id) : null;
          if (!existing || existing.quantity !== quantity) {
            const newStockLevel = medication.stock - quantity + (existing?.quantity || 0);
            if (newStockLevel < 0) {
              throw new Error(`Not enough stock for ${medication.drug_name}. Available: ${medication.stock}, Requested: ${quantity}`);
            }
          }
        }
        
        // Process all disbursements
        for (const disbursement of validDisbursements) {
          try {
            const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
            const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
            
            if (disbursement.id) {
              // Update existing disbursement
              const existing = existingMap.get(disbursement.id);
              if (existing) {
                existingMap.delete(disbursement.id);

                if (existing.quantity !== quantity || existing.notes !== disbursement.notes) {
                  // Calculate new stock level
                  const newStock = medication.stock - quantity + existing.quantity;
                  
                  // Update stock
                  await pb.collection('inventory').update(disbursement.medication, {
                    stock: newStock
                  });
                  
                  await pb.collection('disbursements').update(disbursement.id, {
                    quantity: quantity,
                    notes: disbursement.notes || ''
                  });
                }
              }
            } else {
              // Create new disbursement
              const newStock = medication.stock - quantity;
              
              // Update stock first
              await pb.collection('inventory').update(disbursement.medication, {
                stock: newStock
              });
              
              // Then create disbursement
              await pb.collection('disbursements').create({
                encounter: encounterId,
                medication: disbursement.medication,
                quantity: quantity,
                notes: disbursement.notes || '',
                processed: false
              });
            }
          } catch (error: any) {
            if (!error.message?.includes('autocancelled')) {
              console.error('Error processing disbursement:', error);
              throw error;
            }
          }
        }

        // Handle deleted disbursements
        for (const [id, disbursement] of Array.from(existingMap.entries())) {
          if (!disbursement.processed) {
            // Restore stock for deleted disbursements
            const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
            const newStock = medication.stock + disbursement.quantity;
            
            await pb.collection('inventory').update(disbursement.medication, {
              stock: newStock
            });
            
            await pb.collection('disbursements').delete(id);
          }
        }
      }
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
        isProcessed: d.processed || false
      };
    });

    // Only update if the disbursements have actually changed
    setFormData(prev => {
      const prevDisbursements = prev.disbursements || [];
      const hasChanges = disbursementItems.length !== prevDisbursements.length ||
        disbursementItems.some((item, index) => {
          const prevItem = prevDisbursements[index];
          return !prevItem ||
            item.id !== prevItem.id ||
            item.quantity !== prevItem.quantity ||
            item.notes !== prevItem.notes ||
            item.isProcessed !== prevItem.isProcessed;
        });

      if (!hasChanges) return prev;

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
                    <InputLabel>Chief Complaint</InputLabel>
                    <Select
                      value={formData.chief_complaint || ''}
                      onChange={handleComplaintChange}
                      disabled={currentMode === 'view'}
                      label="Chief Complaint"
                    >
                      {chiefComplaints.map((complaint) => (
                        <MenuItem key={complaint.id} value={complaint.name}>
                          {complaint.name}
                        </MenuItem>
                      ))}
                    </Select>
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
                {currentMode !== 'view' && (
                  <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                    * Required fields must be filled for survey questions
                  </Typography>
                )}
              </Typography>
              <EncounterQuestions
                encounterId={encounterId}
                disabled={currentMode === 'view' || currentMode === 'pharmacy'}
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

                {/* Provider Mode - Ready for Pharmacy Button */}
                {currentMode !== 'view' && currentMode !== 'pharmacy' && currentQueueItem && (
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

                {/* Edit/Save Buttons */}
                {(currentMode === 'edit' || currentMode === 'create') && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      {currentMode === 'edit' ? 'Save Changes' : 'Save Encounter'}
                    </Button>
                  </>
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
