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
import DisbursementForm from '../components/DisbursementForm';
import type { DisbursementItem, MedicationRecord } from '../components/DisbursementForm';

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

interface Encounter extends Record {
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
}

interface SavedEncounter {
  id: string;
  [key: string]: any;
}

const Encounter: React.FC<EncounterProps> = ({ mode = 'create' }) => {
  const { patientId, encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const [patient, setPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<Partial<Encounter>>({
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
    disbursements: [{
      medication: '',
      quantity: 1,
      disbursement_multiplier: 1,
      notes: '',
    }],
  });
  const [loading, setLoading] = useState(true);
  const [chiefComplaints, setChiefComplaints] = useState<ChiefComplaint[]>([]);
  const [showOtherComplaint, setShowOtherComplaint] = useState(false);
  const [otherComplaintValue, setOtherComplaintValue] = useState('');

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

  const handleInputChange = (field: keyof Encounter) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleComplaintChange = async (event: SelectChangeEvent<string>) => {
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
      // If there's a custom complaint, add it to the collection first
      if (showOtherComplaint && otherComplaintValue) {
        try {
          const newComplaint = await pb.collection('chief_complaints').create({
            name: otherComplaintValue
          });
          // Add the new complaint to the local state
          setChiefComplaints(prev => [...prev, newComplaint as ChiefComplaint]);
        } catch (error) {
          console.error('Error adding new chief complaint:', error);
          // Continue with form submission even if complaint creation fails
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
      if (mode === 'edit' && encounterId) {
        savedEncounter = await pb.collection('encounters').update(encounterId, encounterData);
        
        // Delete existing disbursements
        const existingDisbursements = await pb.collection('disbursements').getList(1, 50, {
          filter: `encounter = "${encounterId}"`
        });
        
        // Revert inventory quantities
        for (const d of existingDisbursements.items as Disbursement[]) {
          try {
            const medication = await pb.collection('inventory').getOne(d.medication) as InventoryItem;
            await pb.collection('inventory').update(d.medication, {
              stock: medication.stock + d.quantity
            });
          } catch (error) {
            console.error(`Failed to revert inventory for medication ${d.medication}:`, error);
            // Continue with other disbursements even if one fails
          }
        }
        
        // Delete old disbursements
        await Promise.all(existingDisbursements.items.map(d => 
          pb.collection('disbursements').delete(d.id).catch(error => {
            console.error(`Failed to delete disbursement ${d.id}:`, error);
          })
        ));
      } else {
        savedEncounter = await pb.collection('encounters').create(encounterData);
      }

      // Create disbursements and update inventory
      if (formData.disbursements && formData.disbursements.length > 0) {
        const validDisbursements = formData.disbursements.filter(d => d.medication);
        
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
            console.error('Error processing disbursement:', error);
            throw error; // Re-throw to handle in outer catch block
          }
        }
      }

      // Update queue status if this was from the queue
      try {
        const queueItems = await pb.collection('queue').getList(1, 1, {
          filter: `patient = "${patientId}" && status = "in_progress"`
        });
        
        if (queueItems.items.length > 0) {
          await pb.collection('queue').update(queueItems.items[0].id, {
            status: 'completed',
            end_time: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error updating queue status:', error);
        // Don't throw here, as the encounter was still saved successfully
      }

      navigate(`/patient/${patientId}`);
    } catch (error: any) {
      console.error('Error saving encounter:', error);
      if (error.response?.data) {
        console.error('Detailed error:', error.response.data);
      }
      alert('Failed to save encounter. Please try again.');
    }
  };

  const handleEdit = () => {
    navigate(`/encounter/${patientId}/${encounterId}/edit`);
  };

  const handleBack = () => {
    // Always go back to patient dashboard when viewing an encounter
    navigate(`/patient/${patientId}`);
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
                      {chiefComplaints.map((complaint) => (
                        <MenuItem key={complaint.id} value={complaint.name}>
                          {complaint.name}
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
                      helperText="This will be added to the list of available complaints"
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
                onDisbursementsChange={(disbursements) => 
                  setFormData(prev => ({ ...prev, disbursements }))
                }
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
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
