import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai/react';
import { authModelAtom, AuthModel, pb, authErrorAtom, isLoadingAtom } from '../atoms/auth';
import { AuthResponse } from 'pocketbase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthModel = useSetAtom(authModelAtom);
  const globalAuthError = useAtomValue(authErrorAtom);
  const setAuthError = useSetAtom(authErrorAtom);
  const setLoading = useSetAtom(isLoadingAtom);

  // Get the redirect URL from location state or query parameters
  const from = location.state?.from?.pathname || '/patients';
  const authError = location.state?.authError;
  const loggedOut = location.state?.loggedOut;

  // Set error message from location state if present and ensure loading state is cleared
  useEffect(() => {
    // Ensure we're not in a loading state when on the login page
    setLoading(false);
    
    if (authError) {
      console.log('[Login] Setting error from location state:', authError);
      setError(authError);
      // Clear the location state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
    
    if (loggedOut) {
      setSuccessMessage('You have been successfully logged out.');
      // Clear the location state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
    
    // Clear any global auth errors when the login page is shown
    setAuthError(null);
  }, [authError, loggedOut, setAuthError, setLoading]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      console.log('[Login] Attempting login with email:', email);
      
      // Use PocketBase's built-in auth method
      const authData = await pb.collection('users').authWithPassword(email, password) as AuthResponse;
      
      console.log('[Login] Login successful:', authData.record?.id);
      
      // Set the auth model in our global state
      setAuthModel(authData.record as unknown as AuthModel);
      
      // Navigate to the redirect URL
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('[Login] Login error:', err);
      setLoading(false);
      
      // Handle different error types
      if (err.status === 400) {
        setError('Invalid email or password');
      } else if (err.status === 429) {
        setError('Too many login attempts. Please try again later.');
      } else if (err.status === 0 || err.message?.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'Failed to login. Please try again.');
      }
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{
        background: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/background.webp'), url('/background.png')`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          MEDS Login
        </Typography>
        
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {globalAuthError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {globalAuthError}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
          >
            Login
          </Button>
        </form>
      </Paper>
      <Typography 
        variant="body1" 
        color="text.secondary" 
        align="center" 
        sx={{ 
          mt: 4,
          position: 'absolute',
          bottom: 16,
          width: '100%',
          fontSize: '1.1rem'
        }}
      >
        Created By: David Clark & Brandon Clark
      </Typography>
    </Box>
  );
};

export default Login;
