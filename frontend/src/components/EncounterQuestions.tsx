import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  FormHelperText,
} from '@mui/material';
import { BaseModel } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { QuestionResponse } from '../pages/Encounter';

interface Question extends BaseModel {
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  description?: string;
  options?: string[];
  category: string;
  order: number;
  required?: boolean;
  depends_on?: string;
}

interface Category extends BaseModel {
  name: string;
  type: 'counter' | 'survey';
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
  const [initialized, setInitialized] = useState(false);

  // Use memoized subscriptions to prevent unnecessary re-renders
  const { records: categories } = useRealtimeSubscription<Category>(
    'encounter_question_categories',
    useMemo(() => ({ 
      sort: 'order', 
      filter: 'archived = false' 
    }), [])
  );

  const { records: questions } = useRealtimeSubscription<Question>(
    'encounter_questions',
    useMemo(() => ({ 
      sort: 'order', 
      filter: 'archived = false', 
      expand: 'category' 
    }), [])
  );

  const { records: existingResponses } = useRealtimeSubscription<QuestionResponse>(
    'encounter_responses',
    useMemo(() => 
      encounterId 
        ? { 
            filter: `encounter = "${encounterId}"`, 
            expand: 'question,question.category' 
          } 
        : undefined,
      [encounterId]
    )
  );

  // Create a memoized response array to prevent unnecessary updates
  const createResponseArray = useCallback((currentResponses: { [key: string]: any }) => {
    return questions.map(q => {
      const responseValue = currentResponses[q.id];
      const existing = existingResponses.find(r => r.question === q.id);
      
      // Always include the response if it exists in currentResponses
      if (responseValue === undefined) return null;

      return {
        id: existing?.id || '',
        created: existing?.created || '',
        updated: existing?.updated || '',
        collectionId: existing?.collectionId || '',
        collectionName: existing?.collectionName || '',
        encounter: encounterId || '',
        question: q.id,
        response_value: responseValue,
        expand: {
          question: q
        }
      };
    }).filter(Boolean) as QuestionResponse[];
  }, [questions, existingResponses, encounterId]);

  // Initialize responses from existing responses
  useEffect(() => {
    if (!initialized && existingResponses && questions.length > 0) {
      const responseMap: { [key: string]: any } = {};
      
      // First pass: Initialize all questions with default values
      questions.forEach(q => {
        if (q.input_type === 'checkbox') {
          responseMap[q.id] = false;
        } else if (q.input_type === 'text') {
          responseMap[q.id] = '';
        } else if (q.input_type === 'select') {
          responseMap[q.id] = '';
        }
      });

      // Second pass: Set existing responses and infer checkbox states
      existingResponses.forEach(response => {
        if (response.response_value !== undefined) {
          responseMap[response.question] = response.response_value;
          
          // Find if this is a dependent field
          const question = questions.find(q => q.id === response.question);
          if (question?.depends_on) {
            // If we have a value for a dependent field, the parent checkbox must be checked
            responseMap[question.depends_on] = true;
          }
        }
      });

      // Third pass: Ensure all dependent fields are properly handled
      questions.forEach(question => {
        if (question.depends_on) {
          const parentValue = responseMap[question.depends_on];
          const hasValue = responseMap[question.id] !== undefined && 
                          responseMap[question.id] !== '' &&
                          responseMap[question.id] !== null;
          
          // If parent is unchecked, clear dependent field
          if (!parentValue) {
            responseMap[question.id] = question.input_type === 'checkbox' ? false : '';
          }
          // If we have a value but parent is undefined, set parent to checked
          else if (hasValue && parentValue === undefined) {
            responseMap[question.depends_on] = true;
          }
        }
      });

      setResponses(responseMap);
      setInitialized(true);
      onResponsesChange(createResponseArray(responseMap));
    }
  }, [existingResponses, questions, initialized, createResponseArray, onResponsesChange]);

  // Reset when encounterId changes
  useEffect(() => {
    if (!encounterId) {
      setResponses({});
      setInitialized(false);
    }
  }, [encounterId]);

  // Handle response changes
  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => {
      const newResponses = { ...prev };
      newResponses[questionId] = value;

      // Handle dependent fields
      const currentQuestion = questions.find(q => q.id === questionId);
      if (currentQuestion?.input_type === 'checkbox') {
        questions.forEach(q => {
          if (q.depends_on === questionId) {
            if (!value) {
              // Clear dependent field when unchecking
              newResponses[q.id] = q.input_type === 'checkbox' ? false : '';
            } else {
              // When checking, either restore previous value or set default
              const existingResponse = existingResponses.find(r => r.question === q.id);
              if (existingResponse) {
                newResponses[q.id] = existingResponse.response_value;
              } else if (prev[q.id] !== undefined) {
                newResponses[q.id] = prev[q.id];
              } else {
                // Set default value if no previous value exists
                newResponses[q.id] = q.input_type === 'checkbox' ? false : '';
              }
            }
          }
        });
      }

      // Notify parent of changes
      onResponsesChange(createResponseArray(newResponses));
      return newResponses;
    });
  }, [questions, existingResponses, createResponseArray, onResponsesChange]);

  // Render question (existing implementation)
  const renderQuestion = useCallback((question: Question, category: Category) => {
    const isSurveyQuestion = category.type === 'survey';
    const isCounterQuestion = category.type === 'counter';
    
    if (isCounterQuestion && question.input_type !== 'checkbox') {
      return null;
    }

    const isRequired = isSurveyQuestion && question.required;
    const currentValue = responses[question.id];
    
    // Check dependencies
    if (question.depends_on) {
      const dependentValue = responses[question.depends_on];
      if (dependentValue === false) {
        return null;
      }
    }

    const hasValidValue = (() => {
      if (question.input_type === 'checkbox') {
        return typeof currentValue === 'boolean';
      }
      if (question.depends_on && responses[question.depends_on]) {
        return true;
      }
      return currentValue !== undefined && currentValue !== null && 
        (question.input_type !== 'text' || currentValue.trim() !== '');
    })();

    const commonProps = {
      disabled,
      error: isRequired && !hasValidValue,
      helperText: isRequired ? (hasValidValue ? question.description : 'This field is required') : question.description,
      sx: { mb: isSurveyQuestion ? 3 : 1 }
    };

    switch (question.input_type) {
      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!currentValue}
                onChange={(e) => handleResponseChange(question.id, e.target.checked)}
                {...commonProps}
              />
            }
            label={
              <Box component="span" sx={{ color: isRequired ? 'error.main' : 'inherit' }}>
                {question.question_text}
                {isRequired && ' *'}
              </Box>
            }
          />
        );

      case 'text':
        if (!isSurveyQuestion) return null;
        return (
          <TextField
            fullWidth
            required={isRequired}
            label={question.question_text}
            value={currentValue ?? ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            {...commonProps}
          />
        );

      case 'select':
        if (!isSurveyQuestion) return null;
        return (
          <FormControl fullWidth error={commonProps.error} required={isRequired}>
            <FormLabel>{question.question_text}</FormLabel>
            <Select
              value={currentValue ?? ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              {...commonProps}
            >
              <MenuItem value="">
                <em>Select an option</em>
              </MenuItem>
              {question.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {commonProps.helperText && (
              <FormHelperText>{commonProps.helperText}</FormHelperText>
            )}
          </FormControl>
        );

      default:
        return null;
    }
  }, [responses, disabled, handleResponseChange]);

  return (
    <Box>
      {categories.map((category) => {
        const categoryQuestions = questions.filter((q) => q.category === category.id);
        if (categoryQuestions.length === 0) return null;
        return (
          <Paper 
            key={category.id} 
            sx={{ 
              p: 2, 
              mb: 2,
              backgroundColor: category.type === 'survey' ? 'background.default' : 'action.hover',
              borderRadius: category.type === 'survey' ? 2 : 1
            }}
          >
            <Typography variant="h6" sx={{ mb: category.type === 'survey' ? 3 : 2 }}>
              {category.name}
              {category.type === 'counter' && (
                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                  (Item Counter)
                </Typography>
              )}
            </Typography>
            <Box sx={{ pl: 2 }}>
              {categoryQuestions.map((question) => (
                <Box key={question.id} sx={{ mb: 2 }}>
                  {renderQuestion(question, category)}
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