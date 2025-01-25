import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  TextField,
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
import { Encounter } from '../types/encounter';
import { Disbursement } from '../types/disbursement';

type ReportType = 'daily' | 'weekly' | 'custom';
type ReportCategory = 'patient-analysis' | 'chief-complaint-analysis' | 'disbursement-analysis' | 'survey-responses';

interface ReportConfig {
  type: ReportType;
  category: ReportCategory;
  startDate: Date;
  endDate: Date;
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
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Fetch all the data we need for reports
  const { records: patients } = useRealtimeSubscription<Patient>('patients', {});
  const { records: queueItems } = useRealtimeSubscription<QueueItem>('queue', {
    expand: 'patient,encounter',
  });
  const { records: encounters } = useRealtimeSubscription<Encounter>('encounters', {
    expand: 'chief_complaint',
  });
  const { records: disbursements } = useRealtimeSubscription<Disbursement>('disbursements', {
    expand: 'medication,encounter',
  });

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);

    try {
      let reportData: any[] = [];

      if (reportConfig.category === 'patient-analysis') {
        // Patient Analysis
        const timeFilteredQueue = queueItems.filter(item => {
          const itemDate = new Date(item.created);
          const startDate = reportConfig.startDate;
          if (reportConfig.type === 'daily') {
            return itemDate.toDateString() === startDate.toDateString();
          } else if (reportConfig.type === 'weekly') {
            const weekStart = new Date(startDate);
            const weekEnd = new Date(startDate);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return itemDate >= weekStart && itemDate <= weekEnd;
          }
          return true;
        });

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
          ['Unique Patients', uniquePatients.size, `${Math.round((uniquePatients.size / timeFilteredQueue.length) * 100)}%`],
          ['Gender - Male', genderDistribution.male, `${Math.round(genderDistribution.malePercent)}%`],
          ['Gender - Female', genderDistribution.female, `${Math.round(genderDistribution.femalePercent)}%`],
          ['Gender - Other', genderDistribution.other, `${Math.round(genderDistribution.otherPercent)}%`],
          ['Age 0-17', ageGroups.children, `${Math.round(ageGroups.childrenPercent)}%`],
          ['Age 18-30', ageGroups.youngAdults, `${Math.round(ageGroups.youngAdultsPercent)}%`],
          ['Age 31-50', ageGroups.adults, `${Math.round(ageGroups.adultsPercent)}%`],
          ['Age 51+', ageGroups.seniors, `${Math.round(ageGroups.seniorsPercent)}%`],
          ['Pregnant Patients', pregnancyCount, `${Math.round((pregnancyCount / uniquePatients.size) * 100)}%`],
        ];
      }
      else if (reportConfig.category === 'chief-complaint-analysis') {
        // Chief Complaint Analysis
        const timeFilteredEncounters = encounters.filter(encounter => {
          const itemDate = new Date(encounter.created);
          const startDate = reportConfig.startDate;
          if (reportConfig.type === 'daily') {
            return itemDate.toDateString() === startDate.toDateString();
          } else if (reportConfig.type === 'weekly') {
            const weekStart = new Date(startDate);
            const weekEnd = new Date(startDate);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return itemDate >= weekStart && itemDate <= weekEnd;
          }
          return true;
        });

        console.log('Filtered Encounters:', timeFilteredEncounters);
        
        // Track standard complaints and other complaints separately
        const standardComplaints: { [key: string]: number } = {};
        const otherComplaints: { [key: string]: number } = {};
        let totalOtherCount = 0;

        timeFilteredEncounters.forEach(encounter => {
          const complaintName = encounter.expand?.chief_complaint?.name;
          console.log('Processing encounter:', {
            complaintName,
            otherComplaint: encounter.other_chief_complaint,
            fullEncounter: encounter
          });
          
          if (complaintName === 'OTHER (Custom Text Input)') {
            totalOtherCount++;
            if (encounter.other_chief_complaint) {
              const otherText = encounter.other_chief_complaint.trim();
              otherComplaints[otherText] = (otherComplaints[otherText] || 0) + 1;
            }
          } else if (complaintName) {
            standardComplaints[complaintName] = (standardComplaints[complaintName] || 0) + 1;
          }
        });

        console.log('Standard Complaints:', standardComplaints);
        console.log('Other Complaints:', otherComplaints);
        console.log('Total Other Count:', totalOtherCount);

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
              [complaint, count, `${Math.round((count / totalComplaints) * 100)}%`]
            ),
            // Add Other category total if there are any
            ...(totalOtherCount > 0 ? [
              ['OTHER (Custom Text Input)', totalOtherCount, `${Math.round((totalOtherCount / totalComplaints) * 100)}%`],
              ['Other Complaints Breakdown:', '', ''],
              ...sortedOtherComplaints.map(([complaint, count]) => 
                [`  • ${complaint}`, count, `${Math.round((count / totalOtherCount) * 100)}% of Other`]
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
      else if (reportConfig.category === 'disbursement-analysis') {
        // Disbursement Analysis
        const timeFilteredDisbursements = disbursements.filter(disbursement => {
          const itemDate = new Date(disbursement.created);
          const startDate = reportConfig.startDate;
          if (reportConfig.type === 'daily') {
            return itemDate.toDateString() === startDate.toDateString();
          } else if (reportConfig.type === 'weekly') {
            const weekStart = new Date(startDate);
            const weekEnd = new Date(startDate);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return itemDate >= weekStart && itemDate <= weekEnd;
          }
          return true;
        });

        console.log('Filtered Disbursements:', timeFilteredDisbursements);

        // Group by medication
        const medicationStats = timeFilteredDisbursements.reduce((acc: {
          [key: string]: {
            drugName: string;
            totalQuantity: number;
            uniqueEncounters: Set<string>;
            quantities: number[];
          }
        }, disbursement) => {
          const medicationId = disbursement.medication;
          const drugName = disbursement.expand?.medication?.drug_name || 'Unknown Medication';
          
          if (!acc[medicationId]) {
            acc[medicationId] = {
              drugName,
              totalQuantity: 0,
              uniqueEncounters: new Set(),
              quantities: []
            };
          }
          
          acc[medicationId].totalQuantity += (disbursement.quantity || 0);
          acc[medicationId].uniqueEncounters.add(disbursement.encounter);
          acc[medicationId].quantities.push(disbursement.quantity || 0);
          
          return acc;
        }, {});

        console.log('Medication Stats:', medicationStats);

        if (Object.keys(medicationStats).length > 0) {
          reportData = [
            ['Medication', 'Total Quantity Disbursed', 'Unique Patient Encounters', 'Most Common Quantity'],
            ...Object.values(medicationStats)
              .sort((a, b) => b.totalQuantity - a.totalQuantity)
              .map(stats => [
                stats.drugName,
                stats.totalQuantity,
                stats.uniqueEncounters.size,
                calculateMode(stats.quantities)
              ])
          ];
        } else {
          reportData = [
            ['Medication', 'Total Quantity Disbursed', 'Unique Patient Encounters', 'Most Common Quantity'],
            ['No disbursements found in the selected time period', 0, 0, 0]
          ];
        }
      }
      else if (reportConfig.category === 'survey-responses') {
        // Placeholder for survey responses - to be implemented
        reportData = [
          ['Survey Response Analysis - Coming Soon'],
          ['This report will be implemented in a future update.']
        ];
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
        return row.map((cell: string | number) => {
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

  // Helper functions for calculations
  const calculateAverageWaitTime = (items: QueueItem[]): number => {
    const completedItems = items.filter(item => item.status === 'completed' && item.start_time);
    if (completedItems.length === 0) return 0;

    const totalWaitTime = completedItems.reduce((acc, item) => {
      const startTime = new Date(item.start_time!).getTime();
      const checkInTime = new Date(item.check_in_time).getTime();
      return acc + (startTime - checkInTime);
    }, 0);

    return totalWaitTime / (completedItems.length * 60000); // Convert to minutes
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
      malePercent: (male / total) * 100,
      femalePercent: (female / total) * 100,
      otherPercent: (other / total) * 100,
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
      childrenPercent: (children / total) * 100,
      youngAdultsPercent: (youngAdults / total) * 100,
      adultsPercent: (adults / total) * 100,
      seniorsPercent: (seniors / total) * 100,
    };
  };

  const calculateSmokerStats = (patientList: Patient[]) => {
    const total = patientList.length;
    const yes = patientList.filter(p => p.smoker === 'yes').length;
    const no = patientList.filter(p => p.smoker === 'no').length;
    const former = patientList.filter(p => p.smoker === 'former').length;

    return {
      yes,
      no,
      former,
      yesPercent: (yes / total) * 100,
      noPercent: (no / total) * 100,
      formerPercent: (former / total) * 100,
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
                        {previewData[0].map((header: string, index: number) => (
                          <TableCell key={index} sx={{ fontWeight: 'bold' }}>
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.slice(1).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell: any, cellIndex: number) => (
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