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
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    dob: initialData?.dob || '',
    gender: initialData?.gender || '',
    age: initialData?.age || 0,
    smoker: initialData?.smoker || '',
  });

  const [addToQueue, setAddToQueue] = useState(true);
  const [lineNumber, setLineNumber] = useState<number | ''>('');
  const [useManualAge, setUseManualAge] = useState(false);

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (field === 'dob' && !useManualAge) {
      const age = calculateAge(value);
      setFormData(prev => ({
        ...prev,
        [field]: value,
        age: age
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async () => {
    try {
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
      }

      // Add to queue if requested
      if (addToQueue && lineNumber !== '') {
        await pb.collection('queue').create({
          patient: patientId,
          status: 'checked_in',
          check_in_time: new Date().toISOString(),
          line_number: lineNumber,
          priority: 3,
          assigned_to: null,
          start_time: null,
          end_time: null,
          encounter: null,
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Failed to save patient');
    }
  };

  // Update age when DOB changes
  useEffect(() => {
    if (!useManualAge && formData.dob) {
      const age = calculateAge(formData.dob);
      setFormData(prev => ({
        ...prev,
        age: age
      }));
    }
  }, [formData.dob, useManualAge]);

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
              onChange={handleChange('first_name')}
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
              onChange={handleChange('last_name')}
              required
              sx={{ mb: { xs: 2, sm: 0 } }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={useManualAge}
                  onChange={(e) => setUseManualAge(e.target.checked)}
                />
              }
              label="Enter age manually"
            />
          </Grid>

          {!useManualAge && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={formData.dob}
                onChange={handleChange('dob')}
                required
                InputLabelProps={{ shrink: true }}
                sx={{ mb: { xs: 2, sm: 0 } }}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={useManualAge ? 12 : 6}>
            <TextField
              fullWidth
              label="Age"
              type="number"
              value={formData.age}
              onChange={handleChange('age')}
              required
              disabled={!useManualAge}
              sx={{ mb: { xs: 2, sm: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ mb: { xs: 2, sm: 0 } }}>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.gender}
                label="Gender"
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                required
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Smoker</InputLabel>
              <Select
                value={formData.smoker}
                label="Smoker"
                onChange={(e) => setFormData(prev => ({ ...prev, smoker: e.target.value }))}
                required
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="former">Former</MenuItem>
              </Select>
            </FormControl>
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
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Line Number"
                    type="number"
                    value={lineNumber}
                    onChange={(e) => setLineNumber(parseInt(e.target.value) || '')}
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
