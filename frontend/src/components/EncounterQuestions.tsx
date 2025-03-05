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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BaseModel } from 'pocketbase';
import { pb } from '../atoms/auth';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { EncounterMode } from '../pages/Encounter';
import { useSettings } from '../hooks/useSettings';

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
  mode?: EncounterMode;
  defaultExpanded?: boolean;
  onResponsesChange: (responses: QuestionResponse[]) => void;
}

interface ResponseMap {
  [key: string]: QuestionResponse;
}

export const EncounterQuestions: React.FC<EncounterQuestionsProps> = ({
  encounterId,
  disabled = false,
  mode = 'create',
  defaultExpanded = false,
  onResponsesChange
}) => {
  const { displayPreferences } = useSettings();
  const userRole = (pb.authStore.model as { role?: string })?.role;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const responsesRef = useRef<ResponseMap>({});
  const isInitializedRef = useRef(false);

  // Add debug logging for subscriptions
  const { records: categoryRecords, loading: categoriesLoading } = useRealtimeSubscription<Category>(
    'encounter_question_categories',
    useMemo(() => ({ 
      sort: 'order', 
      filter: 'archived = false',
      $autoCancel: false // Prevent auto-cancellation of subscription
    }), [])
  );

  const { records: questionRecords, loading: questionsLoading } = useRealtimeSubscription<Question>(
    'encounter_questions',
    useMemo(() => ({ 
      sort: 'order', 
      filter: 'archived = false', 
      expand: 'category',
      $autoCancel: false // Prevent auto-cancellation of subscription
    }), [])
  );

  const { records: existingResponses, loading: responsesLoading } = useRealtimeSubscription<QuestionResponse>(
    'encounter_responses',
    useMemo(() => encounterId 
      ? { 
          filter: `encounter = "${encounterId}"`, 
          expand: 'question,question.category',
          $autoCancel: false // Prevent auto-cancellation of subscription
        } 
      : undefined, [encounterId])
  );

  // Add debug logging for real-time updates
  useEffect(() => {
    console.log('Real-time update received:', {
      categories: categoryRecords,
      questions: questionRecords,
      responses: existingResponses
    });
  }, [categoryRecords, questionRecords, existingResponses]);

  // Force refresh of questions when categories change
  useEffect(() => {
    if (categoryRecords?.length > 0) {
      const loadQuestions = async () => {
        try {
          const categoryIds = categoryRecords.map(cat => cat.id);
          const categoryFilter = categoryIds.map(id => `category = "${id}"`).join(' || ');
          const questions = await pb.collection('encounter_questions').getList(1, 50, {
            filter: `(${categoryFilter}) && archived = false`,
            sort: 'order',
            expand: 'category'
          });
          console.log('Refreshed questions:', questions.items);
        } catch (err) {
          console.error('Error refreshing questions:', err);
        }
      };
      loadQuestions();
    }
  }, [categoryRecords]);

  // Add error recovery for responses
  useEffect(() => {
    if (encounterId && !responsesLoading && existingResponses.length === 0) {
      console.log('No responses found, checking if recovery needed');
      const checkResponses = async () => {
        try {
          const responses = await pb.collection('encounter_responses').getList<QuestionResponse>(1, 50, {
            filter: `encounter = "${encounterId}"`,
            expand: 'question,question.category'
          });
          if (responses.items.length > 0) {
            console.log('Recovered responses:', responses.items);
            const responseMap: ResponseMap = {};
            responses.items.forEach(response => {
              if (response.question && typeof response.question === 'string') {
                responseMap[response.question] = response;
              }
            });
            setResponses(responseMap);
            responsesRef.current = responseMap;
          }
        } catch (err) {
          console.error('Error recovering responses:', err);
        }
      };
      checkResponses();
    }
  }, [encounterId, responsesLoading, existingResponses]);

  const [responses, setResponses] = useState<ResponseMap>({});

  // Update loading state based on all subscriptions
  useEffect(() => {
    const isCategoriesLoading = categoriesLoading === true;
    const isQuestionsLoading = questionsLoading === true;
    const isResponsesLoading = encounterId ? responsesLoading === true : false;
    const isLoading = isCategoriesLoading || isQuestionsLoading || isResponsesLoading;
    setLoading(isLoading);
  }, [categoriesLoading, questionsLoading, responsesLoading, encounterId]);

  // Initialize responses from existingResponses
  useEffect(() => {
    if (!responsesLoading && existingResponses && !isInitializedRef.current) {
      const responseMap: ResponseMap = {};
      existingResponses.forEach(response => {
        responseMap[response.question] = response;
      });
      setResponses(responseMap);
      responsesRef.current = responseMap;
      isInitializedRef.current = true;
    }
  }, [existingResponses, responsesLoading]);

  // Add a function to check if a question should be visible
  const isQuestionVisible = useCallback((question: Question) => {
    if (!question.depends_on) return true;
    
    const parentResponse = responses[question.depends_on];
    return parentResponse?.response_value === true;
  }, [responses]);

  // Function to check if fields should be editable based on settings
  const shouldAllowEdit = useCallback(() => {
    if (disabled) return false;
    
    // If override_field_restrictions is enabled and user is admin
    if (displayPreferences?.override_field_restrictions && userRole === 'admin') {
      return true;
    }

    // If override_field_restrictions_all_roles is enabled and override_field_restrictions is enabled
    if (displayPreferences?.override_field_restrictions && 
        displayPreferences?.override_field_restrictions_all_roles) {
      return true;
    }

    // Default behavior - disable in pharmacy mode
    return mode !== 'pharmacy';
  }, [disabled, mode, displayPreferences, userRole]);

  // Handle response changes
  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => {
      const newResponses = { ...prev };
      
      // If the value is empty/false, remove it from responses
      if (value === false || value === '' || value === null || value === undefined) {
        delete newResponses[questionId];
        
        // Also remove any dependent questions
        if (questionRecords) {
          questionRecords.forEach(q => {
            if (q.depends_on === questionId) {
              delete newResponses[q.id];
            }
          });
        }
      } else {
        // Only add the response if it has a value
        const baseResponse: QuestionResponse = {
          id: '',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          collectionId: '',
          collectionName: 'encounter_responses',
          encounter: encounterId || '',
          question: questionId,
          response_value: value
        };
        
        newResponses[questionId] = baseResponse;
      }

      // Notify parent of changes - only include responses that have values
      const responseArray = Object.values(newResponses);
      onResponsesChange(responseArray);

      return newResponses;
    });
  }, [questionRecords, encounterId, onResponsesChange]);

  // Render question based on type
  const renderQuestion = useCallback((question: Question, category: Category) => {
    if (!isQuestionVisible(question)) return null;

    const isSurveyQuestion = category.type === 'survey';
    const currentValue = responses[question.id]?.response_value;
    const isRequired = false;
    const isEditable = shouldAllowEdit();

    // Common props for form controls
    const commonProps = {
      disabled: !isEditable,
      sx: { mb: 2 }
    };

    // Function to determine if a question has an error
    const hasError = (questionId: string): boolean => {
      return !isEditable && isRequired && !responses[questionId]?.response_value;
    };

    // Function to get helper text for a question
    const getHelperText = (question: Question): string | undefined => {
      return question.description;
    };

    switch (question.input_type) {
      case 'checkbox':
        return (
          <FormControlLabel
            key={question.id}
            control={
              <Checkbox
                checked={!!currentValue}
                onChange={(e) => handleResponseChange(question.id, e.target.checked)}
                disabled={commonProps.disabled}
              />
            }
            label={question.question_text}
            sx={commonProps.sx}
          />
        );

      case 'text':
        if (!isSurveyQuestion) return null;
        return (
          <TextField
            key={question.id}
            fullWidth
            label={question.question_text}
            value={currentValue || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            required={isRequired && !isEditable}
            disabled={commonProps.disabled}
            sx={commonProps.sx}
            error={hasError(question.id)}
            helperText={getHelperText(question)}
          />
        );

      case 'select':
        if (!isSurveyQuestion) return null;
        return (
          <FormControl 
            key={question.id}
            fullWidth 
            required={isRequired && !isEditable}
            {...commonProps}
            error={hasError(question.id)}
          >
            <InputLabel>{question.question_text}</InputLabel>
            <Select
              value={currentValue || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              label={question.question_text}
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
            {question.description && (
              <FormHelperText error={hasError(question.id)}>{question.description}</FormHelperText>
            )}
          </FormControl>
        );

      default:
        return null;
    }
  }, [responses, shouldAllowEdit, isQuestionVisible, handleResponseChange]);

  // Handle accordion expansion/collapse
  const handleAccordionChange = (categoryId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(prev => 
      isExpanded 
        ? [...prev, categoryId]
        : prev.filter(id => id !== categoryId)
    );
  };

  // Initialize expanded state when categories load or defaultExpanded changes
  useEffect(() => {
    if (defaultExpanded && categoryRecords?.length > 0) {
      setExpanded(categoryRecords.map(cat => cat.id));
    }
  }, [categoryRecords, defaultExpanded]);

  return (
    <Box sx={{ mt: 2 }}>
      {categoryRecords?.map(category => {
        const categoryQuestions = questionRecords?.filter(q => q.category === category.id) || [];
        if (categoryQuestions.length === 0) return null;

        return (
          <Accordion
            key={category.id}
            expanded={expanded.includes(category.id)}
            onChange={handleAccordionChange(category.id)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">{category.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ pl: 2 }}>
                {categoryQuestions.map(question => renderQuestion(question, category))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
      {loading && (
        <Typography>Loading questions...</Typography>
      )}
    </Box>
  );
};

export default EncounterQuestions;