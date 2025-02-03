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
    useMemo(() => ({ sort: 'order', filter: 'archived = false' }), [])
  );

  const { records: questionRecords, loading: questionsLoading } = useRealtimeSubscription<Question>(
    'encounter_questions',
    useMemo(() => ({ sort: 'order', filter: 'archived = false', expand: 'category' }), [])
  );

  const { records: existingResponses, loading: responsesLoading } = useRealtimeSubscription<QuestionResponse>(
    'encounter_responses',
    useMemo(() => encounterId 
      ? { 
          filter: `encounter = "${encounterId}"`, 
          expand: 'question,question.category' 
        } 
      : undefined, [encounterId])
  );

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
      error: !isEditable && isRequired && !currentValue,
      helperText: question.description,
      sx: { mb: 2 }
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
                {...commonProps}
              />
            }
            label={question.question_text}
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
            {...commonProps}
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
          >
            <FormLabel>{question.question_text}</FormLabel>
            <Select
              value={currentValue || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
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