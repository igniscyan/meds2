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

  // Handle response changes
  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => {
      const newResponses = { ...prev };
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

      // Handle dependent fields
      if (questionRecords) {
        questionRecords.forEach(q => {
          if (q.depends_on === questionId && !value) {
            newResponses[q.id] = {
              ...baseResponse,
              question: q.id,
              response_value: q.input_type === 'checkbox' ? false : ''
            };
          }
        });
      }

      return newResponses;
    });
  }, [questionRecords, encounterId]);

  // Render question based on type
  const renderQuestion = useCallback((question: Question, category: Category) => {
    const isSurveyQuestion = category.type === 'survey';
    const currentValue = responses[question.id]?.response_value;
    const isRequired = isSurveyQuestion && question.required;
    const isPharmacyMode = mode === 'pharmacy';

    // Common props for form controls
    const commonProps = {
      disabled: disabled || isPharmacyMode,
      error: !isPharmacyMode && isRequired && !currentValue,
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
            required={isRequired && !isPharmacyMode}
            {...commonProps}
          />
        );

      case 'select':
        if (!isSurveyQuestion) return null;
        return (
          <FormControl 
            key={question.id}
            fullWidth 
            required={isRequired && !isPharmacyMode}
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
  }, [responses, disabled, mode, handleResponseChange]);

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