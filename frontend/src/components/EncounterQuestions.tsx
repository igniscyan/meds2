import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

interface QuestionResponse extends BaseModel {
  encounter: string;
  question: string;
  response_value: string | boolean | null;
  expand?: {
    question: Question;
  };
}

interface Question extends BaseModel {
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  description?: string;
  options?: string[];
  category: string;
  order: number;
  required: boolean;
  depends_on?: string;
  archived: boolean;
  expand?: {
    category?: Category;
  }
}

interface Category extends BaseModel {
  name: string;
  type: 'counter' | 'survey';
  order: number;
}

interface EncounterQuestionsProps {
  encounterId?: string;
  disabled?: boolean;
  mode?: 'create' | 'view' | 'edit' | 'pharmacy';
  onResponsesChange: (responses: QuestionResponse[]) => void;
}

export const EncounterQuestions: React.FC<EncounterQuestionsProps> = ({
  encounterId,
  disabled = false,
  mode = 'edit',
  onResponsesChange,
}) => {
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [initialized, setInitialized] = useState(false);
  const [pendingResponseChange, setPendingResponseChange] = useState<QuestionResponse[]>([]);
  const responsesRef = useRef<{ [key: string]: any }>({});

  // Add debug logging for subscriptions
  const { records: categories } = useRealtimeSubscription<Category>(
    'encounter_question_categories',
    useMemo(() => ({ sort: 'order', filter: 'archived = false' }), [])
  );

  const { records: questions } = useRealtimeSubscription<Question>(
    'encounter_questions',
    useMemo(() => ({ sort: 'order', filter: 'archived = false', expand: 'category' }), [])
  );

  const { records: existingResponses } = useRealtimeSubscription<QuestionResponse>(
    'encounter_responses',
    useMemo(() => encounterId 
      ? { 
          filter: `encounter = "${encounterId}"`, 
          expand: 'question,question.category' 
        } 
      : undefined, [encounterId])
  );

  // Create response array for parent component
  const createResponseArray = useCallback((currentResponses: { [key: string]: any }) => {
    const responseArray = questions.map(q => {
      const responseValue = currentResponses[q.id];
      const existing = existingResponses?.find(r => r.question === q.id);
      
      // Always include checkbox responses
      if (q.input_type === 'checkbox') {
        return {
          id: existing?.id || '',
          created: existing?.created || '',
          updated: existing?.updated || '',
          collectionId: existing?.collectionId || '',
          collectionName: existing?.collectionName || '',
          encounter: encounterId || '',
          question: q.id,
          response_value: responseValue === true,  // Ensure boolean
          expand: { question: q }
        };
      }
      
      // For dependent fields, include if parent is checked
      if (q.depends_on) {
        const parentValue = currentResponses[q.depends_on];
        if (parentValue === true) {
          return {
            id: existing?.id || '',
            created: existing?.created || '',
            updated: existing?.updated || '',
            collectionId: existing?.collectionId || '',
            collectionName: existing?.collectionName || '',
            encounter: encounterId || '',
            question: q.id,
            response_value: responseValue || null,  // Convert empty string to null
            expand: { question: q }
          };
        }
        return null;
      }
      
      // For other types, include if they have a value or are required
      if (q.required || (responseValue !== undefined && responseValue !== '' && responseValue !== null)) {
        return {
          id: existing?.id || '',
          created: existing?.created || '',
          updated: existing?.updated || '',
          collectionId: existing?.collectionId || '',
          collectionName: existing?.collectionName || '',
          encounter: encounterId || '',
          question: q.id,
          response_value: responseValue || null,
          expand: { question: q }
        };
      }
      return null;
    }).filter(Boolean) as QuestionResponse[];

    return responseArray;
  }, [questions, existingResponses, encounterId]);

  // Initialize responses from existing responses
  useEffect(() => {
    if (!initialized && questions.length > 0) {
      console.log('[Response Init] Starting response initialization');
      
      const responseMap: { [key: string]: any } = {};
      
      // First pass: Initialize all questions with default values
      questions.forEach(q => {
        if (q.input_type === 'checkbox') {
          responseMap[q.id] = false;
        } else {
          responseMap[q.id] = '';
        }
      });

      // Second pass: Set existing responses
      if (existingResponses) {
        existingResponses.forEach(response => {
          if (response.response_value !== undefined) {
            responseMap[response.question] = response.response_value;
            if (response.expand?.question?.input_type === 'checkbox') {
              console.log('[Response Init] Setting checkbox:', {
                question: response.expand.question.question_text,
                value: response.response_value
              });
            }
          }
        });
      }

      setResponses(responseMap);
      responsesRef.current = responseMap;
      setInitialized(true);
      
      // Create initial response array
      const initialResponses = createResponseArray(responseMap);
      setPendingResponseChange(initialResponses);
    }
  }, [existingResponses, questions, initialized, createResponseArray]);

  // Handle response changes
  const handleResponseChange = useCallback((questionId: string, value: any) => {
    const currentQuestion = questions.find(q => q.id === questionId);
    
    if (currentQuestion?.input_type === 'checkbox') {
      console.log('[Checkbox Change]', {
        question: currentQuestion.question_text,
        newValue: value
      });
    }
    
    setResponses(prev => {
      const newResponses = { ...prev };
      newResponses[questionId] = value;
      responsesRef.current = newResponses;

      // Handle dependent fields
      if (currentQuestion?.input_type === 'checkbox') {
        questions.forEach(q => {
          if (q.depends_on === questionId) {
            console.log('[Dependent Field]', {
              parentQuestion: currentQuestion.question_text,
              dependentQuestion: q.question_text,
              parentChecked: value
            });

            if (!value) {
              // Clear dependent field when checkbox is unchecked
              newResponses[q.id] = q.input_type === 'checkbox' ? false : '';
            } else if (!newResponses[q.id]) {
              // Initialize dependent field when checkbox is checked
              newResponses[q.id] = q.input_type === 'checkbox' ? false : '';
            }

            console.log('[Dependent Value]', {
              question: q.question_text,
              newValue: newResponses[q.id]
            });
          }
        });
      }

      // Create and set response array
      const responseArray = createResponseArray(newResponses);
      setPendingResponseChange(responseArray);
      return newResponses;
    });
  }, [questions, createResponseArray]);

  // Use useEffect to handle response changes
  useEffect(() => {
    if (pendingResponseChange.length > 0) {
      console.log('[Response Change] Sending responses to parent:', pendingResponseChange);
      onResponsesChange(pendingResponseChange);
      setPendingResponseChange([]);
    }
  }, [pendingResponseChange, onResponsesChange]);

  // Memoize the question rendering function
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
      // Only hide if parent checkbox is explicitly false
      if (dependentValue === false) {
        return null;
      }
    }

    // Improved value validation based on input type
    const hasValidValue = (() => {
      if (question.input_type === 'checkbox') {
        return typeof currentValue === 'boolean';
      }
      // For dependent fields, they're valid if parent is checked
      if (question.depends_on && responses[question.depends_on]) {
        return true;
      }
      if (currentValue === undefined || currentValue === null) return false;
      switch (question.input_type) {
        case 'select':
          return currentValue !== '';
        case 'text':
          return currentValue.trim() !== '';
        default:
          return false;
      }
    })();

    const isPharmacyMode = mode === 'pharmacy';
    const shouldDisableField = disabled || isPharmacyMode;

    const commonProps = {
      disabled: shouldDisableField,
      error: !isPharmacyMode && isRequired && !hasValidValue,
      helperText: !isPharmacyMode && isRequired ? (hasValidValue ? question.description : 'This field is required') : question.description,
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
              <Box component="span" sx={{ color: isRequired && !isPharmacyMode ? 'error.main' : 'inherit' }}>
                {question.question_text}
                {isRequired && !isPharmacyMode && ' *'}
              </Box>
            }
          />
        );

      case 'text':
        if (!isSurveyQuestion) return null;
        return (
          <TextField
            fullWidth
            required={isRequired && !isPharmacyMode}
            label={question.question_text}
            value={currentValue ?? ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            {...commonProps}
          />
        );

      case 'select':
        if (!isSurveyQuestion) return null;
        return (
          <FormControl fullWidth error={commonProps.error} required={isRequired && !isPharmacyMode}>
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
  }, [responses, disabled, mode, handleResponseChange]);

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