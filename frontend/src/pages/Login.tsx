import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Container } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { authModelAtom, AuthModel, pb } from '../atoms/auth';
import { AuthResponse } from 'pocketbase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthModel = useSetAtom(authModelAtom);

  // Get the redirect URL from query parameters
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get('redirect') || '/patients';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      const authData = await pb.collection('users').authWithPassword(email, password) as AuthResponse;
      console.log('Login successful:', authData);
      setAuthModel(authData.record as unknown as AuthModel);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
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
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
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
