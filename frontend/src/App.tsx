import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAtomValue } from 'jotai/react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DevTools } from 'jotai-devtools';
import { useAtomsDebugValue } from 'jotai-devtools/utils';
import Layout from './components/Layout';
import Login from './pages/Login';
import Patients from './pages/Patients';
import Encounter from './pages/Encounter';
import Inventory from './pages/Inventory';
import PatientDashboard from './pages/PatientDashboard';
import Dashboard from './pages/Dashboard';
import AuthGuard from './components/AuthGuard';
import { authModelAtom, isLoadingAtom, pb, useAuthChangeEffect } from './atoms/auth';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import { ActiveEditorCleanup } from './components/ActiveEditorCleanup';
import settingsService from './services/settingsService';

const isDevelopment = process.env.NODE_ENV === 'development';
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

const App: React.FC = () => {
  const user = useAtomValue(authModelAtom);
  const loading = useAtomValue(isLoadingAtom);

  // Initialize auth change listener
  useAuthChangeEffect();
  
  // Initialize settings service
  useEffect(() => {
    // Only initialize settings if user is authenticated
    if (user) {
      debugLog('[App] Initializing settings service');
      settingsService.initialize().catch(error => {
        console.error('[App] Error initializing settings service:', error);
      });
    }
    
    // Clean up settings service on unmount
    return () => {
      debugLog('[App] Cleaning up settings service');
      settingsService.cleanup();
    };
  }, [user]);

  // Show loading state while validating auth
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {isDevelopment && (
        <>
          <DevTools />
          <AtomsDebugger />
        </>
      )}
      <ActiveEditorCleanup />
      <Routes>
        <Route 
          path="/" 
          element={
            <AuthGuard>
              <Navigate 
                to="/patients" 
                replace 
              />
            </AuthGuard>
          } 
        />
        <Route 
          path="/login" 
          element={
            !user || !pb.authStore.isValid ? (
              <Login />
            ) : (
              <Navigate 
                to="/patients" 
                replace 
              />
            )
          } 
        />
        
        {/* Protected Routes */}
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/patients" element={<Patients />} />
          <Route path="/patient/:patientId" element={<PatientDashboard />} />
          <Route path="/encounter/:patientId" element={<Encounter />} />
          <Route path="/encounter/:patientId/:encounterId" element={<Encounter mode="view" />} />
          <Route path="/encounter/:patientId/:encounterId/edit" element={<Encounter mode="edit" />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </LocalizationProvider>
  );
};

// Add a component to use the debug hook
const AtomsDebugger = () => {
  useAtomsDebugValue();
  return null;
};

export default App;
