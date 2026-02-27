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
type ReportCategory = 'patient-analysis' | 'chief-complaint-analysis' | 'diagnosis-analysis' | 'disbursement-analysis' | 'survey-responses';
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

  // Fetch all the data we need for reports
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

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);

    try {
      let reportData: ReportRow[] = [];

      if (reportConfig.category === 'patient-analysis') {
        // Patient Analysis
        const timeFilteredQueue = queueItems.filter(item =>
          isWithinReportRange(item.created, reportConfig)
        );

        const uniquePatients = new Set(timeFilteredQueue.map(item => item.patient));
        const patientDetails = Array.from(uniquePatients).map(id => 
          patients.find(p => p.id === id)
        ).filter((p): p is Patient => !!p);

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
      }
      else if (reportConfig.category === 'chief-complaint-analysis') {
        // Chief Complaint Analysis
        const timeFilteredEncounters = encounters.filter(encounter =>
          isWithinReportRange(encounter.created, reportConfig)
        );
        
        // Track standard complaints and other complaints separately
        const standardComplaints: { [key: string]: number } = {};
        const otherComplaints: { [key: string]: number } = {};
        let totalOtherCount = 0;

        timeFilteredEncounters.forEach(encounter => {
          // Handle array of chief complaints
          const complaintNames = encounter.expand?.chief_complaint?.map(c => c.name) || [];
          
          complaintNames.forEach(complaintName => {
            if (complaintName === 'OTHER (Custom Text Input)') {
              totalOtherCount++;
              if (encounter.other_chief_complaint) {
                // Parse comma-separated values
                const otherTexts = parseCommaList(encounter.other_chief_complaint);
                otherTexts.forEach(otherText => {
                  otherComplaints[otherText] = (otherComplaints[otherText] || 0) + 1;
                });
              }
            } else if (complaintName) {
              standardComplaints[complaintName] = (standardComplaints[complaintName] || 0) + 1;
            }
          });
        });

        const totalComplaints = Object.values(standardComplaints).reduce((a, b) => a + b, 0) + totalOtherCount;

        if (totalComplaints > 0) {
          // Sort standard complaints by count
          const sortedStandardComplaints = Object.entries(standardComplaints)
            .sort((a, b) => b[1] - a[1])
            .filter(([complaint]) => complaint !== 'OTHER (Custom Text Input)');

          // Sort other complaints by count
          const sortedOtherComplaints = Object.entries(otherComplaints)
            .sort((a, b) => b[1] - a[1]);

          reportData = [
            ['Chief Complaint', 'Count', 'Percentage'],
            // Add standard complaints
            ...sortedStandardComplaints.map(([complaint, count]) => 
              [complaint, count, formatPercent(count, totalComplaints)]
            ),
            // Add Other category total if there are any
            ...(totalOtherCount > 0 ? [
              ['OTHER (Custom Text Input)', totalOtherCount, formatPercent(totalOtherCount, totalComplaints)],
              ['Other Complaints Breakdown:', '', ''],
              ...sortedOtherComplaints.map(([complaint, count]) => 
                [`Other: ${complaint}`, count, `${formatPercentValue(count, totalOtherCount)} of Other`]
              )
            ] : []),
            ['', '', ''],
            ['Total', totalComplaints, '100%']
          ];
        } else {
          reportData = [
            ['Chief Complaint', 'Count', 'Percentage'],
            ['No chief complaints found in the selected time period', 0, '0%']
          ];
        }
      }
      else if (reportConfig.category === 'diagnosis-analysis') {
        // Diagnosis Analysis
        const timeFilteredEncounters = encounters.filter(encounter =>
          isWithinReportRange(encounter.created, reportConfig)
        );
        
        // Track standard diagnoses and other diagnoses separately
        const standardDiagnoses: { [key: string]: number } = {};
        const otherDiagnoses: { [key: string]: number } = {};
        let totalOtherCount = 0;

        timeFilteredEncounters.forEach(encounter => {
          // Handle array of diagnoses
          const diagnosisNames = encounter.expand?.diagnosis?.map(d => d.name) || [];
          
          diagnosisNames.forEach(diagnosisName => {
            if (diagnosisName === 'OTHER (Custom Text Input)') {
              totalOtherCount++;
              if (encounter.other_diagnosis) {
                // Parse comma-separated values
                const otherTexts = parseCommaList(encounter.other_diagnosis);
                otherTexts.forEach(otherText => {
                  otherDiagnoses[otherText] = (otherDiagnoses[otherText] || 0) + 1;
                });
              }
            } else if (diagnosisName) {
              standardDiagnoses[diagnosisName] = (standardDiagnoses[diagnosisName] || 0) + 1;
            }
          });
        });

        const totalDiagnoses = Object.values(standardDiagnoses).reduce((a, b) => a + b, 0) + totalOtherCount;

        if (totalDiagnoses > 0) {
          // Sort standard diagnoses by count
          const sortedStandardDiagnoses = Object.entries(standardDiagnoses)
            .sort((a, b) => b[1] - a[1])
            .filter(([diagnosis]) => diagnosis !== 'OTHER (Custom Text Input)');

          // Sort other diagnoses by count
          const sortedOtherDiagnoses = Object.entries(otherDiagnoses)
            .sort((a, b) => b[1] - a[1]);

          reportData = [
            ['Diagnosis', 'Count', 'Percentage'],
            // Add standard diagnoses
            ...sortedStandardDiagnoses.map(([diagnosis, count]) => 
              [diagnosis, count, formatPercent(count, totalDiagnoses)]
            ),
            // Add Other category total if there are any
            ...(totalOtherCount > 0 ? [
              ['OTHER (Custom Text Input)', totalOtherCount, formatPercent(totalOtherCount, totalDiagnoses)],
              ['Other Diagnoses Breakdown:', '', ''],
              ...sortedOtherDiagnoses.map(([diagnosis, count]) => 
                [`Other: ${diagnosis}`, count, `${formatPercentValue(count, totalOtherCount)} of Other`]
              )
            ] : []),
            ['', '', ''],
            ['Total', totalDiagnoses, '100%']
          ];
        } else {
          reportData = [
            ['Diagnosis', 'Count', 'Percentage'],
            ['No diagnoses found in the selected time period', 0, '0%']
          ];
        }
      }
      else if (reportConfig.category === 'disbursement-analysis') {
        // Disbursement Analysis
        const timeFilteredDisbursements = disbursements.filter(disbursement =>
          isWithinReportRange(disbursement.created, reportConfig)
        );

        // Group by medication
        const medicationStats = timeFilteredDisbursements.reduce((acc: {
          [key: string]: {
            drugName: string;
            totalQuantity: number;
            uniqueEncounters: Set<string>;
            quantities: number[];
            diagnosisAssociations: {
              [diagnosisName: string]: number;
            };
          }
        }, disbursement) => {
          const medicationId = disbursement.medication;
          const drugName = disbursement.expand?.medication?.drug_name || 'Unknown Medication';
          
          if (!acc[medicationId]) {
            acc[medicationId] = {
              drugName,
              totalQuantity: 0,
              uniqueEncounters: new Set(),
              quantities: [],
              diagnosisAssociations: {}
            };
          }
          
          acc[medicationId].totalQuantity += (disbursement.quantity || 0);
          acc[medicationId].uniqueEncounters.add(disbursement.encounter);
          acc[medicationId].quantities.push(disbursement.quantity || 0);

          // Track diagnosis associations
          if (disbursement.associated_diagnosis) {
            const diagnosisName = disbursement.expand?.associated_diagnosis?.name || 'Unknown Diagnosis';
            acc[medicationId].diagnosisAssociations[diagnosisName] = (acc[medicationId].diagnosisAssociations[diagnosisName] || 0) + 1;
          }
          
          return acc;
        }, {});

        if (Object.keys(medicationStats).length > 0) {
          reportData = [
            ['Row Type', 'Medication / Diagnosis', 'Total Quantity', 'Unique Encounters', 'Most Common Quantity', 'Association Count', 'Association %'],
            ...Object.values(medicationStats)
              .sort((a, b) => b.totalQuantity - a.totalQuantity)
              .flatMap(stats => {
                // Create the main medication row
                const mainRow = [
                  'Medication',
                  stats.drugName,
                  stats.totalQuantity,
                  stats.uniqueEncounters.size,
                  calculateMode(stats.quantities),
                  '',
                  '',
                ];

                // Create diagnosis association rows
                const diagnosisRows = Object.entries(stats.diagnosisAssociations)
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
              })
          ];
        } else {
          reportData = [
            ['Row Type', 'Medication / Diagnosis', 'Total Quantity', 'Unique Encounters', 'Most Common Quantity', 'Association Count', 'Association %'],
            ['No disbursements found in the selected time period', '', 0, 0, 0, 0, '0%']
          ];
        }
      }
      else if (reportConfig.category === 'survey-responses') {
        setError('Survey Responses report is not available yet.');
        setPreviewData([]);
        return;
      }

      // Only set preview data, don't download automatically
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
      // Create CSV content with proper escaping and formatting
      const csvContent = previewData.map(row => {
        return row.map((cell: ReportCell) => {
          // Handle empty cells
          if (cell === '') return '';
          // Handle cells that contain commas by wrapping in quotes
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',');
      }).join('\\n');

      // Create and download the file with BOM for Excel compatibility
      const BOM = '\\uFEFF';
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

  const calculateGenderDistribution = (patientList: Patient[]) => {
    const total = patientList.length;
    const male = patientList.filter(p => p.gender === 'male').length;
    const female = patientList.filter(p => p.gender === 'female').length;
    const other = patientList.filter(p => p.gender === 'other').length;

    return {
      male,
      female,
      other,
      malePercent: total > 0 ? (male / total) * 100 : 0,
      femalePercent: total > 0 ? (female / total) * 100 : 0,
      otherPercent: total > 0 ? (other / total) * 100 : 0,
    };
  };

  const calculateAgeGroups = (patientList: Patient[]) => {
    const total = patientList.length;
    const children = patientList.filter(p => p.age < 18).length;
    const youngAdults = patientList.filter(p => p.age >= 18 && p.age <= 30).length;
    const adults = patientList.filter(p => p.age > 30 && p.age <= 50).length;
    const seniors = patientList.filter(p => p.age > 50).length;

    return {
      children,
      youngAdults,
      adults,
      seniors,
      childrenPercent: total > 0 ? (children / total) * 100 : 0,
      youngAdultsPercent: total > 0 ? (youngAdults / total) * 100 : 0,
      adultsPercent: total > 0 ? (adults / total) * 100 : 0,
      seniorsPercent: total > 0 ? (seniors / total) * 100 : 0,
    };
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

  // Add mode calculation helper function
  const calculateMode = (numbers: number[]): number => {
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

  // Add helper function to parse comma-separated values
  const parseCommaList = (text: string): string[] => {
    if (!text) return [];
    return text.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };

  const formatPercent = (numerator: number, denominator: number): string => {
    return `${formatPercentValue(numerator, denominator)}`;
  };

  const formatPercentValue = (numerator: number, denominator: number): string => {
    if (denominator <= 0) return '0%';
    return `${Math.round((numerator / denominator) * 100)}%`;
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
          {/* Report Configuration */}
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
                  onChange={(e) => setReportConfig(prev => ({ ...prev, type: e.target.value as ReportType }))}
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
                  onChange={(e) => setReportConfig(prev => ({ ...prev, category: e.target.value as ReportCategory }))}
                >
                  <MenuItem value="patient-analysis">Patient Analysis</MenuItem>
                  <MenuItem value="chief-complaint-analysis">Chief Complaint Analysis</MenuItem>
                  <MenuItem value="diagnosis-analysis">Diagnosis Analysis</MenuItem>
                  <MenuItem value="disbursement-analysis">Disbursement Analysis</MenuItem>
                  <MenuItem value="survey-responses" disabled>
                    Survey Responses (Coming Soon)
                  </MenuItem>
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

          {/* Report Preview */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Report Preview
                </Typography>
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
                  Select a report type and click "Generate Report" to see a preview.
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
