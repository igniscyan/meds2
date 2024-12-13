import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormControlLabel,
  Paper,
} from '@mui/material';
import { Record } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { QuestionResponse } from '../pages/Encounter';

interface BaseRecord extends Record {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

interface Question extends BaseRecord {
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  description?: string;
  options?: string[];
  category: string;
  order: number;
}

interface Category extends BaseRecord {
  name: string;
  type: 'checkbox' | 'survey';
  order: number;
}

interface EncounterQuestionsProps {
  encounterId?: string;
  disabled?: boolean;
  onResponsesChange: (responses: QuestionResponse[]) => void;
}

export const EncounterQuestions: React.FC<EncounterQuestionsProps> = ({
  encounterId,
  disabled = false,
  onResponsesChange,
}) => {
  const [responses, setResponses] = useState<{ [key: string]: any }>({});

  // Use realtime subscriptions for categories and questions
  const { records: categories } = useRealtimeSubscription<Category>(
    'encounter_question_categories',
    { sort: 'order', filter: 'archived = false' }
  );

  const { records: questions } = useRealtimeSubscription<Question>(
    'encounter_questions',
    { sort: 'order', filter: 'archived = false', expand: 'category' }
  );

  // Use realtime subscription for responses if we have an encounterId
  const { records: existingResponses } = useRealtimeSubscription<QuestionResponse>(
    'encounter_responses',
    encounterId ? { filter: `encounter = "${encounterId}"`, expand: 'question' } : undefined
  );

  // Update responses when existingResponses change
  useEffect(() => {
    if (existingResponses.length > 0) {
      const responseMap: { [key: string]: any } = {};
      existingResponses.forEach((response) => {
        responseMap[response.question] = response.response_value;
      });
      setResponses(responseMap);
    }
  }, [existingResponses]);

  const handleResponseChange = async (questionId: string, value: any) => {
    try {
      const newResponses = { ...responses, [questionId]: value };
      setResponses(newResponses);

      if (encounterId) {
        // Find existing response
        const existingResponse = existingResponses.find(
          (r) => r.question === questionId
        );

        if (existingResponse) {
          await pb.collection('encounter_responses').update(existingResponse.id, {
            response_value: value,
          });
        } else {
          await pb.collection('encounter_responses').create({
            encounter: encounterId,
            question: questionId,
            response_value: value,
          });
        }
      }

      if (onResponsesChange) {
        // Convert the responses object to an array of QuestionResponse objects
        const responseArray: QuestionResponse[] = Object.entries(newResponses).map(([question, response_value]) => ({
          question,
          response_value,
          // Add required Record properties with placeholder values for new responses
          id: '',
          created: '',
          updated: '',
          collectionId: '',
          collectionName: '',
          encounter: encounterId || ''
        }));
        onResponsesChange(responseArray);
      }
    } catch (error) {
      console.error('Error saving response:', error);
    }
  };

  const renderQuestion = (question: Question) => {
    switch (question.input_type) {
      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!responses[question.id]}
                onChange={(e) => handleResponseChange(question.id, e.target.checked)}
                disabled={disabled}
              />
            }
            label={question.question_text}
          />
        );

      case 'text':
        return (
          <TextField
            fullWidth
            label={question.question_text}
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            disabled={disabled}
            helperText={question.description}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth>
            <FormLabel>{question.question_text}</FormLabel>
            <Select
              value={responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              disabled={disabled}
            >
              {question.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {categories.map((category) => {
        const categoryQuestions = questions.filter((q) => q.category === category.id);

        if (categoryQuestions.length === 0) return null;

        return (
          <Paper key={category.id} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {category.name}
            </Typography>
            <Box sx={{ pl: 2 }}>
              {categoryQuestions.map((question) => (
                <Box key={question.id} sx={{ mb: 2 }}>
                  {renderQuestion(question)}
                </Box>
              ))}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

export default EncounterQuestions;