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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import { pb } from '../atoms/auth';
import { useSettings } from '../hooks/useSettings';

interface PatientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: {
    id?: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: string;
    age: number;
    smoker: string;
    allergies?: string;
    urinalysis?: boolean;
    blood_sugar?: boolean;
    pregnancy_test?: boolean;
    height?: number | null;
    weight?: number | null;
    temperature?: number | null;
    heart_rate?: number | null;
    systolic_pressure?: number | null;
    diastolic_pressure?: number | null;
  };
  mode?: 'create' | 'edit';
}

export const PatientModal: React.FC<PatientModalProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  mode = 'create'
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
    urinalysis: false,
    blood_sugar: false,
    pregnancy_test: false,
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
        urinalysis: initialData.urinalysis ?? false,
        blood_sugar: initialData.blood_sugar ?? false,
        pregnancy_test: initialData.pregnancy_test ?? false,
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
        urinalysis: false,
        blood_sugar: false,
        pregnancy_test: false,
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
          urinalysis: false,
          blood_sugar: false,
          pregnancy_test: false,
        });
        setDateValue(null);
        setUseManualAge(false);
        setAddToQueue(true);
        setLineNumber('');
      }
    };
  }, [initialData, open]);

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

  const handleSubmit = async () => {
    try {
      // Validate required fields
      const newValidationErrors = {
        gender: !formData.gender,
        lineNumber: mode === 'create' && addToQueue && !lineNumber
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

      // Prepare patient data (excluding test fields)
      const patientData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: useManualAge && !formData.dob ? defaultDob : formData.dob,
        gender: formData.gender,
        age: ageValue,
        smoker: formData.smoker,
        allergies: formData.allergies,
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
          urinalysis: formData.urinalysis,
          urinalysis_result: '',
          blood_sugar: formData.blood_sugar,
          blood_sugar_result: '',
          pregnancy_test: formData.pregnancy_test,
          pregnancy_test_result: '',
          chief_complaint: null,
          other_chief_complaint: '',
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
    } catch (error: any) {
      console.error('Error saving patient:', error);
      // Show more detailed error message to the user
      alert(`Failed to save patient: ${error.message || 'Unknown error occurred'}`);
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
          {mode === 'create' ? 'Add New Patient' : 'Edit Patient'}
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
              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              autoFocus
              sx={{ mb: { xs: 2, sm: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              sx={{ mb: { xs: 2, sm: 0 } }}
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
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                onBlur={() => handleFieldBlur('gender')}
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
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Smoker</InputLabel>
              <Select
                value={formData.smoker}
                label="Smoker"
                onChange={(e) => setFormData(prev => ({ ...prev, smoker: e.target.value }))}
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
            />
          </Grid>

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
                      onChange={(e) => setFormData(prev => ({ ...prev, urinalysis: e.target.checked }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, blood_sugar: e.target.checked }))}
                    />
                  }
                  label="Blood Sugar"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.pregnancy_test}
                      onChange={(e) => setFormData(prev => ({ ...prev, pregnancy_test: e.target.checked }))}
                    />
                  }
                  label="Pregnancy Test"
                />
              </Grid>
            </Grid>
          </Grid>

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
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                height: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label={`Weight (${unitDisplay.weight})`}
              value={formData.weight ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                weight: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label={`Temperature (°${unitDisplay.temperature})`}
              value={formData.temperature ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                temperature: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Heart Rate (bpm)"
              value={formData.heart_rate ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                heart_rate: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Systolic Blood Pressure"
              value={formData.systolic_pressure ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                systolic_pressure: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Diastolic Blood Pressure"
              value={formData.diastolic_pressure ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                diastolic_pressure: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          {mode === 'create' && (
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
