import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAtomValue } from 'jotai';
import { Provider as JotaiProvider } from 'jotai';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DevTools } from 'jotai-devtools';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Patients from './pages/Patients';
import Encounter from './pages/Encounter';
import Inventory from './pages/Inventory';
import PatientDashboard from './pages/PatientDashboard';
import Dashboard from './pages/Dashboard';
import AuthGuard from './components/AuthGuard';
import { authModelAtom, isLoadingAtom, useAuthChangeEffect } from './atoms/auth';

const App: React.FC = () => {
  const user = useAtomValue(authModelAtom);
  const loading = useAtomValue(isLoadingAtom);

  // Initialize auth change listener
  useAuthChangeEffect();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <JotaiProvider>
      <DevTools />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {process.env.NODE_ENV === 'development' && <DevTools />}
          <Routes>
            <Route path="/" element={<Navigate to="/patients" replace />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/patients" replace />} />
            
            {/* Protected Routes */}
            <Route element={<Layout />}>
              <Route 
                path="/patients" 
                element={
                  <AuthGuard>
                    <Patients />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/patient/:patientId" 
                element={
                  <AuthGuard>
                    <PatientDashboard />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/encounter/:patientId" 
                element={
                  <AuthGuard>
                    <Encounter />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/encounter/:patientId/:encounterId" 
                element={
                  <AuthGuard>
                    <Encounter mode="view" />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/encounter/:patientId/:encounterId/edit" 
                element={
                  <AuthGuard>
                    <Encounter mode="edit" />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/inventory" 
                element={
                  <AuthGuard>
                    <Inventory />
                  </AuthGuard>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <AuthGuard>
                    <Dashboard />
                  </AuthGuard>
                } 
              />
            </Route>
          </Routes>
        </LocalizationProvider>
      </ThemeProvider>
    </JotaiProvider>
  );
};

export default App;