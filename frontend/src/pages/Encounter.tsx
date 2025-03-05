import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  FormControlLabel,
  Checkbox,
  Collapse,
  Alert,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { pb } from '../atoms/auth';
import { BaseModel } from 'pocketbase';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { DisbursementForm } from '../components/DisbursementForm';
import type { DisbursementItem, MedicationRecord } from '../components/DisbursementForm';
import EncounterQuestions from '../components/EncounterQuestions';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { useSettings } from '../hooks/useSettings';
import AddIcon from '@mui/icons-material/Add';
import { useAtomValue } from 'jotai/react';
import { isLoadingAtom, authModelAtom } from '../atoms/auth';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { UnsubscribeFunc } from 'pocketbase';
import { useRealtimeCollection } from '../hooks/useRealtimeCollection';

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
  allergies: string;
  pregnancy_status?: string;
}

interface ChiefComplaint extends BaseModel {
  id: string;
  name: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

interface Diagnosis extends BaseModel {
  id: string;
  name: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
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
  height: number | null;
  weight: number | null;
  temperature: number | null;
  heart_rate: number | null;
  systolic_pressure: number | null;
  diastolic_pressure: number | null;
  pulse_ox: number | null;
  allergies: string;
  urinalysis: boolean;
  urinalysis_result: string;
  blood_sugar: boolean;
  blood_sugar_result: string;
  pregnancy_test: boolean;
  pregnancy_test_result: string;
  chief_complaint: string[];
  diagnosis: string[];
  other_chief_complaint?: string;
  other_diagnosis?: string;
  history_of_present_illness?: string;
  assessment?: string;
  plan?: string;
  disbursements: DisbursementWithId[];
  active_editor?: string | null;
  last_edit_activity?: string | null;
  expand?: {
    chief_complaint?: ChiefComplaint[];
    diagnosis?: Diagnosis[];
    active_editor?: {
      id: string;
      name?: string;
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

interface UserRecord extends BaseModel {
  name: string;
  username: string;
  role: string;
}

// Add debug panel component
const DisbursementDebugPanel: React.FC<{
  disbursements: any[];
  databaseDisbursements: any[];
}> = ({ disbursements, databaseDisbursements }) => {
  const [open, setOpen] = useState(false);

  const debugInfo = {
    currentDisbursements: disbursements.map(d => ({
      id: d.id,
      medication: d.medicationDetails?.drug_name,
      multiplier: d.multiplier,
      quantity: d.quantity,
      fixed_quantity: d.medicationDetails?.fixed_quantity,
      stockChange: d.stockChange
    })),
    databaseState: databaseDisbursements.map(d => ({
      id: d.id,
      medication: d.expand?.medication?.drug_name,
      multiplier: d.multiplier,
      quantity: d.quantity
    })),
    differences: disbursements.map(d => {
      const dbMatch = databaseDisbursements.find(db => db.id === d.id);
      return {
        id: d.id,
        medication: d.medicationDetails?.drug_name,
        currentMultiplier: d.multiplier,
        databaseMultiplier: dbMatch?.multiplier,
        hasChange: d.multiplier !== dbMatch?.multiplier
      };
    })
  };

  return (
    <Paper sx={{ p: 2, my: 2, backgroundColor: '#f5f5f5' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Disbursement Debug Info</Typography>
        <IconButton size="small" onClick={() => setOpen(!open)}>
          {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export const Encounter: React.FC<EncounterProps> = ({ mode: initialMode = 'create' }) => {
  const { patientId, encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isNewEncounter, setIsNewEncounter] = useState(true);
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItem | null>(null);
  const [activeEditorWarning, setActiveEditorWarning] = useState<string | null>(null);
  const { unitDisplay, displayPreferences } = useSettings();
  const isAuthLoading = useAtomValue(isLoadingAtom);
  const authModel = useAtomValue(authModelAtom);

  // Add state declarations
  const [formData, setFormData] = useState<Partial<EncounterRecord>>({
    patient: patientId,
    height: location.state?.initialVitals?.height ?? null,
    weight: location.state?.initialVitals?.weight ?? null,
    temperature: location.state?.initialVitals?.temperature ?? null,
    heart_rate: location.state?.initialVitals?.heart_rate ?? null,
    systolic_pressure: location.state?.initialVitals?.systolic_pressure ?? null,
    diastolic_pressure: location.state?.initialVitals?.diastolic_pressure ?? null,
    pulse_ox: location.state?.initialVitals?.pulse_ox ?? null,
    allergies: '',
    urinalysis: false,
    urinalysis_result: '',
    blood_sugar: false,
    blood_sugar_result: '',
    pregnancy_test: false,
    pregnancy_test_result: '',
    chief_complaint: [],
    diagnosis: [],
    other_chief_complaint: '',
    other_diagnosis: '',
    past_medical_history: '',
    assessment: '',
    plan: '',
    disbursements: [],
  });
  const [chiefComplaints, setChiefComplaints] = useState<ChiefComplaint[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [showOtherComplaint, setShowOtherComplaint] = useState(false);
  const [otherComplaintValue, setOtherComplaintValue] = useState('');
  const [showOtherDiagnosis, setShowOtherDiagnosis] = useState(false);
  const [otherDiagnosisValue, setOtherDiagnosisValue] = useState('');
  const [questionResponses, setQuestionResponses] = useState<QuestionResponse[]>([]);
  const [savedEncounter, setSavedEncounter] = useState<SavedEncounter | null>(null);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [databaseDisbursements, setDatabaseDisbursements] = useState<any[]>([]);

  const OTHER_COMPLAINT_VALUE = '__OTHER__';

  const userRole = (authModel as any)?.role;

  // Add helper function to format age display
  const formatAgeDisplay = (ageInYears: number): string => {
    if (ageInYears >= 1) {
      return `${Math.floor(ageInYears)} years`;
    } else {
      const months = Math.floor(ageInYears * 12);
      if (months >= 1) {
        return `${months} months`;
      } else {
        const weeks = Math.floor(ageInYears * 52);
        return `${weeks} weeks`;
      }
    }
  };

  // Helper function to determine if a field should be disabled
  const isFieldDisabled = (section: 'vitals' | 'subjective' | 'disbursement' | 'questions') => {
    // If field restrictions are overridden for admin or all roles, enable all fields
    if (displayPreferences?.override_field_restrictions && (
      (pb.authStore.model as any)?.role === 'admin' || 
      displayPreferences?.override_field_restrictions_all_roles
    )) {
      return false;
    }
    
    if (currentMode === 'view') return true;
    
    // In pharmacy mode, only disbursement section is editable
    if (currentMode === 'pharmacy') {
      return section !== 'disbursement';
    }
    
    // In checkout mode, only questions section is editable
    if (currentMode === 'checkout') {
      return section !== 'questions';
    }
    
    // In provider mode (edit/create), all sections are editable
    return false;
  };

  // Add refs for each section
  const vitalsRef = useRef<HTMLDivElement>(null);
  const subjectiveRef = useRef<HTMLDivElement>(null);
  const disbursementRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  type SectionName = 'vitals' | 'subjective' | 'disbursement' | 'questions';

  const sectionRefs = {
    vitals: vitalsRef,
    subjective: subjectiveRef,
    disbursement: disbursementRef,
    questions: questionsRef
  };

  // Add effect for scrolling
  useEffect(() => {
    const section = location.state?.scrollTo as SectionName;
    if (section && sectionRefs[section]?.current) {
      // Wait for content to be rendered
      setTimeout(() => {
        const headerOffset = 80;
        const elementPosition = sectionRefs[section].current?.getBoundingClientRect().top ?? 0;
        const offsetPosition = elementPosition + window.scrollY - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [location.state?.scrollTo, loading]);

  // Memoize the mode determination to prevent unnecessary re-renders
  const currentMode = React.useMemo(() => {
    const locationMode = location.state?.mode;
    const computedMode = (locationMode || initialMode);
    
    if (currentQueueItem?.status === 'at_checkout') {
      return 'checkout' as const;
    }
    
    return (computedMode === 'create' || (isNewEncounter && computedMode !== 'pharmacy')) ? 'edit' : computedMode;
  }, [location.state?.mode, initialMode, isNewEncounter, currentQueueItem?.status]);

  // Add auth validation effect
  useEffect(() => {
    if (isAuthLoading) {
      console.log('Waiting for auth initialization...');
      return;
    }

    if (!authModel || !pb.authStore.isValid) {
      console.log('No valid auth, redirecting to login');
      navigate('/login', { state: { from: location } });
      return;
    }
  }, [isAuthLoading, authModel, navigate, location]);

  useEffect(() => {
    const loadData = async () => {
      console.log('Loading data for encounter:', { patientId, encounterId, isAuthLoading, hasAuth: !!authModel });
      
      // Don't load data until auth is initialized and valid
      if (isAuthLoading || !authModel || !pb.authStore.isValid) {
        console.log('Waiting for auth initialization or validation...');
        return;
      }

      if (!patientId) {
        console.warn('No patientId found, redirecting to /patients');
        navigate('/patients');
        return;
      }

      try {
        setLoading(true);
        // Load patient data, chief complaints, and diagnoses
        const [patientRecord, complaintsResult, diagnosesResult] = await Promise.all([
          pb.collection('patients').getOne<Patient>(patientId, {
            $autoCancel: false
          }),
          pb.collection('chief_complaints').getList<ChiefComplaint>(1, 1000, {
            sort: 'name',
            $autoCancel: false
          }),
          pb.collection('diagnosis').getList<Diagnosis>(1, 1000, {
            sort: 'name',
            $autoCancel: false
          })
        ]);

        console.log('Patient, complaints, and diagnoses loaded:', { patientRecord, complaintsResult, diagnosesResult });

        // Use the calculated age from state if available, otherwise use the patient's stored age
        const patientWithAge = {
          ...patientRecord,
          age: location.state?.currentAge ?? patientRecord.age
        };
        
        setPatient(patientWithAge);
        setChiefComplaints(complaintsResult.items.filter((c, index, self) => 
          index === self.findIndex(t => t.name === c.name)
        ));
        setDiagnoses(diagnosesResult.items.filter((d, index, self) => 
          index === self.findIndex(t => t.name === d.name)
        ));

        // Load encounter data if viewing, editing, in pharmacy mode, or in checkout mode
        if (encounterId && (currentMode === 'view' || currentMode === 'edit' || currentMode === 'pharmacy' || currentMode === 'checkout')) {
            const [encounterRecord, disbursements] = await Promise.all([
              pb.collection('encounters').getOne<EncounterRecord>(encounterId, { 
                expand: 'chief_complaint,diagnosis,active_editor',
                $autoCancel: false
              }),
              pb.collection('disbursements').getList(1, 50, {
                filter: `encounter = "${encounterId}"`,
                expand: 'medication',
                $autoCancel: false
              })
            ]);

            console.log('Encounter and disbursements loaded:', { encounterRecord, disbursements });

            // Convert disbursements to DisbursementItems
            const disbursementItems = (disbursements.items as Disbursement[]).map(d => {
              const medication = d.expand?.medication as MedicationRecord;
              const multiplier = medication ? d.quantity / medication.fixed_quantity : '';
              
              return {
                id: d.id,
                medication: d.medication,
                quantity: medication?.fixed_quantity || d.quantity,
                multiplier: multiplier.toString(),
                notes: d.notes || '',
                medicationDetails: medication,
                isProcessed: d.processed || false,
                frequency: d.frequency || 'QD',
                frequency_hours: d.frequency_hours,
                associated_diagnosis: d.associated_diagnosis || null
              };
            });

            const chiefComplaint = encounterRecord.expand?.chief_complaint;
            const hasOtherComplaint = encounterRecord.other_chief_complaint && encounterRecord.other_chief_complaint.length > 0;
            const diagnosis = encounterRecord.expand?.diagnosis;
            const hasOtherDiagnosis = encounterRecord.other_diagnosis && encounterRecord.other_diagnosis.length > 0;

            if (chiefComplaint?.some(c => c.name === 'OTHER (Custom Text Input)') || hasOtherComplaint) {
              setShowOtherComplaint(true);
              setOtherComplaintValue(encounterRecord.other_chief_complaint || '');
            }

            if (diagnosis?.some(d => d.name === 'OTHER (Custom Text Input)') || hasOtherDiagnosis) {
              setShowOtherDiagnosis(true);
              setOtherDiagnosisValue(encounterRecord.other_diagnosis || '');
            }

            // Preserve existing form data and only update with new encounter data
            setFormData(prev => ({
                ...prev,
                ...encounterRecord,
                height: encounterRecord.height ?? prev.height,
                weight: encounterRecord.weight ?? prev.weight,
                temperature: encounterRecord.temperature ?? prev.temperature,
                heart_rate: encounterRecord.heart_rate ?? prev.heart_rate,
                systolic_pressure: encounterRecord.systolic_pressure ?? prev.systolic_pressure,
                diastolic_pressure: encounterRecord.diastolic_pressure ?? prev.diastolic_pressure,
                pulse_ox: encounterRecord.pulse_ox ?? prev.pulse_ox,
                allergies: encounterRecord.allergies || patientRecord.allergies || prev.allergies || '',
                chief_complaint: encounterRecord.chief_complaint || [],
                other_chief_complaint: encounterRecord.other_chief_complaint || '',
                diagnosis: encounterRecord.diagnosis || [],
                other_diagnosis: encounterRecord.other_diagnosis || '',
                disbursements: disbursementItems.length > 0 ? disbursementItems : [{
                  medication: '',
                  quantity: 1,
                  multiplier: '',  // Allow empty multiplier
                  notes: '',
                }]
            }));
            
            // Store the saved encounter data for reference
            setSavedEncounter(encounterRecord);
        } else {
          // For new encounters, initialize with patient data
          setFormData(prev => ({
            ...prev,
            allergies: patientRecord.allergies || '',
            height: location.state?.initialVitals?.height ?? null,
            weight: location.state?.initialVitals?.weight ?? null,
            temperature: location.state?.initialVitals?.temperature ?? null,
            heart_rate: location.state?.initialVitals?.heart_rate ?? null,
            systolic_pressure: location.state?.initialVitals?.systolic_pressure ?? null,
            diastolic_pressure: location.state?.initialVitals?.diastolic_pressure ?? null,
            pulse_ox: location.state?.initialVitals?.pulse_ox ?? null,
          }));
        }
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading data:', error);
        if (!error?.message?.includes('autocancelled') && 
            !error?.message?.includes('aborted') && 
            !error?.isAbort) {
          setError('Error loading encounter data. Please try again.');
          navigate('/patients');
        }
      }
    };

    loadData();
  }, [patientId, encounterId, isAuthLoading, authModel, navigate]);

  // Subscribe to queue changes with auto-cancellation disabled
  const { records: queueRecords } = useRealtimeCollection<QueueItem>(
    'queue',
    patientId ? {
      filter: `patient = "${patientId}" && status != "completed"`,
      expand: 'patient,assigned_to,encounter'
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

      // Validate chief complaints first
      if (!formData.chief_complaint || formData.chief_complaint.length === 0) {
        alert('At least one chief complaint is required.');
        return;
      }

      // Validate "OTHER" chief complaint if selected
      const hasOtherComplaint = chiefComplaints
        .filter(c => formData.chief_complaint?.includes(c.id))
        .some(c => c.name === 'OTHER (Custom Text Input)');
      
      if (hasOtherComplaint && (!formData.other_chief_complaint || formData.other_chief_complaint.trim() === '')) {
        alert('Please specify the other chief complaint.');
        return;
      }

      // Save encounter data first
      const encounterData = {
        chief_complaint: formData.chief_complaint || [],
        other_chief_complaint: formData.other_chief_complaint || '',
        diagnosis: formData.diagnosis || [],
        other_diagnosis: formData.other_diagnosis || ''
      };

      if (encounterId) {
        await pb.collection('encounters').update(encounterId, encounterData);
      }

      // Then save disbursement changes
      console.log('Saving disbursement changes');
      await saveDisbursementChanges();

      // After successful save, update database state
      await fetchDatabaseDisbursements();
      
      // Clear any local state changes in the DisbursementForm
      if (disbursementFormRef.current) {
        disbursementFormRef.current.resetLocalState();
      }

      // Show success notification
      alert(action === 'save' ? 'Encounter saved successfully' : 'Patient has been sent to checkout');

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

  const handleComplaintChange = (_event: React.SyntheticEvent, values: ChiefComplaint[]) => {
    console.log('DEBUG: Complaint change:', {
      values,
      ids: values.map(v => v.id)
    });
    
    const hasOther = values.some(v => v.name === 'OTHER (Custom Text Input)');
    setShowOtherComplaint(hasOther);
    
    // Always update the chief_complaints array with the IDs
    const complaintIds = values.map(v => v.id);
    
    if (!hasOther) {
      setOtherComplaintValue('');
      setFormData(prev => ({
        ...prev,
        chief_complaint: complaintIds,
        other_chief_complaint: '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        chief_complaint: complaintIds,
        // Keep existing other_chief_complaint if it exists
        other_chief_complaint: prev.other_chief_complaint || ''
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

  const handleDiagnosisChange = (_event: React.SyntheticEvent, values: Diagnosis[]) => {
    console.log('DEBUG: Diagnosis change:', {
      values,
      ids: values.map(v => v.id)
    });
    
    const hasOther = values.some(v => v.name === 'OTHER (Custom Text Input)');
    setShowOtherDiagnosis(hasOther);
    
    // Always update the diagnosis array with the IDs
    const diagnosisIds = values.map(v => v.id);
    
    if (!hasOther) {
      setOtherDiagnosisValue('');
      setFormData(prev => ({
        ...prev,
        diagnosis: diagnosisIds,
        other_diagnosis: '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        diagnosis: diagnosisIds,
        // Keep existing other_diagnosis if it exists
        other_diagnosis: prev.other_diagnosis || ''
      }));
    }
  };

  const handleOtherDiagnosisChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    setOtherDiagnosisValue(value);
    setFormData(prev => ({
      ...prev,
      other_diagnosis: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Form submission started');
    console.log('DEBUG: Chief complaints validation:', {
      complaints: formData.chief_complaint,
      length: formData.chief_complaint?.length,
      formData
    });
    
    try {
      // Validate chief complaints
      if (!formData.chief_complaint || formData.chief_complaint.length === 0) {
        alert('At least one chief complaint is required.');
        return false;
      }

      // Validate "OTHER" chief complaint if selected
      const hasOtherComplaint = chiefComplaints
        .filter(c => formData.chief_complaint?.includes(c.id))
        .some(c => c.name === 'OTHER (Custom Text Input)');
      
      if (hasOtherComplaint && (!formData.other_chief_complaint || formData.other_chief_complaint.trim() === '')) {
        alert('Please specify the other chief complaint.');
        return false;
      }

      // Validate diagnosis
      if (!formData.diagnosis || formData.diagnosis.length === 0) {
        alert('At least one diagnosis is required. If the patient is healthy, please select "WELL CHECK".');
        return false;
      }

      // Validate "OTHER" diagnosis if selected
      const hasOtherDiagnosis = diagnoses
        .filter(d => formData.diagnosis?.includes(d.id))
        .some(d => d.name === 'OTHER (Custom Text Input)');
      
      if (hasOtherDiagnosis && (!formData.other_diagnosis || formData.other_diagnosis.trim() === '')) {
        alert('Please specify the other diagnosis.');
        return false;
      }

      try {
        // Log the current state for debugging
        console.log('DEBUG Form Data:', {
          formData,
          mode: currentMode,
          patientId,
          encounterId,
          currentQueueItem
        });

        // If in checkout mode, fetch the existing encounter data first
        let existingEncounter: EncounterRecord | null = null;
        if (currentMode === 'checkout' && encounterId) {
          existingEncounter = await pb.collection('encounters').getOne<EncounterRecord>(encounterId);
        }

        // Prepare encounter data
        const encounterData = {
          patient: patientId,
          height: currentMode === 'checkout' ? existingEncounter?.height : (formData.height ? Number(formData.height) : null),
          weight: currentMode === 'checkout' ? existingEncounter?.weight : (formData.weight ? Number(formData.weight) : null),
          temperature: currentMode === 'checkout' ? existingEncounter?.temperature : (formData.temperature ? Number(formData.temperature) : null),
          heart_rate: currentMode === 'checkout' ? existingEncounter?.heart_rate : (formData.heart_rate ? Number(formData.heart_rate) : null),
          systolic_pressure: currentMode === 'checkout' ? existingEncounter?.systolic_pressure : (formData.systolic_pressure ? Number(formData.systolic_pressure) : null),
          diastolic_pressure: currentMode === 'checkout' ? existingEncounter?.diastolic_pressure : (formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null),
          pulse_ox: currentMode === 'checkout' ? existingEncounter?.pulse_ox : (formData.pulse_ox ? Number(formData.pulse_ox) : null),
          chief_complaint: formData.chief_complaint || [],
          diagnosis: formData.diagnosis || [],
          other_chief_complaint: formData.other_chief_complaint || '',
          other_diagnosis: formData.other_diagnosis || '',
          past_medical_history: formData.past_medical_history || '',
          subjective_notes: formData.subjective_notes || '',
          allergies: formData.allergies || '',
          urinalysis: formData.urinalysis || false,
          urinalysis_result: formData.urinalysis_result || '',
          blood_sugar: formData.blood_sugar || false,
          blood_sugar_result: formData.blood_sugar_result || '',
          pregnancy_test: formData.pregnancy_test || false,
          pregnancy_test_result: formData.pregnancy_test_result || '',
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
            return true;
          }

          // After successful save, update database state
          await fetchDatabaseDisbursements();
          
          // Clear any local state changes in the DisbursementForm
          if (disbursementFormRef.current) {
            disbursementFormRef.current.resetLocalState();
          }

          // Clean up active editor after successful save
          await cleanupActiveEditor();

          return true;
        } catch (error: any) {
          console.error('DEBUG: Error saving encounter:', {
            error,
            errorMessage: error.message,
            errorData: error.data,
            originalError: error.originalError
          });
          alert('Failed to save encounter: ' + error.message);
          return false;
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
        return false;
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
      return false;
    }
  };

  const handleEdit = () => {
    navigate(`/encounter/${patientId}/${encounterId}/edit`);
  };

  const handleBack = () => {
    cleanupActiveEditor();
    navigate(`/patient/${patientId}`);
  };

  const handleQueueStatusChange = async (newStatus: QueueStatus) => {
    if (!currentQueueItem) return;

    try {
      // Check for chief complaint when moving to pharmacy or checkout
      if (newStatus === 'ready_pharmacy' || newStatus === 'at_checkout') {
        // Validate diagnosis first
        if (!formData.diagnosis || formData.diagnosis.length === 0) {
          alert('At least one diagnosis is required before progressing the encounter. If the patient is healthy, please select "WELL CHECK".');
          return;
        }

        // Validate "OTHER" diagnosis if selected
        const hasOtherDiagnosis = diagnoses
          .filter(d => formData.diagnosis?.includes(d.id))
          .some(d => d.name === 'OTHER (Custom Text Input)');
        
        if (hasOtherDiagnosis && (!formData.other_diagnosis || formData.other_diagnosis.trim() === '')) {
          alert('Please specify the other diagnosis before progressing.');
          return;
        }

        // Then validate chief complaint
        if (!formData.chief_complaint || formData.chief_complaint.length === 0) {
          alert('At least one chief complaint is required before progressing the encounter.');
          return;
        }

        // If "OTHER" is selected but no text is provided, show error
        const hasOtherComplaint = chiefComplaints
          .filter(c => formData.chief_complaint?.includes(c.id))
          .some(c => c.name === 'OTHER (Custom Text Input)');
        
        if (hasOtherComplaint && (!formData.other_chief_complaint || formData.other_chief_complaint.trim() === '')) {
          alert('Please specify the other chief complaint before progressing.');
          return;
        }

        // Check if there are any medications
        const hasDisbursements = formData.disbursements && formData.disbursements.some(d => d.medication && !d.markedForDeletion);
        
        if (!hasDisbursements) {
          const confirmMessage = 'No medications are currently selected for disbursement. Are you sure you want to continue?';
          if (!window.confirm(confirmMessage)) {
            return;
          }
        }
      }

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
          expand: 'medication',
          fields: 'id,medication,quantity,notes,processed,frequency,frequency_hours,associated_diagnosis'
        }),
        Promise.all(validDisbursements.map(d => 
          pb.collection('inventory').getOne<MedicationRecord>(d.medication)
        ))
      ]);

      // Process deletions first
      for (const disbursement of markedForDeletion) {
        if (!disbursement.id) continue;

        const existing = existingDisbursementsResult.items.find(d => d.id === disbursement.id);
        if (existing && !existing.processed) {
          try {
            // Get fresh medication record
            const medication = await pb.collection('inventory').getOne<MedicationRecord>(existing.medication);
            const newStock = medication.stock + existing.quantity;
            
            // Update stock first
            await pb.collection('inventory').update(existing.medication, {
              stock: newStock,
              multiplier: 1
            });
            
            // Then delete the disbursement
            await pb.collection('disbursements').delete(disbursement.id);
          } catch (error) {
            console.error('DEBUG: Error in deletion process:', error);
            throw error;
          }
        }
      }

      // Process valid disbursements
      const processedDisbursements: (ExistingDisbursement | Record<string, any>)[] = [];
      for (const disbursement of validDisbursements) {
        const medication = medicationsResult.find(m => m.id === disbursement.medication);
        if (!medication) continue;

        // Convert multiplier to number for calculations, empty multiplier becomes 0
        const multiplierNum = typeof disbursement.multiplier === 'string' 
          ? (disbursement.multiplier === '' ? 0 : parseFloat(disbursement.multiplier) || 0)
          : disbursement.multiplier || 0;
        const quantity = disbursement.quantity * multiplierNum;
        
        if (disbursement.id) {
          const existing = existingDisbursementsResult.items.find(d => d.id === disbursement.id);
          if (existing) {
            // Update if any fields changed
            const fieldsChanged = 
              existing.quantity !== quantity ||
              existing.notes !== disbursement.notes ||
              existing.frequency !== disbursement.frequency ||
              existing.frequency_hours !== disbursement.frequency_hours ||
              existing.associated_diagnosis !== disbursement.associated_diagnosis;

            if (fieldsChanged) {
              // Update stock if quantity changed
              if (existing.quantity !== quantity) {
                const stockChange = quantity - existing.quantity;
                const newStock = medication.stock - stockChange;
                
                if (newStock < 0) {
                  throw new Error(`Not enough stock for ${medication.drug_name}. Available: ${medication.stock}, Needed: ${quantity}`);
                }

                await pb.collection('inventory').update(medication.id, {
                  stock: newStock
                });
              }

              // Update disbursement
              const updated = await pb.collection('disbursements').update(disbursement.id, {
                quantity,
                multiplier: disbursement.multiplier,  // Save the original multiplier string
                notes: disbursement.notes || '',
                frequency: disbursement.frequency || 'QD',
                frequency_hours: disbursement.frequency === 'Q#H' ? disbursement.frequency_hours : null,
                associated_diagnosis: disbursement.associated_diagnosis || null
              });
              processedDisbursements.push(updated);
            } else {
              processedDisbursements.push(existing);
            }
          }
        } else {
          // Create new disbursement
          const newStock = medication.stock - quantity;
          
          if (newStock < 0) {
            throw new Error(`Not enough stock for ${medication.drug_name}. Available: ${medication.stock}, Needed: ${quantity}`);
          }

          // Update stock first
          await pb.collection('inventory').update(medication.id, {
            stock: newStock,
            multiplier: 1
          });

          // Create disbursement
          const created = await pb.collection('disbursements').create({
            encounter: encounterId,
            medication: disbursement.medication,
            quantity,
            multiplier: disbursement.multiplier,  // Save the original multiplier string
            notes: disbursement.notes || '',
            processed: false,
            frequency: disbursement.frequency || 'QD',
            frequency_hours: disbursement.frequency === 'Q#H' ? disbursement.frequency_hours : null,
            associated_diagnosis: disbursement.associated_diagnosis || null
          });
          processedDisbursements.push(created);
        }
      }

      // Update form data with processed disbursements
      const updatedDisbursements = await Promise.all(
        processedDisbursements.map(async d => {
          const medication = await pb.collection('inventory').getOne<MedicationRecord>(d.medication);
          const currentMultiplier = medication.fixed_quantity ? d.quantity / medication.fixed_quantity : 1;
          return {
            id: d.id,
            medication: d.medication,
            quantity: medication.fixed_quantity || d.quantity,
            multiplier: currentMultiplier,
            notes: d.notes || '',
            medicationDetails: medication,
            markedForDeletion: false, // Explicitly clear deletion flag
            frequency: d.frequency || 'QD',
            frequency_hours: d.frequency === 'Q#H' ? d.frequency_hours : null,
            associated_diagnosis: d.associated_diagnosis || null,
            // Set original values to current values after save
            originalQuantity: medication.fixed_quantity || d.quantity,
            originalMultiplier: currentMultiplier
          };
        })
      );

      setFormData(prev => ({
        ...prev,
        disbursements: updatedDisbursements
      }));

      console.log('DEBUG: Successfully saved disbursements:', {
        processed: updatedDisbursements.length,
        deleted: markedForDeletion.length
      });
    } catch (error) {
      console.error('Error saving disbursement changes:', error);
      alert('Failed to save changes: ' + (error as Error).message);
      throw error;
    }
  };

  // Subscribe to disbursements for this encounter
  const { records: disbursementRecords } = useRealtimeCollection<Disbursement>(
    'disbursements',
    encounterId ? {
      filter: `encounter = "${encounterId}"`,
      expand: 'medication'
    } : {}
  );

  // Update form data when disbursements change
  useEffect(() => {
    if (!disbursementRecords || !encounterId) return;

    // Add debug logging
    console.log('DEBUG: Received disbursement update', {
      encounterId,
      recordCount: disbursementRecords.length,
      records: disbursementRecords.map(d => ({
        id: d.id,
        encounter: d.encounter,
        medication: d.expand?.medication?.drug_name
      }))
    });

    // Double-check that ALL records are for this encounter
    const hasInvalidRecords = disbursementRecords.some(d => d.encounter !== encounterId);
    if (hasInvalidRecords) {
      console.error('ERROR: Received disbursement records for wrong encounter!', {
        encounterId,
        records: disbursementRecords.map(d => ({
          id: d.id,
          encounter: d.encounter
        }))
      });
      return; // Don't process if we have any invalid records
    }

    // Convert disbursements to DisbursementItems
    const disbursementItems = disbursementRecords.map(d => {
      const medication = d.expand?.medication as MedicationRecord;
      const multiplier = medication ? d.quantity / medication.fixed_quantity : 1;
      
      return {
        id: d.id,
        medication: d.medication,
        quantity: medication?.fixed_quantity || d.quantity,
        multiplier: multiplier.toString(),
        notes: d.notes || '',
        medicationDetails: medication,
        isProcessed: d.processed || false,
        frequency: d.frequency || 'QD',
        frequency_hours: d.frequency_hours,
        associated_diagnosis: d.associated_diagnosis || null
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
          multiplier: '',
          notes: '',
        }]
      };
    });
  }, [disbursementRecords, encounterId]);

  // Add cleanup for subscription when component unmounts
  useEffect(() => {
    return () => {
      // Any cleanup needed for the subscription
      console.log('DEBUG: Cleaning up disbursement subscription for encounter:', encounterId);
    };
  }, [encounterId]);

  // Subscribe to inventory changes
  const { records: inventoryRecords } = useRealtimeCollection<InventoryItem>('inventory', {
    sort: 'drug_name'
  });

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
      if (!currentQueueItem?.id) {
        console.error('No current queue item found');
      return;
    }

      // Create a form element and synthetic event
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

      // First save any changes
      const submitSuccess = await handleSubmit(syntheticEvent);
      if (!submitSuccess) {
        console.log('Submit failed, stopping checkout action');
        return;
      }

      if (action === 'complete') {
        console.log('Processing complete action');
        try {
          // Update queue status
          console.log('Updating queue status to completed');
          await pb.collection('queue').update(currentQueueItem.id, {
            status: 'completed',
            end_time: new Date().toISOString()
          });
          navigate('/dashboard');
        } catch (error) {
          console.error('Error updating queue status:', error);
          alert('Failed to complete checkout: ' + (error as Error).message);
          return;
        }
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

  const handleDisbursementsChange = (disbursements: DisbursementItem[]) => {
    setFormData(prev => ({ ...prev, disbursements }));
  };

  // Add function to fetch current database state
  const fetchDatabaseDisbursements = useCallback(async () => {
    if (!encounterId) return;
    
    try {
      const result = await pb.collection('disbursements').getList(1, 100, {
        filter: `encounter = "${encounterId}"`,
        expand: 'medication',
        $autoCancel: false // Explicitly disable auto-cancellation for this request
      });
      setDatabaseDisbursements(result.items);
      console.log('DEBUG: Fetched database disbursements:', result.items);
    } catch (error) {
      console.error('Error fetching database disbursements:', error);
    }
  }, [encounterId]);

  // Update useEffect to fetch database state
  useEffect(() => {
    if (encounterId) {
      fetchDatabaseDisbursements();
    }
  }, [encounterId, fetchDatabaseDisbursements]);

  // Add ref for DisbursementForm
  const disbursementFormRef = useRef<any>(null);

  // Add cleanup function for active editor
  const cleanupActiveEditor = useCallback(async () => {
    if (encounterId && (currentMode === 'edit' || currentMode === 'pharmacy')) {
      try {
        await pb.collection('encounters').update(encounterId, {
          active_editor: null,
          last_edit_activity: null
        }, {
          $autoCancel: false // Explicitly disable auto-cancellation for this request
        });
      } catch (error) {
        console.error('Error cleaning up active editor:', error);
      }
    }
  }, [encounterId, currentMode]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupActiveEditor();
    };
  }, [cleanupActiveEditor]);

  // Add active editor check and update
  useEffect(() => {
    const checkAndUpdateActiveEditor = async (encounterId: string, currentMode: EncounterMode) => {
      if (!encounterId || (currentMode !== 'edit' && currentMode !== 'pharmacy')) {
        return;
      }

      try {
        // Subscribe to encounter changes to get real-time updates of active editor
        const unsubscribe = await pb.collection('encounters').subscribe(
          encounterId,
          async (e) => {
            if (e.action === 'update') {
              const updatedEncounter = e.record as EncounterRecord;
              
              // If we're not the active editor and someone else is, show warning
              if (updatedEncounter.active_editor && 
                  updatedEncounter.active_editor !== pb.authStore.model?.id) {
                try {
                  const editor = await pb.collection('users').getOne<UserRecord>(updatedEncounter.active_editor);
                  setActiveEditorWarning(
                    `This encounter is currently being edited by ${editor.name || 'another user'}. ` +
                    'Your changes may conflict with theirs.'
                  );
                } catch (error) {
                  console.error('Error fetching editor details:', error);
                  setActiveEditorWarning(
                    'This encounter is currently being edited by another user. ' +
                    'Your changes may conflict with theirs.'
                  );
                }
              } else {
                setActiveEditorWarning(null);
              }
            }
          }
        );

        // Initial check of active editor
        const encounter = await pb.collection('encounters').getOne<EncounterRecord>(encounterId, {
          expand: 'active_editor',
          $autoCancel: false // Explicitly disable auto-cancellation for this request
        });

        // Check if there's an active editor and their last activity
        if (encounter.active_editor) {
          const lastActivity = new Date(encounter.last_edit_activity || 0);
          const now = new Date();
          const timeDiff = now.getTime() - lastActivity.getTime();
          const timeoutPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds

          // If the active editor is us, just update the timestamp
          if (encounter.active_editor === pb.authStore.model?.id) {
            await pb.collection('encounters').update<EncounterRecord>(encounterId, {
              last_edit_activity: new Date().toISOString()
            }, {
              $autoCancel: false // Explicitly disable auto-cancellation for this request
            });
            setActiveEditorWarning(null);
            return unsubscribe;
          }

          // If the last activity is older than the timeout period, take over as editor
          if (timeDiff > timeoutPeriod) {
            await pb.collection('encounters').update<EncounterRecord>(encounterId, {
              active_editor: pb.authStore.model?.id,
              last_edit_activity: new Date().toISOString()
            }, {
              $autoCancel: false // Explicitly disable auto-cancellation for this request
            });
            setActiveEditorWarning(null);
            return unsubscribe;
          }

          // Someone else is actively editing, show warning
          const editor = encounter.expand?.active_editor;
          setActiveEditorWarning(
            `This encounter is currently being edited by ${editor?.name || 'another user'}. ` +
            'Your changes may conflict with theirs.'
          );
          return unsubscribe;
        }

        // No active editor, set ourselves as the active editor
        await pb.collection('encounters').update<EncounterRecord>(encounterId, {
          active_editor: pb.authStore.model?.id,
          last_edit_activity: new Date().toISOString()
        }, {
          $autoCancel: false // Explicitly disable auto-cancellation for this request
        });
        setActiveEditorWarning(null);

        return unsubscribe;
      } catch (error) {
        console.error('Error checking active editor:', error);
        return null;
      }
    };

    // Only call if encounterId exists
    let unsubscribe: UnsubscribeFunc | null = null;
    if (encounterId) {
      checkAndUpdateActiveEditor(encounterId, currentMode)
        .then(unsub => {
          if (unsub) {
            unsubscribe = unsub;
          }
        });
    }

    // Set up interval to update last_edit_activity
    const interval = setInterval(async () => {
      if (encounterId && (currentMode === 'edit' || currentMode === 'pharmacy')) {
        try {
          const encounter = await pb.collection('encounters').getOne<EncounterRecord>(encounterId);
          
          // Only update timestamp if we are the active editor
          if (encounter.active_editor === pb.authStore.model?.id) {
            await pb.collection('encounters').update(encounterId, {
              last_edit_activity: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error updating last edit activity:', error);
        }
      }
    }, 30000); // Update every 30 seconds

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearInterval(interval);
    };
  }, [encounterId, currentMode]);

  if (isAuthLoading) {
    return <Typography>Initializing...</Typography>;
  }

  if (loading || !patient) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        {activeEditorWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {activeEditorWarning}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 0.5 }}>
              {currentMode === 'create' ? 'New' : currentMode === 'edit' ? 'Edit' : ''} Encounter for {patient?.first_name} {patient?.last_name}
              {currentQueueItem && (
                <Box component="span" sx={{ ml: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 'normal' }}>
                    Line: <Typography component="span" sx={{ fontWeight: 'bold' }}>
                      #{currentQueueItem.line_number}
                    </Typography>
                  </Typography>
                </Box>
              )}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary">
                Age: {patient?.age ? formatAgeDisplay(patient.age) : 'Unknown'} • Gender: {patient?.gender.charAt(0).toUpperCase() + patient?.gender.slice(1)}
                {currentQueueItem && (
                  <>
                    {' • '}
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      {patient?.gender !== 'male' && (
                        <>
                          <Typography variant="subtitle1" color="text.secondary">
                            Pregnant:
                          </Typography>
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                              value={patient?.pregnancy_status || ''}
                              onChange={async (e) => {
                                if (!patient?.id) return;
                                await pb.collection('patients').update(patient.id, {
                                  pregnancy_status: e.target.value
                                });
                                setPatient(prev => prev ? { ...prev, pregnancy_status: e.target.value } : null);
                              }}
                              variant="standard"
                              disabled={isFieldDisabled('vitals')}
                              sx={{ 
                                '& .MuiSelect-select': { 
                                  py: 0,
                                  color: 'text.secondary',
                                  fontSize: 'subtitle1.fontSize'
                                }
                              }}
                            >
                              <MenuItem value="">Not Specified</MenuItem>
                              <MenuItem value="yes">Yes</MenuItem>
                              <MenuItem value="no">No</MenuItem>
                              <MenuItem value="potentially">Potentially</MenuItem>
                            </Select>
                          </FormControl>
                        </>
                      )}
                    </Box>
                  </>
                )}
              </Typography>
            </Box>
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
            <Grid item xs={12} ref={vitalsRef}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Vitals
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={`Height (${unitDisplay.height})`}
                    type="number"
                    value={formData.height ?? ''}
                    onChange={handleInputChange('height')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={`Weight (${unitDisplay.weight})`}
                    type="number"
                    value={formData.weight ?? ''}
                    onChange={handleInputChange('weight')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={`Temperature (°${unitDisplay.temperature})`}
                    type="number"
                    inputProps={{ step: "0.1" }}
                    value={formData.temperature ?? ''}
                    onChange={handleInputChange('temperature')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Heart Rate (bpm)"
                    type="number"
                    value={formData.heart_rate ?? ''}
                    onChange={handleInputChange('heart_rate')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Systolic Pressure"
                    type="number"
                    value={formData.systolic_pressure ?? ''}
                    onChange={handleInputChange('systolic_pressure')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Diastolic Pressure"
                    type="number"
                    value={formData.diastolic_pressure ?? ''}
                    onChange={handleInputChange('diastolic_pressure')}
                    disabled={isFieldDisabled('vitals')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Pulse Oximetry (%)"
                    value={formData.pulse_ox ?? ''}
                    onChange={handleInputChange('pulse_ox')}
                    disabled={isFieldDisabled('vitals')}
                    InputProps={{
                      inputProps: {
                        min: 0,
                        max: 100,
                        step: 1
                      }
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Add Divider for Health Screening Section */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" color="primary" sx={{ mt: 2, mb: 1 }}>
                    Health Screening
                  </Typography>
                </Grid>

                {/* Allergies Field */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Allergies"
                    value={formData.allergies}
                    onChange={handleInputChange('allergies')}
                    disabled={isFieldDisabled('vitals')}
                    multiline
                    rows={2}
                  />
                </Grid>

                {/* Health Screening Checkboxes */}
                <Grid item xs={12} sm={4}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.urinalysis}
                          onChange={(e) => setFormData(prev => ({ ...prev, urinalysis: e.target.checked }))}
                          disabled={isFieldDisabled('vitals')}
                        />
                      }
                      label="Urinalysis"
                    />
                    {formData.urinalysis && (
                      <TextField
                        fullWidth
                        size="small"
                        label="Urinalysis Result"
                        value={formData.urinalysis_result || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, urinalysis_result: e.target.value }))}
                        disabled={isFieldDisabled('vitals')}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.blood_sugar}
                          onChange={(e) => setFormData(prev => ({ ...prev, blood_sugar: e.target.checked }))}
                          disabled={isFieldDisabled('vitals')}
                        />
                      }
                      label="Blood Sugar"
                    />
                    {formData.blood_sugar && (
                      <TextField
                        fullWidth
                        size="small"
                        label="Blood Sugar Result"
                        value={formData.blood_sugar_result || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, blood_sugar_result: e.target.value }))}
                        disabled={isFieldDisabled('vitals')}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </Grid>
                {patient?.gender !== 'male' && (
                  <Grid item xs={12} sm={4}>
                    <Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.pregnancy_test}
                            onChange={(e) => setFormData(prev => ({ ...prev, pregnancy_test: e.target.checked }))}
                            disabled={isFieldDisabled('vitals')}
                          />
                        }
                        label="Pregnancy Test"
                      />
                      {formData.pregnancy_test && (
                        <TextField
                          fullWidth
                          size="small"
                          label="Pregnancy Test Result"
                          value={formData.pregnancy_test_result || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, pregnancy_test_result: e.target.value }))}
                          disabled={isFieldDisabled('vitals')}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Subjective Section */}
            <Grid item xs={12} ref={subjectiveRef}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Subjective
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Autocomplete<ChiefComplaint, true, false, false>
                      multiple
                      value={chiefComplaints.filter(c => formData.chief_complaint?.includes(c.id)) || []}
                      onChange={handleComplaintChange}
                      options={chiefComplaints}
                      getOptionLabel={(option: ChiefComplaint) => option.name}
                      disabled={isFieldDisabled('subjective')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Chief Complaints"
                          placeholder="Search complaints..."
                          helperText="At least one chief complaint is required"
                          error={formData.chief_complaint?.length === 0}
                        />
                      )}
                      renderTags={(tagValue, getTagProps) =>
                        tagValue.map((option, index) => (
                          <Chip
                            label={option.name}
                            {...getTagProps({ index })}
                            key={option.id}
                          />
                        ))
                      }
                      ListboxProps={{ sx: { maxHeight: '200px' } }}
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
                      disabled={isFieldDisabled('subjective')}
                      placeholder="Enter new chief complaint"
                      helperText="Please separate items with a comma"
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Autocomplete<Diagnosis, true, false, false>
                      multiple
                      value={diagnoses.filter(d => formData.diagnosis?.includes(d.id)) || []}
                      onChange={handleDiagnosisChange}
                      options={diagnoses}
                      getOptionLabel={(option: Diagnosis) => option.name}
                      disabled={isFieldDisabled('subjective')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Diagnosis"
                          placeholder="Search diagnoses..."
                          helperText="At least one diagnosis is required. If the patient is healthy, select 'WELL CHECK'"
                          error={formData.diagnosis?.length === 0}
                        />
                      )}
                      renderTags={(tagValue, getTagProps) =>
                        tagValue.map((option, index) => (
                          <Chip
                            label={option.name}
                            {...getTagProps({ index })}
                            key={option.id}
                          />
                        ))
                      }
                      ListboxProps={{ sx: { maxHeight: '200px' } }}
                    />
                  </FormControl>
                </Grid>
                {(showOtherDiagnosis || formData.other_diagnosis) && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Specify Other Diagnosis"
                      value={currentMode === 'view' ? formData.other_diagnosis : otherDiagnosisValue}
                      onChange={handleOtherDiagnosisChange}
                      disabled={isFieldDisabled('subjective')}
                      placeholder="Enter new diagnosis"
                      helperText="Please separate items with a comma"
                    />
                  </Grid>
                )}
                {/* Add Additional Details Button */}
                {!showAdditionalDetails && currentMode !== 'view' && (
                  <Grid item xs={12}>
                    <Button
                      variant="outlined"
                      onClick={() => setShowAdditionalDetails(true)}
                      startIcon={<AddIcon />}
                      sx={{ mt: 1 }}
                    >
                      Add Additional Details
                    </Button>
                  </Grid>
                )}
                {/* Additional Details Fields */}
                {(showAdditionalDetails || currentMode === 'view' || formData.past_medical_history || formData.subjective_notes) && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Past Medical History"
                        value={formData.past_medical_history || ''}
                        onChange={handleInputChange('past_medical_history')}
                        disabled={isFieldDisabled('subjective')}
                        multiline
                        rows={3}
                        placeholder="Enter patient's past medical history"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Subjective Notes"
                        value={formData.subjective_notes || ''}
                        onChange={handleInputChange('subjective_notes')}
                        disabled={isFieldDisabled('subjective')}
                        multiline
                        rows={4}
                        placeholder="Any additional data regarding diagnosis, interesting items, etc."
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Disbursement Section */}
            <Grid item xs={12} ref={disbursementRef}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Disbursements
              </Typography>
              <DisbursementForm
                ref={disbursementFormRef}
                encounterId={encounterId}
                queueItemId={currentQueueItem?.id}
                mode={currentMode}
                disabled={currentMode === 'view'}
                initialDisbursements={formData.disbursements}
                onDisbursementsChange={handleDisbursementsChange}
                currentDiagnoses={(formData.diagnosis || []).map(diagId => {
                  // Look for the diagnosis in both expanded data and full list
                  const diagRecord = formData.expand?.diagnosis?.find(d => d.id === diagId) || diagnoses.find(d => d.id === diagId);
                  return {
                    id: diagId,
                    name: diagRecord?.name || diagId
                  };
                })}
              />
            </Grid>

            {/* Questions Section */}
            <Grid item xs={12} ref={questionsRef}>
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
                disabled={isFieldDisabled('questions')}
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

      {/* Add DisbursementDebugPanel */}
      {process.env.NODE_ENV === 'development' && (
        <DisbursementDebugPanel 
          disbursements={formData.disbursements || []}
          databaseDisbursements={databaseDisbursements}
        />
      )}
    </Box>
  );
};

export default Encounter;


