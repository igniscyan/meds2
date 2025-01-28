import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  Button,
  Switch,
  Divider,
  TextField,
} from '@mui/material';
import { pb } from '../atoms/auth';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { Record, Admin } from 'pocketbase';

interface UnitDisplay {
  height: string;
  weight: string;
  temperature: string;
}

interface DisplayPreferences {
  show_priority_dropdown: boolean;
  show_care_team_assignment: boolean;
  care_team_count: number;
  show_gyn_team: boolean;
  show_optometry_team: boolean;
}

interface Settings extends Record {
  unit_display: UnitDisplay;
  display_preferences: DisplayPreferences;
  updated_by: string;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const resultList = await pb.collection('settings').getList<Settings>(1, 1, {
        sort: '-created',
      });
      if (resultList.items.length > 0) {
        setSettings(resultList.items[0]);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatedSettings = await pb.collection('settings').update<Settings>(settings.id, {
        unit_display: settings.unit_display,
        display_preferences: settings.display_preferences,
        updated_by: (pb.authStore.model as Admin)?.id
      });
      setSettings(updatedSettings);
      setError(null);
      setSaveSuccess(true);
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnitChange = (field: keyof UnitDisplay) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      unit_display: {
        ...settings.unit_display,
        [field]: event.target.value
      }
    });
  };

  const handleDisplayPreferenceChange = (field: keyof DisplayPreferences) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      display_preferences: {
        ...settings.display_preferences,
        [field]: event.target.checked
      }
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <RoleBasedAccess requiredRole="admin">
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Settings</Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings saved successfully!
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Unit Display Preferences</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            These settings only affect how units are displayed during data entry. Changing these settings will not convert or alter any existing data in the system.
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Height</Typography>
            <FormControl>
              <RadioGroup
                value={settings?.unit_display.height || 'cm'}
                onChange={handleUnitChange('height')}
              >
                <FormControlLabel value="cm" control={<Radio />} label="Centimeters (cm)" />
                <FormControlLabel value="in" control={<Radio />} label="Inches (in)" />
              </RadioGroup>
            </FormControl>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Weight</Typography>
            <FormControl>
              <RadioGroup
                value={settings?.unit_display.weight || 'kg'}
                onChange={handleUnitChange('weight')}
              >
                <FormControlLabel value="kg" control={<Radio />} label="Kilograms (kg)" />
                <FormControlLabel value="lb" control={<Radio />} label="Pounds (lb)" />
              </RadioGroup>
            </FormControl>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Temperature</Typography>
            <FormControl>
              <RadioGroup
                value={settings?.unit_display.temperature || 'F'}
                onChange={handleUnitChange('temperature')}
              >
                <FormControlLabel value="C" control={<Radio />} label="Celsius (°C)" />
                <FormControlLabel value="F" control={<Radio />} label="Fahrenheit (°F)" />
              </RadioGroup>
            </FormControl>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>Dashboard Display Preferences</Typography>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.display_preferences.show_priority_dropdown || false}
                  onChange={handleDisplayPreferenceChange('show_priority_dropdown')}
                />
              }
              label="Show Priority Dropdown"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enable to show priority selection in the queue. When disabled, default priorities will be used.
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.display_preferences.show_care_team_assignment || false}
                  onChange={handleDisplayPreferenceChange('show_care_team_assignment')}
                />
              }
              label="Show Care Team Assignment Dropdown"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enable to show care team assignment options in the queue.
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <TextField
              label="Number of Care Teams"
              type="number"
              value={settings?.display_preferences.care_team_count ?? ''}
              onChange={(e) => {
                if (!settings) return;
                const value = e.target.value === '' ? '' : parseInt(e.target.value);
                setSettings({
                  ...settings,
                  display_preferences: {
                    ...settings.display_preferences,
                    care_team_count: value === '' ? 0 : value
                  }
                });
              }}
              onBlur={(e) => {
                if (!settings) return;
                const value = parseInt(e.target.value);
                if (isNaN(value) || value < 1) {
                  setSettings({
                    ...settings,
                    display_preferences: {
                      ...settings.display_preferences,
                      care_team_count: 1
                    }
                  });
                }
              }}
              inputProps={{ min: 1 }}
              disabled={!settings?.display_preferences.show_care_team_assignment}
              sx={{ width: 200 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Set the number of care teams to display in the assignment dropdown.
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.display_preferences.show_gyn_team || false}
                  onChange={handleDisplayPreferenceChange('show_gyn_team')}
                  disabled={!settings?.display_preferences.show_care_team_assignment}
                />
              }
              label="Show Gyn Team Option"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enable to show Gyn Team in the care team assignment dropdown. Only available when care team assignment is enabled.
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.display_preferences.show_optometry_team || false}
                  onChange={handleDisplayPreferenceChange('show_optometry_team')}
                  disabled={!settings?.display_preferences.show_care_team_assignment}
                />
              }
              label="Show Optometry Team Option"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enable to show Optometry Team in the care team assignment dropdown. Only available when care team assignment is enabled.
            </Typography>
          </Box>

          <Box sx={{ mt: 4 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </RoleBasedAccess>
  );
};

export default Settings; 