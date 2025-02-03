import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
  IconButton,
  Typography,
  FormControlLabel,
  Switch,
  FormHelperText,
  FormGroup,
  Checkbox,
  Autocomplete,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import { pb } from '../atoms/auth';
import { BaseModel } from 'pocketbase';
import { useSettings } from '../hooks/useSettings';

interface PatientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  mode?: 'create' | 'edit' | 'new_encounter';
  initialData?: {
    id?: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: string;
    age: number;
    currentAge?: number;
    smoker: string;
    allergies?: string;
    pregnancy_status?: string;
    urinalysis?: boolean;
    blood_sugar?: boolean;
    pregnancy_test?: boolean;
    height?: number | null;
    weight?: number | null;
    temperature?: number | null;
    heart_rate?: number | null;
    systolic_pressure?: number | null;
    diastolic_pressure?: number | null;
    pulse_ox?: number | null;
    chief_complaint?: string[];
    other_chief_complaint?: string;
  };
}

interface ChiefComplaint extends BaseModel {
  id: string;
  name: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  open,
  onClose,
  onSave,
  mode = 'create',
  initialData
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { unitDisplay } = useSettings();
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    age: '' as string | number,
    smoker: '',
    height: null as number | null,
    weight: null as number | null,
    temperature: null as number | null,
    heart_rate: null as number | null,
    systolic_pressure: null as number | null,
    diastolic_pressure: null as number | null,
    allergies: '' as string,
    pregnancy_status: '',
    urinalysis: false,
    blood_sugar: false,
    pregnancy_test: false,
    pulse_ox: null as number | null,
    chief_complaint: [] as string[],
    other_chief_complaint: '',
  });

  const [addToQueue, setAddToQueue] = useState(true);
  const [lineNumber, setLineNumber] = useState<number | ''>('');
  const [useManualAge, setUseManualAge] = useState(false);
  const [dateValue, setDateValue] = useState<Date | null>(null);
  
  // Add validation state
  const [validationErrors, setValidationErrors] = useState({
    gender: false,
    lineNumber: false
  });
  const [touched, setTouched] = useState({
    gender: false,
    lineNumber: false
  });

  const [chiefComplaints, setChiefComplaints] = useState<ChiefComplaint[]>([]);
  const [showOtherComplaint, setShowOtherComplaint] = useState(false);
  const [otherComplaintValue, setOtherComplaintValue] = useState('');

  // Initialize data when modal opens or initialData changes
  useEffect(() => {
    if (!open) return; // Only run when modal is opening

    if (initialData) {
      // If editing existing patient, populate with their data
      setFormData({
        first_name: initialData.first_name ?? '',
        last_name: initialData.last_name ?? '',
        dob: initialData.dob ?? '',
        gender: initialData.gender ?? '',
        age: initialData.age ?? '',
        smoker: initialData.smoker ?? '',
        height: initialData.height ?? null,
        weight: initialData.weight ?? null,
        temperature: initialData.temperature ?? null,
        heart_rate: initialData.heart_rate ?? null,
        systolic_pressure: initialData.systolic_pressure ?? null,
        diastolic_pressure: initialData.diastolic_pressure ?? null,
        allergies: initialData.allergies ?? '',
        pregnancy_status: initialData.pregnancy_status ?? '',
        urinalysis: initialData.urinalysis ?? false,
        blood_sugar: initialData.blood_sugar ?? false,
        pregnancy_test: initialData.pregnancy_test ?? false,
        pulse_ox: initialData.pulse_ox ?? null,
        chief_complaint: initialData.chief_complaint ?? [],
        other_chief_complaint: initialData.other_chief_complaint ?? '',
      });
      setDateValue(initialData.dob ? new Date(initialData.dob) : null);
    } else {
      // If creating new patient, reset to default values
      setFormData({
        first_name: '',
        last_name: '',
        dob: '',
        gender: '',
        age: '',
        smoker: '',
        height: null,
        weight: null,
        temperature: null,
        heart_rate: null,
        systolic_pressure: null,
        diastolic_pressure: null,
        allergies: '',
        pregnancy_status: '',
        urinalysis: false,
        blood_sugar: false,
        pregnancy_test: false,
        pulse_ox: null,
        chief_complaint: [],
        other_chief_complaint: '',
      });
      setDateValue(null);
      setUseManualAge(false);
      setAddToQueue(true);
      setLineNumber('');
    }

    // Cleanup function to reset state when modal closes
    return () => {
      if (!open) {
        setFormData({
          first_name: '',
          last_name: '',
          dob: '',
          gender: '',
          age: '',
          smoker: '',
          height: null,
          weight: null,
          temperature: null,
          heart_rate: null,
          systolic_pressure: null,
          diastolic_pressure: null,
          allergies: '',
          pregnancy_status: '',
          urinalysis: false,
          blood_sugar: false,
          pregnancy_test: false,
          pulse_ox: null,
          chief_complaint: [],
          other_chief_complaint: '',
        });
        setDateValue(null);
        setUseManualAge(false);
        setAddToQueue(true);
        setLineNumber('');
      }
    };
  }, [initialData, open]);

  // Add effect to load chief complaints
  useEffect(() => {
    if (!open) return;

    const loadChiefComplaints = async () => {
      try {
        const complaintsResult = await pb.collection('chief_complaints').getList<ChiefComplaint>(1, 50, {
          sort: 'name',
          $autoCancel: false
        });
        
        setChiefComplaints(complaintsResult.items.filter((c, index, self) => 
          index === self.findIndex(t => t.name === c.name)
        ));
      } catch (error) {
        console.error('Error loading chief complaints:', error);
      }
    };

    loadChiefComplaints();
  }, [open]);

  const calculateAge = (dob: string): number => {
    try {
      if (!dob) return 0;
      // Handle both timestamp and date-only formats
      const datePart = dob.includes(' ') ? dob.split(' ')[0] : dob;
      const [year, month, day] = datePart.split('-').map(Number);
      
      // Create date in local timezone for age calculation
      const birthDate = new Date(year, month - 1, day);
      if (isNaN(birthDate.getTime())) return 0;

      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age >= 0 ? age : 0;
    } catch (error) {
      console.error('Error calculating age:', error);
      return 0;
    }
  };

  // Add helper function to parse smart age input
  const parseSmartAge = (input: string): number => {
    // Remove any spaces and convert to lowercase
    const cleanInput = input.toLowerCase().trim();
    
    // Try to match patterns like "6m", "2w", "1.5"
    const monthMatch = cleanInput.match(/^(\d+\.?\d*)m$/);
    const weekMatch = cleanInput.match(/^(\d+\.?\d*)w$/);
    
    if (monthMatch) {
      // Convert months to years
      return parseFloat(monthMatch[1]) / 12;
    } else if (weekMatch) {
      // Convert weeks to years
      return parseFloat(weekMatch[1]) / 52;
    } else {
      // Assume it's in years
      return parseFloat(cleanInput);
    }
  };

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

  // Update handleAgeChange to handle smart input
  const handleAgeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    
    // Always update the display value
    setFormData(prev => ({
      ...prev,
      age: inputValue
    }));
  };

  // Add handler for age input blur
  const handleAgeBlur = () => {
    const inputValue = formData.age.toString();
    if (!inputValue) return;

    try {
      const ageInYears = parseSmartAge(inputValue);
      if (!isNaN(ageInYears)) {
        setFormData(prev => ({
          ...prev,
          age: ageInYears
        }));
      }
    } catch (error) {
      console.error('Error parsing age:', error);
    }
  };

  // Handle date picker change
  const handleDateChange = (newValue: Date | null) => {
    console.log('DATE DEBUG: handleDateChange called with:', newValue);
    if (newValue && !isNaN(newValue.getTime())) {
      console.log('DATE DEBUG: Valid date received in handleDateChange');
      setDateValue(newValue);
      
      try {
        // Get the local date components
        const year = newValue.getFullYear();
        const month = newValue.getMonth() + 1;
        const day = newValue.getDate();
        
        // Create date string in YYYY-MM-DD format without timezone conversion
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        console.log('DATE DEBUG: Local date components:', { year, month, day });
        console.log('DATE DEBUG: Formatted date:', formattedDate);
        
        const calculatedAge = calculateAge(formattedDate);
        console.log('DATE DEBUG: Calculated age:', calculatedAge);
        
        setFormData(prev => {
          const newData = {
            ...prev,
            dob: formattedDate,
            age: calculatedAge
          };
          console.log('DATE DEBUG: Updated formData:', newData);
          return newData;
        });
      } catch (error) {
        console.error('DATE DEBUG: Error in handleDateChange:', error);
      }
    } else {
      console.log('DATE DEBUG: Invalid date in handleDateChange');
    }
  };

  // Handle manual/auto age toggle
  const handleManualAgeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const useManual = event.target.checked;
    console.log('DATE DEBUG: Manual age toggle:', useManual);
    setUseManualAge(useManual);
    
    if (!useManual && dateValue) {
      console.log('DATE DEBUG: Recalculating age from dateValue:', dateValue);
      // Recalculate age from DOB when switching back to automatic
      const formattedDate = dateValue.toISOString().split('T')[0];
      console.log('DATE DEBUG: Formatted date for age calc:', formattedDate);
      const calculatedAge = calculateAge(formattedDate);
      console.log('DATE DEBUG: Recalculated age:', calculatedAge);
      setFormData(prev => ({
        ...prev,
        age: calculatedAge
      }));
    }
  };

  const handleComplaintChange = (_event: React.SyntheticEvent, values: ChiefComplaint[]) => {
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

  const handleSubmit = async () => {
    try {
      // Validate required fields
      const newValidationErrors = {
        gender: !formData.gender,
        lineNumber: (mode === 'create' || mode === 'new_encounter') && addToQueue && !lineNumber
      };
      
      setValidationErrors(newValidationErrors);
      setTouched({
        gender: true,
        lineNumber: true
      });

      // Check if there are any validation errors
      if (Object.values(newValidationErrors).some(error => error)) {
        const errorMessages = [];
        if (newValidationErrors.gender) errorMessages.push("Gender is required");
        if (newValidationErrors.lineNumber) errorMessages.push("Line Number is required when adding to queue");
        
        alert(errorMessages.join("\n"));
        return;
      }

      // If this is a new encounter for an existing patient
      if (mode === 'new_encounter' && initialData?.id) {
        // Update pregnancy status if changed
        if (formData.pregnancy_status !== initialData.pregnancy_status) {
          await pb.collection('patients').update(initialData.id, {
            pregnancy_status: formData.pregnancy_status
          });
        }

        // Create new encounter for existing patient
        const encounterData = {
          patient: initialData.id,
          height: formData.height ? Number(formData.height) : null,
          weight: formData.weight ? Number(formData.weight) : null,
          temperature: formData.temperature ? Number(formData.temperature) : null,
          heart_rate: formData.heart_rate ? Number(formData.heart_rate) : null,
          systolic_pressure: formData.systolic_pressure ? Number(formData.systolic_pressure) : null,
          diastolic_pressure: formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null,
          pulse_ox: formData.pulse_ox ? Number(formData.pulse_ox) : null,
          urinalysis: formData.urinalysis,
          urinalysis_result: '',
          blood_sugar: formData.blood_sugar,
          blood_sugar_result: '',
          pregnancy_test: formData.pregnancy_test,
          pregnancy_test_result: '',
          chief_complaint: formData.chief_complaint,
          other_chief_complaint: formData.other_chief_complaint,
          history_of_present_illness: '',
          past_medical_history: '',
          assessment: '',
          plan: '',
          disbursements: []
        };

        // Create the encounter
        const newEncounter = await pb.collection('encounters').create(encounterData);

        // Add to queue
        if (addToQueue) {
          const queueData = {
            patient: initialData.id,
            status: 'checked_in',
            check_in_time: new Date().toISOString(),
            line_number: lineNumber ? parseInt(String(lineNumber)) : 1,
            priority: 3,
            assigned_to: null,
            start_time: null,
            end_time: null,
            encounter: newEncounter.id,
          };

          await pb.collection('queue').create(queueData);
        }

        onSave();
        onClose();
        return;
      }

      // Original create/edit patient logic
      if (mode === 'create' || mode === 'edit') {
        console.log('DATE DEBUG: Submitting with formData:', formData);
        console.log('DATE DEBUG: Current dateValue:', dateValue);
        
        // Convert age to number if it's a string
        const ageValue = typeof formData.age === 'string' ? 
          (formData.age ? parseSmartAge(formData.age) : 0) : 
          (typeof formData.age === 'number' ? formData.age : 0);

        // Calculate DOB based on age
        let defaultDob = '';
        if (useManualAge && !formData.dob) {
          const now = new Date();
          if (ageValue >= 1) {
            // For ages 1 and above, use year calculation
            defaultDob = `${now.getFullYear() - Math.floor(ageValue)}-01-01`;
          } else {
            // For ages less than 1, calculate months/weeks back from current date
            const msInYear = 365.25 * 24 * 60 * 60 * 1000;
            const ageInMs = ageValue * msInYear;
            const dobDate = new Date(now.getTime() - ageInMs);
            defaultDob = dobDate.toISOString().split('T')[0];
          }
        }

        // Prepare patient data
        const patientData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          dob: useManualAge && !formData.dob ? defaultDob : formData.dob,
          gender: formData.gender,
          age: ageValue,
          smoker: formData.smoker,
          allergies: formData.allergies,
          pregnancy_status: formData.gender === 'male' ? '' : formData.pregnancy_status,
          chief_complaint: formData.chief_complaint,
          other_chief_complaint: formData.other_chief_complaint,
        };

        let patientId: string;
        if (mode === 'edit' && initialData?.id) {
          await pb.collection('patients').update(initialData.id, patientData);
          patientId = initialData.id;
        } else {
          try {
            const newPatient = await pb.collection('patients').create(patientData);
            console.log('SUBMIT DEBUG: Patient created successfully:', newPatient);
            patientId = newPatient.id;
          } catch (createError: any) {
            console.error('SUBMIT DEBUG: Detailed create error:', {
              error: createError,
              response: createError.response,
              data: createError.data,
              message: createError.message
            });
            throw new Error(`Failed to create patient: ${createError.message}`);
          }

          // Create an initial encounter with the vitals and test fields
          const encounterData = {
            patient: patientId,
            height: formData.height ? Number(formData.height) : null,
            weight: formData.weight ? Number(formData.weight) : null,
            temperature: formData.temperature ? Number(formData.temperature) : null,
            heart_rate: formData.heart_rate ? Number(formData.heart_rate) : null,
            systolic_pressure: formData.systolic_pressure ? Number(formData.systolic_pressure) : null,
            diastolic_pressure: formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null,
            pulse_ox: formData.pulse_ox ? Number(formData.pulse_ox) : null,
            urinalysis: formData.urinalysis,
            urinalysis_result: '',
            blood_sugar: formData.blood_sugar,
            blood_sugar_result: '',
            pregnancy_test: formData.pregnancy_test,
            pregnancy_test_result: '',
            chief_complaint: formData.chief_complaint,
            other_chief_complaint: formData.other_chief_complaint,
            history_of_present_illness: '',
            past_medical_history: '',
            assessment: '',
            plan: '',
            disbursements: []
          };

          console.log('SUBMIT DEBUG: Creating encounter with data:', encounterData);

          try {
            const newEncounter = await pb.collection('encounters').create(encounterData);
            console.log('SUBMIT DEBUG: Encounter created successfully:', newEncounter);

            // Add to queue if requested and line number is provided
            if (addToQueue && lineNumber !== '') {
              console.log('SUBMIT DEBUG: Adding to queue with line number:', lineNumber);
              const queueData = {
                patient: patientId,
                status: 'checked_in',
                check_in_time: new Date().toISOString(),
                line_number: parseInt(String(lineNumber)),
                priority: 3,
                assigned_to: null,
                start_time: null,
                end_time: null,
                encounter: newEncounter.id,
              };

              console.log('SUBMIT DEBUG: Queue data:', queueData);
              await pb.collection('queue').create(queueData);
            }
          } catch (error: any) {
            console.error('SUBMIT DEBUG: Error in post-patient creation:', error);
            // Try to clean up the patient if encounter creation fails
            try {
              await pb.collection('patients').delete(patientId);
            } catch (cleanupError) {
              console.error('SUBMIT DEBUG: Failed to clean up patient after error:', cleanupError);
            }
            throw error;
          }
        }

        onSave();
        onClose();
      }

    } catch (error: any) {
      console.error('Error saving patient:', error);
      alert(`Failed to save: ${error.message || 'Unknown error occurred'}`);
    }
  };

  // Add field blur handlers
  const handleFieldBlur = (field: 'gender' | 'lineNumber') => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Update validation errors
    setValidationErrors(prev => ({
      ...prev,
      gender: field === 'gender' ? !formData.gender : prev.gender,
      lineNumber: field === 'lineNumber' && addToQueue ? !lineNumber : prev.lineNumber
    }));
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Add shouldShowSection function
  const shouldShowSection = (section: 'tests' | 'vitals' | 'queue'): boolean => {
    if (mode === 'edit') {
      return false; // Don't show tests, vitals, or queue sections in edit mode
    }
    return true; // Show all sections in create and new_encounter modes
  };

  // Update isFieldDisabled function
  const isFieldDisabled = (fieldName: string): boolean => {
    if (mode === 'new_encounter') {
      // In new_encounter mode, only disable patient identification fields
      const nonEditableFields = ['first_name', 'last_name', 'dob', 'age', 'gender'];
      return nonEditableFields.includes(fieldName);
    }
    return false;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          m: fullScreen ? 0 : 2,
          maxHeight: fullScreen ? '100%' : 'calc(100% - 64px)',
        }
      }}
    >
      <DialogTitle sx={{ 
        m: 0, 
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">
          {mode === 'new_encounter' ? 'New Encounter' : mode === 'create' ? 'Add New Patient' : 'Edit Patient'}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              autoFocus
              sx={{ mb: { xs: 2, sm: 0 } }}
              disabled={isFieldDisabled('first_name')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              sx={{ mb: { xs: 2, sm: 0 } }}
              disabled={isFieldDisabled('last_name')}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date of Birth"
                value={dateValue}
                onChange={handleDateChange}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required error={touched.gender && validationErrors.gender}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.gender}
                label="Gender"
                onChange={(e) => handleInputChange('gender', e.target.value)}
                onBlur={() => handleFieldBlur('gender')}
                disabled={isFieldDisabled('gender')}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
              {touched.gender && validationErrors.gender && (
                <FormHelperText>Gender is required</FormHelperText>
              )}
            </FormControl>
          </Grid>

          {(formData.gender === 'female' || formData.gender === 'other') && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Pregnancy Status</InputLabel>
                <Select
                  value={formData.pregnancy_status}
                  label="Pregnancy Status"
                  onChange={(e) => handleInputChange('pregnancy_status', e.target.value)}
                  disabled={isFieldDisabled('pregnancy_status')}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="potentially">Potentially</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={useManualAge}
                  onChange={handleManualAgeToggle}
                />
              }
              label="Manually enter age"
            />
          </Grid>

          {useManualAge && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Age"
                value={formData.age}
                onChange={handleAgeChange}
                onBlur={handleAgeBlur}
                placeholder="Enter age (e.g. 2, 6m, 2w)"
                helperText={
                  typeof formData.age === 'number' && formData.age > 0 
                    ? `Will be saved as: ${formatAgeDisplay(formData.age)}`
                    : "Enter age in years (2), months (6m), or weeks (2w)"
                }
                InputProps={{
                  inputProps: { 
                    inputMode: 'text',
                    pattern: '^\\d*\\.?\\d*[mw]?$'
                  }
                }}
                disabled={isFieldDisabled('age')}
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Smoker</InputLabel>
              <Select
                value={formData.smoker}
                label="Smoker"
                onChange={(e) => handleInputChange('smoker', e.target.value)}
                disabled={isFieldDisabled('smoker')}
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="former">Former</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Allergies"
              multiline
              rows={2}
              value={formData.allergies}
              onChange={(e) => handleInputChange('allergies', e.target.value)}
              placeholder="Enter any known allergies"
              disabled={isFieldDisabled('allergies')}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <Autocomplete<ChiefComplaint, true, false, false>
                multiple
                value={chiefComplaints.filter(c => formData.chief_complaint?.includes(c.id)) || []}
                onChange={handleComplaintChange}
                options={chiefComplaints}
                getOptionLabel={(option: ChiefComplaint) => option.name}
                disabled={isFieldDisabled('chief_complaint')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Chief Complaints"
                    placeholder="Search complaints..."
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
                value={otherComplaintValue}
                onChange={handleOtherComplaintChange}
                disabled={isFieldDisabled('other_chief_complaint')}
                placeholder="Enter new chief complaint"
                helperText="Please use all caps for consistency"
              />
            </Grid>
          )}

          {shouldShowSection('tests') && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Initial Tests
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.urinalysis}
                        onChange={(e) => handleInputChange('urinalysis', e.target.checked)}
                      />
                    }
                    label="Urinalysis"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.blood_sugar}
                        onChange={(e) => handleInputChange('blood_sugar', e.target.checked)}
                      />
                    }
                    label="Blood Sugar"
                  />
                </Grid>
                {(formData.gender === 'female' || formData.gender === 'other') && (
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.pregnancy_test}
                          onChange={(e) => handleInputChange('pregnancy_test', e.target.checked)}
                        />
                      }
                      label="Pregnancy Test"
                    />
                  </Grid>
                )}
              </Grid>
            </Grid>
          )}

          {shouldShowSection('vitals') && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Vitals (Optional)
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Height (${unitDisplay.height})`}
                  value={formData.height ?? ''}
                  onChange={(e) => handleInputChange('height', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('height')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Weight (${unitDisplay.weight})`}
                  value={formData.weight ?? ''}
                  onChange={(e) => handleInputChange('weight', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('weight')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Temperature (°${unitDisplay.temperature})`}
                  value={formData.temperature ?? ''}
                  onChange={(e) => handleInputChange('temperature', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('temperature')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Heart Rate (bpm)"
                  value={formData.heart_rate ?? ''}
                  onChange={(e) => handleInputChange('heart_rate', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('heart_rate')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Systolic Blood Pressure"
                  value={formData.systolic_pressure ?? ''}
                  onChange={(e) => handleInputChange('systolic_pressure', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('systolic_pressure')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Diastolic Blood Pressure"
                  value={formData.diastolic_pressure ?? ''}
                  onChange={(e) => handleInputChange('diastolic_pressure', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('diastolic_pressure')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Pulse Oximetry (%)"
                  value={formData.pulse_ox ?? ''}
                  onChange={(e) => handleInputChange('pulse_ox', e.target.value ? Number(e.target.value) : null)}
                  disabled={isFieldDisabled('pulse_ox')}
                  InputProps={{
                    inputProps: {
                      min: 0,
                      max: 100,
                      step: 1
                    }
                  }}
                />
              </Grid>
            </>
          )}

          {shouldShowSection('queue') && (mode === 'create' || mode === 'new_encounter') && (
            <>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={addToQueue}
                      onChange={(e) => setAddToQueue(e.target.checked)}
                    />
                  }
                  label="Add to queue after creation"
                />
              </Grid>
              {addToQueue && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Line Number"
                    value={lineNumber}
                    onChange={(e) => setLineNumber(e.target.value ? parseInt(e.target.value) : '')}
                    onBlur={() => handleFieldBlur('lineNumber')}
                    required
                    error={touched.lineNumber && validationErrors.lineNumber}
                    helperText={touched.lineNumber && validationErrors.lineNumber ? 'Line Number is required' : ''}
                    disabled={isFieldDisabled('lineNumber')}
                  />
                </Grid>
              )}
            </>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ 
        p: 2,
        gap: 1,
        flexDirection: fullScreen ? 'column' : 'row',
        '& > button': {
          width: fullScreen ? '100%' : 'auto'
        }
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          fullWidth={fullScreen}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          fullWidth={fullScreen}
        >
          {mode === 'create' ? 'Add Patient' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientModal;
