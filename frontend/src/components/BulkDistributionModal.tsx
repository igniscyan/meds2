import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Box,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { pb } from '../atoms/auth';
import { Record } from 'pocketbase';

interface EncounterQuestion extends Record {
  question_text: string;
  input_type: string;
  category: string;
  order: number;
  required: boolean;
  archived: boolean;
}

interface StandardItem {
  id: string;
  question_text: string;
  quantity: number | null;
}

interface BulkDistribution extends Record {
  date: string;
  notes?: string;
}

interface BulkDistributionItem extends Record {
  distribution: string;
  question: string;
  quantity: number;
  expand?: {
    question: EncounterQuestion;
  };
}

interface BulkDistributionModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const BulkDistributionModal: React.FC<BulkDistributionModalProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [standardItems, setStandardItems] = useState<StandardItem[]>([]);
  const [notes, setNotes] = useState('');

  // Load standard items (counter type questions)
  useEffect(() => {
    const loadStandardItems = async () => {
      try {
        // Get all counter-type categories
        const categories = await pb.collection('encounter_question_categories').getList(1, 50, {
          filter: 'type = "counter" && archived = false'
        });

        if (categories.items.length === 0) {
          throw new Error('No counter-type categories found');
        }

        // Get all checkbox questions from counter categories
        const categoryIds = categories.items.map(cat => cat.id);
        const categoryFilter = categoryIds.map(id => `category = "${id}"`).join(' || ');
        const questions = await pb.collection('encounter_questions').getList<EncounterQuestion>(1, 50, {
          filter: `(${categoryFilter}) && input_type = "checkbox" && archived = false`,
          sort: 'order',
          expand: 'category'
        });

        if (questions.items.length === 0) {
          throw new Error('No counter items found');
        }

        setStandardItems(
          questions.items.map(item => ({
            id: item.id,
            question_text: item.question_text,
            quantity: null,
          }))
        );
        setLoading(false);
      } catch (err) {
        console.error('Error loading counter items:', err);
        setError('Failed to load counter items');
        setLoading(false);
      }
    };

    if (open) {
      loadStandardItems();
    }
  }, [open]);

  const handleQuantityChange = (id: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setStandardItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: numValue } : item
      )
    );
  };

  const handleSubmit = async () => {
    try {
      // Filter out items with quantity 0 or null
      const itemsToSave = standardItems.filter(item => item.quantity && item.quantity > 0);
      
      if (itemsToSave.length === 0) {
        setError('Please enter at least one item quantity');
        return;
      }

      // Create the bulk distribution record
      const distribution = await pb.collection('bulk_distributions').create<BulkDistribution>({
        date: new Date().toISOString().split('T')[0],
        notes: notes || null,
      });

      // Create bulk distribution items one at a time to avoid race conditions
      for (const item of itemsToSave) {
        try {
          await pb.collection('bulk_distribution_items').create<BulkDistributionItem>({
            distribution: distribution.id,
            question: item.id,
            quantity: item.quantity,
          });
        } catch (itemErr) {
          console.error('Error saving item:', itemErr);
          // Continue with other items even if one fails
        }
      }

      // Reset form
      setStandardItems(prev => prev.map(item => ({ ...item, quantity: 0 })));
      setNotes('');
      setError(null);

      onComplete();
    } catch (err) {
      console.error('Error saving bulk distribution:', err);
      setError('Failed to save bulk distribution');
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
          Fast Track Patient
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
        {loading ? (
          <Typography>Loading...</Typography>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : (
          <Grid container spacing={2}>
            {standardItems.map((item) => (
              <Grid item xs={12} key={item.id}>
                <Box display="flex" alignItems="center" gap={2}>
                  <TextField
                    label={item.question_text}
                    type="number"
                    value={item.quantity ?? ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    InputProps={{ inputProps: { min: 0 } }}
                    fullWidth
                  />
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <TextField
                label="Notes"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        )}
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
          disabled={loading}
        >
          Save Distribution
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkDistributionModal; 