import React from 'react';
import { Box, AppBar, Toolbar, Typography, Button, useTheme, useMediaQuery, IconButton, Drawer, List, ListItem, Container } from '@mui/material';
import { useNavigate, Outlet } from 'react-router-dom';
import { pb } from '../atoms/auth';
import MenuIcon from '@mui/icons-material/Menu';
import { RoleBasedAccess } from './RoleBasedAccess';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = () => {
    pb.authStore.clear();
    navigate('/login');
  };

  const navItems = [
    { text: 'Dashboard', path: '/dashboard' },
    { text: 'Patients', path: '/patients' },
    { text: 'Inventory', path: '/inventory', role: 'pharmacy' as const },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ bgcolor: theme.palette.primary.main, height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.primary.light}` }}>
        <Typography variant="h6" component="div" color="primary.contrastText">
          MEDS
        </Typography>
      </Box>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            {item.role ? (
              <RoleBasedAccess requiredRole={item.role}>
                <Button
                  color="inherit"
                  onClick={() => {
                    navigate(item.path);
                    handleDrawerToggle();
                  }}
                  sx={{ 
                    width: '100%',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    py: 1.5,
                    px: 2,
                    color: theme.palette.primary.contrastText
                  }}
                >
                  {item.text}
                </Button>
              </RoleBasedAccess>
            ) : (
              <Button
                color="inherit"
                onClick={() => {
                  navigate(item.path);
                  handleDrawerToggle();
                }}
                sx={{ 
                  width: '100%',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  py: 1.5,
                  px: 2,
                  color: theme.palette.primary.contrastText
                }}
              >
                {item.text}
              </Button>
            )}
          </ListItem>
        ))}
        <ListItem disablePadding>
          <Button
            color="inherit"
            onClick={() => {
              handleLogout();
              handleDrawerToggle();
            }}
            sx={{ 
              width: '100%',
              justifyContent: 'flex-start',
              textAlign: 'left',
              py: 1.5,
              px: 2,
              color: theme.palette.primary.contrastText
            }}
          >
            Logout
          </Button>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography 
            variant="h6" 
            component="div" 
            onClick={() => navigate('/dashboard')} 
            sx={{ 
              cursor: 'pointer',
              flexGrow: isMobile ? 1 : 0
            }}
          >
            MEDS
          </Typography>

          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            ...(isMobile ? { justifyContent: 'flex-end' } : {})
          }}>
            {!isMobile && navItems.map((item) => (
              item.role ? (
                <RoleBasedAccess key={item.path} requiredRole={item.role}>
                  <Button
                    color="inherit"
                    onClick={() => navigate(item.path)}
                    sx={{ mx: 1 }}
                  >
                    {item.text}
                  </Button>
                </RoleBasedAccess>
              ) : (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{ mx: 1 }}
                >
                  {item.text}
                </Button>
              )
            ))}
            {!isMobile && (
              <Button color="inherit" onClick={handleLogout}>
                Logout
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 240,
          },
        }}
      >
        {drawer}
      </Drawer>

      <Container 
        maxWidth={false} 
        sx={{ 
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <Box sx={{ 
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto'
        }}>
          <Outlet />
        </Box>
      </Container>
    </Box>
  );
};

export default Layout;
