import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { pb } from '../atoms/auth';

interface PatientModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PatientSubmitData) => void;
  initialData?: {
    id?: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: string;
    smoker: string;
  };
}

export interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string;
  smoker: string;
}

export interface PatientSubmitData extends Omit<PatientFormData, 'dateOfBirth'> {
  dateOfBirth: string;
  age: number;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { control, handleSubmit, reset } = useForm<PatientFormData>({
    defaultValues: {
      firstName: initialData?.first_name || '',
      lastName: initialData?.last_name || '',
      dateOfBirth: initialData?.dob ? new Date(initialData.dob) : null,
      gender: initialData?.gender || '',
      smoker: initialData?.smoker || '',
    },
  });

  // Reset form when initialData changes
  React.useEffect(() => {
    reset({
      firstName: initialData?.first_name || '',
      lastName: initialData?.last_name || '',
      dateOfBirth: initialData?.dob ? new Date(initialData.dob) : null,
      gender: initialData?.gender || '',
      smoker: initialData?.smoker || '',
    });
  }, [initialData, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormSubmit = async (data: PatientFormData) => {
    try {
      const birthDate = data.dateOfBirth;
      
      if (!birthDate) {
        throw new Error('Date of birth is required');
      }

      // Calculate age
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      const submitData: PatientSubmitData = {
        ...data,
        dateOfBirth: birthDate.toISOString(),
        age
      };

      await onSubmit(submitData);
      handleClose();
    } catch (error) {
      console.error('Error submitting patient data:', error);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialData ? 'Edit Patient' : 'New Patient'}</DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="firstName"
                control={control}
                rules={{ required: 'First name is required' }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    label="First Name"
                    fullWidth
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="lastName"
                control={control}
                rules={{ required: 'Last name is required' }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    label="Last Name"
                    fullWidth
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  rules={{ required: 'Date of birth is required' }}
                  render={({ field, fieldState: { error } }) => (
                    <DatePicker
                      {...field}
                      label="Date of Birth"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!error,
                          helperText: error?.message,
                        },
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="gender"
                control={control}
                rules={{ required: 'Gender is required' }}
                render={({ field, fieldState: { error } }) => (
                  <FormControl fullWidth error={!!error}>
                    <InputLabel>Gender</InputLabel>
                    <Select {...field} label="Gender">
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="smoker"
                control={control}
                rules={{ required: 'Smoking status is required' }}
                render={({ field, fieldState: { error } }) => (
                  <FormControl fullWidth error={!!error}>
                    <InputLabel>Smoking Status</InputLabel>
                    <Select {...field} label="Smoking Status">
                      <MenuItem value="current">Current</MenuItem>
                      <MenuItem value="prior">Prior</MenuItem>
                      <MenuItem value="never">Never</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            {initialData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PatientModal;
