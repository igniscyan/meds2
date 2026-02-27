import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Patient } from '../types/patient';
import { QueueItem } from '../types/queue';
import DownloadIcon from '@mui/icons-material/Download';

type ReportType = 'daily' | 'weekly' | 'custom';
type ReportCategory =
  | 'patient-analysis'
  | 'chief-complaint-analysis'
  | 'diagnosis-analysis'
  | 'disbursement-analysis'
  | 'survey-responses'
  | 'master-report';
type ReportCell = string | number;
type ReportRow = ReportCell[];

interface ReportConfig {
  type: ReportType;
  category: ReportCategory;
  startDate: Date;
  endDate: Date;
}

interface ChiefComplaint {
  id: string;
  name: string;
}

interface Diagnosis {
  id: string;
  name: string;
}

interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

interface EncounterRecord extends BaseRecord {
  chief_complaint: string[];
  diagnosis: string[];
  other_chief_complaint?: string;
  other_diagnosis?: string;
  expand?: {
    chief_complaint?: ChiefComplaint[];
    diagnosis?: Diagnosis[];
  };
}

interface DisbursementRecord extends BaseRecord {
  encounter: string;
  medication: string;
  quantity: number;
  notes: string;
  associated_diagnosis?: string;
  expand?: {
    medication?: {
      drug_name: string;
    };
    associated_diagnosis?: {
      id: string;
      name: string;
    };
  };
}

interface SurveyCategory {
  id: string;
  name: string;
  type: 'counter' | 'survey';
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  input_type: 'checkbox' | 'text' | 'select';
  expand?: {
    category?: SurveyCategory;
  };
}

interface SurveyResponseRecord extends BaseRecord {
  encounter: string;
  question: string;
  response_value: string | boolean | number | null;
  expand?: {
    question?: SurveyQuestion;
  };
}

const Reports: React.FC = () => {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'daily',
    category: 'patient-analysis',
    startDate: new Date(),
    endDate: new Date(),
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportRow[]>([]);

  const { records: patients } = useRealtimeSubscription<Patient>('patients', {});
  const { records: queueItems } = useRealtimeSubscription<QueueItem>('queue', {
    expand: 'patient,encounter',
  });
  const { records: encounters } = useRealtimeSubscription<EncounterRecord>('encounters', {
    expand: 'chief_complaint,diagnosis',
  });
  const { records: disbursements } = useRealtimeSubscription<DisbursementRecord>('disbursements', {
    expand: 'medication,encounter,associated_diagnosis',
  });
  const { records: surveyResponses } = useRealtimeSubscription<SurveyResponseRecord>('encounter_responses', {
    expand: 'question,question.category',
  });

  const parseCommaList = (text: string): string[] => {
    if (!text) return [];
    return text.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };

  const formatPercent = (numerator: number, denominator: number): string => {
    if (denominator <= 0) return '0%';
    return `${Math.round((numerator / denominator) * 100)}%`;
  };

  const calculateMode = (numbers: number[]): number => {
    if (!numbers.length) return 0;
    const frequency: { [key: number]: number } = {};
    let maxFreq = 0;
    let mode = numbers[0];

    numbers.forEach(num => {
      frequency[num] = (frequency[num] || 0) + 1;
      if (frequency[num] > maxFreq) {
        maxFreq = frequency[num];
        mode = num;
      }
    });

    return mode;
  };

  const normalizeResponseValue = (value: string | boolean | number | null): string => {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : '(blank)';
    }
    return '(blank)';
  };

  const calculateGenderDistribution = (patientList: Patient[]) => {
    const male = patientList.filter(p => p.gender === 'male').length;
    const female = patientList.filter(p => p.gender === 'female').length;
    const other = patientList.filter(p => p.gender === 'other').length;

    return { male, female, other };
  };

  const calculateAgeGroups = (patientList: Patient[]) => {
    const children = patientList.filter(p => p.age < 18).length;
    const youngAdults = patientList.filter(p => p.age >= 18 && p.age <= 30).length;
    const adults = patientList.filter(p => p.age > 30 && p.age <= 50).length;
    const seniors = patientList.filter(p => p.age > 50).length;

    return { children, youngAdults, adults, seniors };
  };

  const isWithinReportRange = (created: string, config: ReportConfig): boolean => {
    const itemDate = new Date(created);
    const startDate = new Date(config.startDate);

    if (config.type === 'daily') {
      return itemDate.toDateString() === startDate.toDateString();
    }

    if (config.type === 'weekly') {
      const weekStart = new Date(startDate);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return itemDate >= weekStart && itemDate <= weekEnd;
    }

    const customStart = new Date(config.startDate);
    customStart.setHours(0, 0, 0, 0);
    const customEnd = new Date(config.endDate);
    customEnd.setHours(23, 59, 59, 999);
    return itemDate >= customStart && itemDate <= customEnd;
  };

  const generateSurveyResponsesReport = (responses: SurveyResponseRecord[]): ReportRow[] => {
    type QuestionBucket = {
      categoryName: string;
      questionText: string;
      inputType: 'checkbox' | 'text' | 'select';
      responseCounts: Record<string, number>;
      textResponses: string[];
      totalRows: number;
    };

    const buckets: Record<string, QuestionBucket> = {};

    responses.forEach(response => {
      const question = response.expand?.question;
      if (!question) return;

      const categoryType = question.expand?.category?.type;
      if (categoryType !== 'survey') return;

      const key = question.id;
      if (!buckets[key]) {
        buckets[key] = {
          categoryName: question.expand?.category?.name || 'Uncategorized',
          questionText: question.question_text,
          inputType: question.input_type,
          responseCounts: {},
          textResponses: [],
          totalRows: 0,
        };
      }

      buckets[key].totalRows += 1;
      const normalized = normalizeResponseValue(response.response_value);

      if (question.input_type === 'text') {
        if (normalized !== '(blank)') {
          buckets[key].textResponses.push(normalized);
        }
        return;
      }

      buckets[key].responseCounts[normalized] = (buckets[key].responseCounts[normalized] || 0) + 1;
    });

    const bucketList = Object.values(buckets).sort((a, b) => {
      if (a.categoryName === b.categoryName) {
        return a.questionText.localeCompare(b.questionText);
      }
      return a.categoryName.localeCompare(b.categoryName);
    });

    if (!bucketList.length) {
      return [
        ['Category', 'Question', 'Response', 'Count', 'Percentage'],
        ['Survey', 'No survey responses found in selected range', '', 0, '0%'],
      ];
    }

    const rows: ReportRow[] = [
      ['Category', 'Question', 'Response', 'Count', 'Percentage'],
    ];

    bucketList.forEach(bucket => {
      if (bucket.inputType === 'text') {
        const textCount = bucket.textResponses.length;
        rows.push([
          bucket.categoryName,
          bucket.questionText,
          'Text responses submitted',
          textCount,
          formatPercent(textCount, bucket.totalRows),
        ]);

        if (textCount > 0) {
          const textFrequency: Record<string, number> = {};
          bucket.textResponses.forEach(text => {
            textFrequency[text] = (textFrequency[text] || 0) + 1;
          });

          Object.entries(textFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([text, count]) => {
              const preview = text.length > 90 ? `${text.slice(0, 90)}...` : text;
              rows.push([
                bucket.categoryName,
                bucket.questionText,
                `Sample: ${preview}`,
                count,
                formatPercent(count, textCount),
              ]);
            });
        }

        rows.push(['', '', '', '', '']);
        return;
      }

      const optionRows = Object.entries(bucket.responseCounts).sort((a, b) => b[1] - a[1]);
      if (!optionRows.length) {
        rows.push([bucket.categoryName, bucket.questionText, 'No responses', 0, '0%']);
        rows.push(['', '', '', '', '']);
        return;
      }

      optionRows.forEach(([responseText, count]) => {
        rows.push([
          bucket.categoryName,
          bucket.questionText,
          responseText,
          count,
          formatPercent(count, bucket.totalRows),
        ]);
      });
      rows.push(['', '', '', '', '']);
    });

    return rows;
  };

  const generateMasterReport = (
    timeFilteredQueue: QueueItem[],
    timeFilteredEncounters: EncounterRecord[],
    timeFilteredDisbursements: DisbursementRecord[],
    timeFilteredSurveyResponses: SurveyResponseRecord[],
  ): ReportRow[] => {
    const rows: ReportRow[] = [['Section', 'Metric', 'Value', 'Notes']];

    const uniquePatients = new Set(timeFilteredQueue.map(item => item.patient));
    const patientDetails = Array.from(uniquePatients)
      .map(id => patients.find(p => p.id === id))
      .filter((p): p is Patient => !!p);

    const genderDistribution = calculateGenderDistribution(patientDetails);
    const ageGroups = calculateAgeGroups(patientDetails);
    const pregnancyCount = patientDetails.filter(p => p.pregnancy_status === 'yes').length;

    rows.push(['Overview', 'Total Encounters', timeFilteredQueue.length, 'Queue records in selected range']);
    rows.push(['Overview', 'Unique Patients', uniquePatients.size, 'Distinct patients seen']);
    rows.push(['Overview', 'Total Encounters with Clinical Notes', timeFilteredEncounters.length, 'Encounter records']);
    rows.push(['Overview', 'Total Disbursement Transactions', timeFilteredDisbursements.length, 'Medication disbursements']);
    rows.push(['Overview', 'Survey Response Records', timeFilteredSurveyResponses.length, 'Survey responses captured']);
    rows.push(['', '', '', '']);

    rows.push(['Patient Mix', 'Male', genderDistribution.male, formatPercent(genderDistribution.male, patientDetails.length)]);
    rows.push(['Patient Mix', 'Female', genderDistribution.female, formatPercent(genderDistribution.female, patientDetails.length)]);
    rows.push(['Patient Mix', 'Other Gender', genderDistribution.other, formatPercent(genderDistribution.other, patientDetails.length)]);
    rows.push(['Patient Mix', 'Age 0-17', ageGroups.children, formatPercent(ageGroups.children, patientDetails.length)]);
    rows.push(['Patient Mix', 'Age 18-30', ageGroups.youngAdults, formatPercent(ageGroups.youngAdults, patientDetails.length)]);
    rows.push(['Patient Mix', 'Age 31-50', ageGroups.adults, formatPercent(ageGroups.adults, patientDetails.length)]);
    rows.push(['Patient Mix', 'Age 51+', ageGroups.seniors, formatPercent(ageGroups.seniors, patientDetails.length)]);
    rows.push(['Patient Mix', 'Pregnant Patients', pregnancyCount, formatPercent(pregnancyCount, uniquePatients.size)]);
    rows.push(['', '', '', '']);

    const complaintCounts: Record<string, number> = {};
    timeFilteredEncounters.forEach(encounter => {
      const complaintNames = encounter.expand?.chief_complaint?.map(c => c.name) || [];
      complaintNames.forEach(name => {
        if (name === 'OTHER (Custom Text Input)') {
          parseCommaList(encounter.other_chief_complaint || '').forEach(otherName => {
            const label = `Other: ${otherName}`;
            complaintCounts[label] = (complaintCounts[label] || 0) + 1;
          });
          return;
        }
        complaintCounts[name] = (complaintCounts[name] || 0) + 1;
      });
    });

    const complaintEntries = Object.entries(complaintCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (complaintEntries.length) {
      complaintEntries.forEach(([name, count]) => {
        rows.push(['Top Complaints', name, count, formatPercent(count, timeFilteredEncounters.length)]);
      });
    } else {
      rows.push(['Top Complaints', 'No complaint data in range', 0, '']);
    }
    rows.push(['', '', '', '']);

    const diagnosisCounts: Record<string, number> = {};
    timeFilteredEncounters.forEach(encounter => {
      const diagnosisNames = encounter.expand?.diagnosis?.map(d => d.name) || [];
      diagnosisNames.forEach(name => {
        if (name === 'OTHER (Custom Text Input)') {
          parseCommaList(encounter.other_diagnosis || '').forEach(otherName => {
            const label = `Other: ${otherName}`;
            diagnosisCounts[label] = (diagnosisCounts[label] || 0) + 1;
          });
          return;
        }
        diagnosisCounts[name] = (diagnosisCounts[name] || 0) + 1;
      });
    });

    const diagnosisEntries = Object.entries(diagnosisCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (diagnosisEntries.length) {
      diagnosisEntries.forEach(([name, count]) => {
        rows.push(['Top Diagnoses', name, count, formatPercent(count, timeFilteredEncounters.length)]);
      });
    } else {
      rows.push(['Top Diagnoses', 'No diagnosis data in range', 0, '']);
    }
    rows.push(['', '', '', '']);

    const medicationStats = timeFilteredDisbursements.reduce((acc: Record<string, {
      drugName: string;
      totalQuantity: number;
      uniqueEncounters: Set<string>;
      quantities: number[];
    }>, disbursement) => {
      const medicationId = disbursement.medication;
      const drugName = disbursement.expand?.medication?.drug_name || 'Unknown Medication';
      if (!acc[medicationId]) {
        acc[medicationId] = {
          drugName,
          totalQuantity: 0,
          uniqueEncounters: new Set(),
          quantities: [],
        };
      }
      acc[medicationId].totalQuantity += (disbursement.quantity || 0);
      acc[medicationId].uniqueEncounters.add(disbursement.encounter);
      acc[medicationId].quantities.push(disbursement.quantity || 0);
      return acc;
    }, {});

    const medicationEntries = Object.values(medicationStats)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    if (medicationEntries.length) {
      medicationEntries.forEach(entry => {
        rows.push([
          'Top Medications',
          entry.drugName,
          entry.totalQuantity,
          `Encounters: ${entry.uniqueEncounters.size}, Typical Qty: ${calculateMode(entry.quantities)}`,
        ]);
      });
    } else {
      rows.push(['Top Medications', 'No disbursement data in range', 0, '']);
    }
    rows.push(['', '', '', '']);

    const surveyOnly = timeFilteredSurveyResponses.filter(response => response.expand?.question?.expand?.category?.type === 'survey');
    const surveyEncounterCount = new Set(surveyOnly.map(response => response.encounter)).size;
    rows.push(['Survey', 'Encounter Coverage', surveyEncounterCount, `Coverage vs encounter records: ${formatPercent(surveyEncounterCount, timeFilteredEncounters.length)}`]);

    const recommendationQuestion = surveyOnly.filter(response =>
      response.expand?.question?.question_text?.toLowerCase().includes('recommend')
    );
    if (recommendationQuestion.length) {
      const recommendationCounts: Record<string, number> = {};
      recommendationQuestion.forEach(response => {
        const key = normalizeResponseValue(response.response_value);
        recommendationCounts[key] = (recommendationCounts[key] || 0) + 1;
      });
      Object.entries(recommendationCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([option, count]) => {
          rows.push(['Survey', `Recommendation: ${option}`, count, formatPercent(count, recommendationQuestion.length)]);
        });
    }

    const ratingQuestion = surveyOnly.filter(response =>
      response.expand?.question?.question_text?.toLowerCase().includes('overall experience')
    );
    if (ratingQuestion.length) {
      const values = ratingQuestion
        .map(response => normalizeResponseValue(response.response_value))
        .map(value => {
          const match = value.match(/^(\d)/);
          return match ? Number(match[1]) : null;
        })
        .filter((value): value is number => value !== null);

      if (values.length) {
        const average = values.reduce((sum, current) => sum + current, 0) / values.length;
        rows.push(['Survey', 'Average Experience Score (1-5)', average.toFixed(2), `Based on ${values.length} responses`]);
      }
    }

    return rows;
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);

    try {
      const timeFilteredQueue = queueItems.filter(item => isWithinReportRange(item.created, reportConfig));
      const timeFilteredEncounters = encounters.filter(encounter => isWithinReportRange(encounter.created, reportConfig));
      const timeFilteredDisbursements = disbursements.filter(disbursement => isWithinReportRange(disbursement.created, reportConfig));
      const timeFilteredSurveyResponses = surveyResponses.filter(response => isWithinReportRange(response.created, reportConfig));

      let reportData: ReportRow[] = [];

      if (reportConfig.category === 'patient-analysis') {
        const uniquePatients = new Set(timeFilteredQueue.map(item => item.patient));
        const patientDetails = Array.from(uniquePatients)
          .map(id => patients.find(p => p.id === id))
          .filter((p): p is Patient => !!p);

        const genderDistribution = calculateGenderDistribution(patientDetails);
        const ageGroups = calculateAgeGroups(patientDetails);
        const pregnancyCount = patientDetails.filter(p => p.pregnancy_status === 'yes').length;

        reportData = [
          ['Metric', 'Count', 'Percentage'],
          ['Total Patient Encounters', timeFilteredQueue.length, '100%'],
          ['Unique Patients', uniquePatients.size, formatPercent(uniquePatients.size, timeFilteredQueue.length)],
          ['Gender - Male', genderDistribution.male, formatPercent(genderDistribution.male, patientDetails.length)],
          ['Gender - Female', genderDistribution.female, formatPercent(genderDistribution.female, patientDetails.length)],
          ['Gender - Other', genderDistribution.other, formatPercent(genderDistribution.other, patientDetails.length)],
          ['Age 0-17', ageGroups.children, formatPercent(ageGroups.children, patientDetails.length)],
          ['Age 18-30', ageGroups.youngAdults, formatPercent(ageGroups.youngAdults, patientDetails.length)],
          ['Age 31-50', ageGroups.adults, formatPercent(ageGroups.adults, patientDetails.length)],
          ['Age 51+', ageGroups.seniors, formatPercent(ageGroups.seniors, patientDetails.length)],
          ['Pregnant Patients', pregnancyCount, formatPercent(pregnancyCount, uniquePatients.size)],
        ];
      } else if (reportConfig.category === 'chief-complaint-analysis') {
        const standardComplaints: Record<string, number> = {};
        const otherComplaints: Record<string, number> = {};
        let totalOtherCount = 0;

        timeFilteredEncounters.forEach(encounter => {
          const complaintNames = encounter.expand?.chief_complaint?.map(c => c.name) || [];

          complaintNames.forEach(complaintName => {
            if (complaintName === 'OTHER (Custom Text Input)') {
              totalOtherCount += 1;
              parseCommaList(encounter.other_chief_complaint || '').forEach(otherText => {
                otherComplaints[otherText] = (otherComplaints[otherText] || 0) + 1;
              });
            } else if (complaintName) {
              standardComplaints[complaintName] = (standardComplaints[complaintName] || 0) + 1;
            }
          });
        });

        const totalComplaints = Object.values(standardComplaints).reduce((a, b) => a + b, 0) + totalOtherCount;

        if (totalComplaints > 0) {
          const sortedStandardComplaints = Object.entries(standardComplaints)
            .sort((a, b) => b[1] - a[1])
            .filter(([complaint]) => complaint !== 'OTHER (Custom Text Input)');

          const sortedOtherComplaints = Object.entries(otherComplaints).sort((a, b) => b[1] - a[1]);

          reportData = [
            ['Chief Complaint', 'Count', 'Percentage'],
            ...sortedStandardComplaints.map(([complaint, count]) => [complaint, count, formatPercent(count, totalComplaints)]),
            ...(totalOtherCount > 0
              ? [
                  ['OTHER (Custom Text Input)', totalOtherCount, formatPercent(totalOtherCount, totalComplaints)],
                  ['Other Complaints Breakdown', '', ''],
                  ...sortedOtherComplaints.map(([complaint, count]) => [
                    `Other: ${complaint}`,
                    count,
                    `${formatPercent(count, totalOtherCount)} of Other`,
                  ]),
                ]
              : []),
            ['', '', ''],
            ['Total', totalComplaints, '100%'],
          ];
        } else {
          reportData = [
            ['Chief Complaint', 'Count', 'Percentage'],
            ['No chief complaints found in the selected time period', 0, '0%'],
          ];
        }
      } else if (reportConfig.category === 'diagnosis-analysis') {
        const standardDiagnoses: Record<string, number> = {};
        const otherDiagnoses: Record<string, number> = {};
        let totalOtherCount = 0;

        timeFilteredEncounters.forEach(encounter => {
          const diagnosisNames = encounter.expand?.diagnosis?.map(d => d.name) || [];

          diagnosisNames.forEach(diagnosisName => {
            if (diagnosisName === 'OTHER (Custom Text Input)') {
              totalOtherCount += 1;
              parseCommaList(encounter.other_diagnosis || '').forEach(otherText => {
                otherDiagnoses[otherText] = (otherDiagnoses[otherText] || 0) + 1;
              });
            } else if (diagnosisName) {
              standardDiagnoses[diagnosisName] = (standardDiagnoses[diagnosisName] || 0) + 1;
            }
          });
        });

        const totalDiagnoses = Object.values(standardDiagnoses).reduce((a, b) => a + b, 0) + totalOtherCount;

        if (totalDiagnoses > 0) {
          const sortedStandardDiagnoses = Object.entries(standardDiagnoses)
            .sort((a, b) => b[1] - a[1])
            .filter(([diagnosis]) => diagnosis !== 'OTHER (Custom Text Input)');

          const sortedOtherDiagnoses = Object.entries(otherDiagnoses).sort((a, b) => b[1] - a[1]);

          reportData = [
            ['Diagnosis', 'Count', 'Percentage'],
            ...sortedStandardDiagnoses.map(([diagnosis, count]) => [diagnosis, count, formatPercent(count, totalDiagnoses)]),
            ...(totalOtherCount > 0
              ? [
                  ['OTHER (Custom Text Input)', totalOtherCount, formatPercent(totalOtherCount, totalDiagnoses)],
                  ['Other Diagnoses Breakdown', '', ''],
                  ...sortedOtherDiagnoses.map(([diagnosis, count]) => [
                    `Other: ${diagnosis}`,
                    count,
                    `${formatPercent(count, totalOtherCount)} of Other`,
                  ]),
                ]
              : []),
            ['', '', ''],
            ['Total', totalDiagnoses, '100%'],
          ];
        } else {
          reportData = [
            ['Diagnosis', 'Count', 'Percentage'],
            ['No diagnoses found in the selected time period', 0, '0%'],
          ];
        }
      } else if (reportConfig.category === 'disbursement-analysis') {
        const medicationStats = timeFilteredDisbursements.reduce(
          (acc: {
            [key: string]: {
              drugName: string;
              totalQuantity: number;
              uniqueEncounters: Set<string>;
              quantities: number[];
              diagnosisAssociations: {
                [diagnosisName: string]: number;
              };
            };
          }, disbursement) => {
            const medicationId = disbursement.medication;
            const drugName = disbursement.expand?.medication?.drug_name || 'Unknown Medication';

            if (!acc[medicationId]) {
              acc[medicationId] = {
                drugName,
                totalQuantity: 0,
                uniqueEncounters: new Set(),
                quantities: [],
                diagnosisAssociations: {},
              };
            }

            acc[medicationId].totalQuantity += disbursement.quantity || 0;
            acc[medicationId].uniqueEncounters.add(disbursement.encounter);
            acc[medicationId].quantities.push(disbursement.quantity || 0);

            if (disbursement.associated_diagnosis) {
              const diagnosisName = disbursement.expand?.associated_diagnosis?.name || 'Unknown Diagnosis';
              acc[medicationId].diagnosisAssociations[diagnosisName] =
                (acc[medicationId].diagnosisAssociations[diagnosisName] || 0) + 1;
            }

            return acc;
          },
          {},
        );

        if (Object.keys(medicationStats).length > 0) {
          reportData = [
            ['Row Type', 'Medication / Diagnosis', 'Total Quantity', 'Unique Encounters', 'Most Common Quantity', 'Association Count', 'Association %'],
            ...Object.values(medicationStats)
              .sort((a, b) => b.totalQuantity - a.totalQuantity)
              .flatMap(stats => {
                const mainRow: ReportRow = [
                  'Medication',
                  stats.drugName,
                  stats.totalQuantity,
                  stats.uniqueEncounters.size,
                  calculateMode(stats.quantities),
                  '',
                  '',
                ];

                const diagnosisRows: ReportRow[] = Object.entries(stats.diagnosisAssociations)
                  .sort((a, b) => b[1] - a[1])
                  .map(([diagnosis, count]) => [
                    'Diagnosis Association',
                    diagnosis,
                    '',
                    '',
                    '',
                    count,
                    formatPercent(count, stats.uniqueEncounters.size),
                  ]);

                return diagnosisRows.length > 0 ? [mainRow, ...diagnosisRows] : [mainRow];
              }),
          ];
        } else {
          reportData = [
            ['Row Type', 'Medication / Diagnosis', 'Total Quantity', 'Unique Encounters', 'Most Common Quantity', 'Association Count', 'Association %'],
            ['No disbursements found in the selected time period', '', 0, 0, 0, 0, '0%'],
          ];
        }
      } else if (reportConfig.category === 'survey-responses') {
        reportData = generateSurveyResponsesReport(timeFilteredSurveyResponses);
      } else if (reportConfig.category === 'master-report') {
        reportData = generateMasterReport(
          timeFilteredQueue,
          timeFilteredEncounters,
          timeFilteredDisbursements,
          timeFilteredSurveyResponses,
        );
      }

      setPreviewData(reportData);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
      setPreviewData([]);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    try {
      const csvContent = previewData
        .map(row => {
          return row
            .map((cell: ReportCell) => {
              if (cell === '') return '';
              if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(',');
        })
        .join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.download = `${reportConfig.category}-${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report. Please try again.');
    }
  };

  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      setReportConfig(prev => ({ ...prev, startDate: date }));
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    if (date) {
      setReportConfig(prev => ({ ...prev, endDate: date }));
    }
  };

  return (
    <RoleBasedAccess requiredRole="admin">
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Reports
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Report Configuration
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={reportConfig.type}
                  label="Report Type"
                  onChange={e => setReportConfig(prev => ({ ...prev, type: e.target.value as ReportType }))}
                >
                  <MenuItem value="daily">Daily Report</MenuItem>
                  <MenuItem value="weekly">Weekly Report</MenuItem>
                  <MenuItem value="custom">Custom Date Range</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Report Category</InputLabel>
                <Select
                  value={reportConfig.category}
                  label="Report Category"
                  onChange={e => setReportConfig(prev => ({ ...prev, category: e.target.value as ReportCategory }))}
                >
                  <MenuItem value="master-report">Master Report (Manager Summary)</MenuItem>
                  <MenuItem value="patient-analysis">Patient Analysis</MenuItem>
                  <MenuItem value="chief-complaint-analysis">Chief Complaint Analysis</MenuItem>
                  <MenuItem value="diagnosis-analysis">Diagnosis Analysis</MenuItem>
                  <MenuItem value="disbursement-analysis">Disbursement Analysis</MenuItem>
                  <MenuItem value="survey-responses">Survey Responses</MenuItem>
                </Select>
              </FormControl>

              {reportConfig.type === 'custom' && (
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <DatePicker
                      label="Start Date"
                      value={reportConfig.startDate}
                      onChange={handleStartDateChange}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                    <DatePicker
                      label="End Date"
                      value={reportConfig.endDate}
                      onChange={handleEndDateChange}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Box>
                </LocalizationProvider>
              )}

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleGenerateReport}
                disabled={generating}
                startIcon={<DownloadIcon />}
              >
                {generating ? 'Generating...' : 'Generate Preview'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Report Preview</Typography>
                {previewData.length > 0 && (
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadReport}
                    variant="outlined"
                    size="small"
                  >
                    Download CSV
                  </Button>
                )}
              </Box>
              {previewData.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {previewData[0].map((header: ReportCell, index: number) => (
                          <TableCell key={index} sx={{ fontWeight: 'bold' }}>
                            {String(header)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.slice(1).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell: ReportCell, cellIndex: number) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">
                  Select a report category and click "Generate Preview" to see results.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </RoleBasedAccess>
  );
};

export default Reports;
