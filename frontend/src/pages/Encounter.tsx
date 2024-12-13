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
import { Record } from 'pocketbase';
import { DisbursementForm } from '../components/DisbursementForm';
import type { DisbursementItem, MedicationRecord } from '../components/DisbursementForm';
import EncounterQuestions from '../components/EncounterQuestions';

type QueueStatus = 'checked_in' | 'with_care_team' | 'ready_pharmacy' | 'with_pharmacy' | 'completed';

interface QueueItem extends Record {
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

interface Patient extends Record {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  age: number;
  smoker: string;
}

interface ChiefComplaint extends Record {
  name: string;
}

interface Disbursement extends Record {
  encounter: string;
  medication: string;
  quantity: number;
  notes: string;
  expand?: {
    medication: MedicationRecord;
  };
}

interface InventoryItem extends Record {
  drug_name: string;
  stock: number;
  unit: string;
  notes: string;
}

interface EncounterRecord extends Record {
  patient?: string;
  height_inches?: number;
  weight?: number;
  temperature?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  assessment?: string;
  plan?: string;
  disbursements: DisbursementItem[];
}

interface EncounterProps {
  mode?: 'create' | 'view' | 'edit';
  queueItem?: QueueItem;
}

interface SavedEncounter {
  id: string;
  [key: string]: any;
}

export interface QuestionResponse extends Record {
  id: string;
  encounter: string;
  question: string;
  response_value: any;
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

const Encounter: React.FC<EncounterProps> = ({ mode = 'create' }) => {
  const { patientId, encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const [patient, setPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<Partial<EncounterRecord>>({
    patient: patientId,
    height_inches: 0,
    weight: 0,
    temperature: 98.6,
    blood_pressure_systolic: 0,
    blood_pressure_diastolic: 0,
    pulse: 0,
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
          pb.collection('patients').getOne(patientId),
          pb.collection('chief_complaints').getList(1, 50, {
            sort: 'name'
          })
        ]);
        
        setPatient(patientRecord as Patient);
        setChiefComplaints(complaintsResult.items as ChiefComplaint[]);

        // Load encounter data if viewing or editing
        if (encounterId && (mode === 'view' || mode === 'edit')) {
          const [encounterRecord, disbursements] = await Promise.all([
            pb.collection('encounters').getOne(encounterId),
            pb.collection('disbursements').getList(1, 50, {
              filter: `encounter = "${encounterId}"`,
              expand: 'medication'
            })
          ]);

          // Convert disbursements to DisbursementItems
          const disbursementItems = (disbursements.items as Disbursement[]).map(d => {
            // Calculate the multiplier based on the actual quantity and the medication's fixed quantity
            const medication = d.expand?.medication as MedicationRecord;
            const multiplier = medication ? d.quantity / medication.fixed_quantity : 1;
            
            return {
              medication: d.medication,
              quantity: medication?.fixed_quantity || d.quantity,
              disbursement_multiplier: multiplier,
              notes: d.notes || '',
              medicationDetails: medication
            };
          });

          setFormData({
            ...encounterRecord,
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
        if (!error?.message?.includes('autocancelled') && !error?.message?.includes('aborted')) {
          navigate('/patients');
        }
      }
    };
    loadData();
  }, [patientId, encounterId, mode, navigate]);

  useEffect(() => {
    const loadQueueItem = async () => {
      if (patientId) {
        try {
          const result = await pb.collection('queue').getFirstListItem(
            `patient="${patientId}" && status != "completed"`,
            { expand: 'patient,assigned_to' }
          ) as QueueItem;
          setCurrentQueueItem(result);
        } catch (error) {
          console.error('Error loading queue item:', error);
        }
      }
    };
    loadQueueItem();
  }, [patientId]);

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
    if (value === OTHER_COMPLAINT_VALUE) {
      setShowOtherComplaint(true);
      setOtherComplaintValue('');
      setFormData(prev => ({
        ...prev,
        chief_complaint: '',
      }));
    } else {
      setShowOtherComplaint(false);
      setOtherComplaintValue('');
      setFormData(prev => ({
        ...prev,
        chief_complaint: value,
      }));
    }
  };

  const handleOtherComplaintChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    setOtherComplaintValue(value);
    setFormData(prev => ({
      ...prev,
      chief_complaint: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      // If there's a custom complaint, add it to the predefined list
      if (showOtherComplaint && otherComplaintValue) {
        if (!CHIEF_COMPLAINTS.includes(otherComplaintValue)) {
          CHIEF_COMPLAINTS.push(otherComplaintValue);
        }
      }

      // Convert string values to numbers for numeric fields
      const encounterData = {
        patient: patientId,
        height_inches: Number(formData.height_inches),
        weight: Number(formData.weight),
        temperature: Number(formData.temperature),
        blood_pressure_systolic: Number(formData.blood_pressure_systolic),
        blood_pressure_diastolic: Number(formData.blood_pressure_diastolic),
        pulse: Number(formData.pulse),
        chief_complaint: formData.chief_complaint || '',
        history_of_present_illness: formData.history_of_present_illness || '',
        past_medical_history: formData.past_medical_history || '',
        assessment: formData.assessment || '',
        plan: formData.plan || '',
      };

      let savedEncounter: SavedEncounter;
      try {
        if (mode === 'edit' && encounterId) {
          savedEncounter = await pb.collection('encounters').update(encounterId, encounterData);
          
          // Delete existing responses and disbursements
          const [existingResponses, existingDisbursements] = await Promise.all([
            pb.collection('encounter_responses').getList(1, 50, {
              filter: `encounter = "${encounterId}"`
            }),
            pb.collection('disbursements').getList(1, 50, {
              filter: `encounter = "${encounterId}"`
            })
          ]);
          
          // Revert inventory quantities
          for (const d of existingDisbursements.items as Disbursement[]) {
            try {
              const medication = await pb.collection('inventory').getOne(d.medication) as InventoryItem;
              await pb.collection('inventory').update(d.medication, {
                stock: medication.stock + d.quantity
              });
            } catch (error: any) {
              if (!error.message?.includes('autocancelled')) {
                console.error(`Failed to revert inventory for medication ${d.medication}:`, error);
              }
            }
          }

          // Delete old records
          await Promise.all([
            ...existingResponses.items.map(response => 
              pb.collection('encounter_responses').delete(response.id)
                .catch(error => {
                  if (!error.message?.includes('autocancelled')) {
                    console.error(`Failed to delete response ${response.id}:`, error);
                  }
                })
            ),
            ...existingDisbursements.items.map(d => 
              pb.collection('disbursements').delete(d.id)
                .catch(error => {
                  if (!error.message?.includes('autocancelled')) {
                    console.error(`Failed to delete disbursement ${d.id}:`, error);
                  }
                })
            )
          ]);
        } else {
          savedEncounter = await pb.collection('encounters').create(encounterData);
        }

        // Save question responses
        if (questionResponses.length > 0) {
          await Promise.all(questionResponses.map(response => 
            pb.collection('encounter_responses').create({
              encounter: savedEncounter.id,
              question: response.question,
              response_value: response.response_value
            }).catch(error => {
              if (!error.message?.includes('autocancelled')) {
                console.error('Failed to save response:', error);
                throw error;
              }
            })
          ));
        }

        // Handle disbursements if any exist
        const validDisbursements = formData.disbursements?.filter(d => d.medication && d.quantity > 0) || [];
        if (validDisbursements.length > 0) {
          // First verify all stock levels
          for (const disbursement of validDisbursements) {
            const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
            const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
            
            if (medication.stock < quantity) {
              throw new Error(`Not enough stock for ${medication.drug_name}. Available: ${medication.stock}, Requested: ${quantity}`);
            }
          }
          
          // Then process all disbursements
          for (const disbursement of validDisbursements) {
            try {
              const medication = await pb.collection('inventory').getOne(disbursement.medication) as MedicationRecord;
              const quantity = disbursement.quantity * (disbursement.disbursement_multiplier || 1);
              
              // Update inventory stock
              await pb.collection('inventory').update(disbursement.medication, {
                stock: medication.stock - quantity
              });
              
              // Create disbursement record
              await pb.collection('disbursements').create({
                encounter: savedEncounter.id,
                medication: disbursement.medication,
                quantity: quantity,
                notes: disbursement.notes || '',
              });
            } catch (error: any) {
              if (!error.message?.includes('autocancelled')) {
                console.error('Error processing disbursement:', error);
                throw error;
              }
            }
          }
        }

        // Navigate only if everything succeeded
        navigate(`/patient/${patientId}`);
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

    if (currentQueueItem && savedEncounter) {
      await pb.collection('queue').update(currentQueueItem.id, {
        encounter: savedEncounter.id
      });
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
      await pb.collection('queue').update(currentQueueItem.id, {
        status: newStatus,
        ...(newStatus === 'completed' ? {
          end_time: new Date().toISOString()
        } : {})
      });
      
      if (newStatus === 'completed') {
        navigate(`/patient/${patientId}`);
      }
    } catch (error) {
      console.error('Error updating queue status:', error);
      alert('Failed to update queue status');
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
              {mode === 'create' ? 'New' : mode === 'edit' ? 'Edit' : ''} Encounter for {patient.first_name} {patient.last_name}
            </Typography>
          </Box>
          {mode === 'view' && (
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
                    disabled={mode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Weight (lbs)"
                    type="number"
                    value={formData.weight}
                    onChange={handleInputChange('weight')}
                    disabled={mode === 'view'}
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
                    disabled={mode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Pulse (bpm)"
                    type="number"
                    value={formData.pulse}
                    onChange={handleInputChange('pulse')}
                    disabled={mode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Systolic Pressure"
                    type="number"
                    value={formData.blood_pressure_systolic}
                    onChange={handleInputChange('blood_pressure_systolic')}
                    disabled={mode === 'view'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Diastolic Pressure"
                    type="number"
                    value={formData.blood_pressure_diastolic}
                    onChange={handleInputChange('blood_pressure_diastolic')}
                    disabled={mode === 'view'}
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
                      value={showOtherComplaint ? OTHER_COMPLAINT_VALUE : (formData.chief_complaint || '')}
                      onChange={handleComplaintChange}
                      disabled={mode === 'view'}
                      label="Chief Complaint"
                    >
                      {CHIEF_COMPLAINTS.map((complaint) => (
                        <MenuItem key={complaint} value={complaint}>
                          {complaint}
                        </MenuItem>
                      ))}
                      {mode !== 'view' && (
                        <MenuItem value={OTHER_COMPLAINT_VALUE}>
                          <em>Other (Specify)</em>
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                {showOtherComplaint && mode !== 'view' && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Specify Other Chief Complaint"
                      value={otherComplaintValue}
                      onChange={handleOtherComplaintChange}
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
                disabled={mode === 'view'}
                initialDisbursements={formData.disbursements}
                onDisbursementsChange={(disbursements: DisbursementItem[]) => 
                  setFormData(prev => ({ ...prev, disbursements }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Additional Questions
              </Typography>
              <EncounterQuestions
                encounterId={encounterId}
                disabled={mode === 'view'}
                onResponsesChange={(responses: QuestionResponse[]) => {
                  setQuestionResponses(responses);
                }}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                {mode !== 'view' && currentQueueItem && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleQueueStatusChange('ready_pharmacy')}
                  >
                    Ready for Pharmacy
                  </Button>
                )}
                {mode !== 'view' && (
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
                      {mode === 'edit' ? 'Save Changes' : 'Save Encounter'}
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
