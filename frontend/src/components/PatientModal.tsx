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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import { pb } from '../atoms/auth';

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
    height_inches?: number | null;
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
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    age: 0,
    smoker: '',
    height_inches: null as number | null,
    weight: null as number | null,
    temperature: null as number | null,
    heart_rate: null as number | null,
    systolic_pressure: null as number | null,
    diastolic_pressure: null as number | null,
  });

  const [addToQueue, setAddToQueue] = useState(true);
  const [lineNumber, setLineNumber] = useState<number | ''>('');
  const [useManualAge, setUseManualAge] = useState(false);
  const [dateValue, setDateValue] = useState<Date | null>(null);

  // Initialize data when modal opens or initialData changes
  useEffect(() => {
    if (initialData) {
      console.log('DATE DEBUG: initialData received:', initialData);
      // Set form data
      setFormData({
        first_name: initialData.first_name,
        last_name: initialData.last_name,
        dob: initialData.dob,
        gender: initialData.gender,
        age: initialData.age,
        smoker: initialData.smoker,
        height_inches: initialData.height_inches ?? null,
        weight: initialData.weight ?? null,
        temperature: initialData.temperature ?? null,
        heart_rate: initialData.heart_rate ?? null,
        systolic_pressure: initialData.systolic_pressure ?? null,
        diastolic_pressure: initialData.diastolic_pressure ?? null,
      });

      // Set date value if DOB exists
      if (initialData.dob) {
        try {
          console.log('DATE DEBUG: Parsing DOB:', initialData.dob);
          // Extract just the date part from the timestamp
          const datePart = initialData.dob.split(' ')[0];
          console.log('DATE DEBUG: Extracted date part:', datePart);
          
          const [year, month, day] = datePart.split('-').map(Number);
          console.log('DATE DEBUG: Parsed components:', { year, month, day });
          
          // Create date in local timezone
          const date = new Date(year, month - 1, day);
          console.log('DATE DEBUG: Created date object:', date);
          
          if (!isNaN(date.getTime())) {
            console.log('DATE DEBUG: Setting dateValue to:', date);
            setDateValue(date);
          } else {
            console.log('DATE DEBUG: Invalid date detected');
          }
        } catch (error) {
          console.error('DATE DEBUG: Error parsing date:', error);
        }
      }
    }
  }, [initialData]);

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

  // Handle manual age change
  const handleAgeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAge = parseInt(event.target.value) || 0;
    setFormData(prev => ({
      ...prev,
      age: newAge
    }));
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
      console.log('DATE DEBUG: Submitting with formData:', formData);
      console.log('DATE DEBUG: Current dateValue:', dateValue);
      
      // Set a default DOB if using manual age
      const submissionData = {
        ...formData,
        dob: useManualAge && !formData.dob ? 
          `${new Date().getFullYear() - formData.age}-01-01` : 
          formData.dob
      };

      let patientId: string;
      if (mode === 'edit' && initialData?.id) {
        await pb.collection('patients').update(initialData.id, submissionData);
        patientId = initialData.id;
      } else {
        const newPatient = await pb.collection('patients').create(submissionData);
        patientId = newPatient.id;

        // Create an initial encounter with the vitals
        const encounterData = {
          patient: patientId,
          height_inches: formData.height_inches ? Number(formData.height_inches) : null,
          weight: formData.weight ? Number(formData.weight) : null,
          temperature: formData.temperature ? Number(formData.temperature) : null,
          heart_rate: formData.heart_rate ? Number(formData.heart_rate) : null,
          systolic_pressure: formData.systolic_pressure ? Number(formData.systolic_pressure) : null,
          diastolic_pressure: formData.diastolic_pressure ? Number(formData.diastolic_pressure) : null,
          chief_complaint: null,
          other_chief_complaint: '',
          history_of_present_illness: '',
          past_medical_history: '',
          assessment: '',
          plan: '',
          disbursements: []
        };

        const newEncounter = await pb.collection('encounters').create(encounterData);

        // Add to queue if requested and line number is provided
        if (addToQueue && lineNumber !== '') {
          console.log('Adding to queue with line number:', lineNumber);
          await pb.collection('queue').create({
            patient: patientId,
            status: 'checked_in',
            check_in_time: new Date().toISOString(),
            line_number: parseInt(String(lineNumber)),
            priority: 3,
            assigned_to: null,
            start_time: null,
            end_time: null,
            encounter: newEncounter.id, // Link the queue item to the new encounter
          });
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Failed to save patient');
    }
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
              required
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
              required
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
                    fullWidth: true,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.gender}
                label="Gender"
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
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
                type="number"
                label="Age"
                value={formData.age}
                onChange={handleAgeChange}
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
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
            <Typography variant="h6" gutterBottom>
              Vitals (Optional)
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Height (inches)"
              value={formData.height_inches ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                height_inches: e.target.value ? Number(e.target.value) : null 
              }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Weight (lbs)"
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
              label="Temperature (°F)"
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
                    required={addToQueue}
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
