import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { Record } from 'pocketbase';

interface InventoryItem extends Record {
  drug_name: string;
  drug_category: string;
  dose: string;
}

const Formulary: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to inventory updates
  const { records: inventory, loading, error } = useRealtimeSubscription<InventoryItem>(
    'inventory',
    { sort: 'drug_name' }
  );

  // Filter inventory based on search criteria
  const filteredInventory = useMemo(() => {
    if (!searchQuery) return inventory;
    const query = searchQuery.toLowerCase();
    return inventory?.filter((item: InventoryItem) => {
      return item.drug_name.toLowerCase().includes(query) || 
             item.drug_category.toLowerCase().includes(query);
    });
  }, [inventory, searchQuery]);

  // Pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (error) {
    return <Typography color="error">Error loading formulary: {error.message}</Typography>;
  }

  return (
    <RoleBasedAccess requiredRole="provider">
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Formulary</Typography>
        
        {/* Search Bar */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by drug name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* Formulary Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Drug Name</TableCell>
                <TableCell>Dose</TableCell>
                <TableCell align="right">Drug Category</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">Loading...</TableCell>
                </TableRow>
              ) : filteredInventory?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">No medications found</TableCell>
                </TableRow>
              ) : (
                filteredInventory
                  ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item: InventoryItem) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.drug_name}</TableCell>
                      <TableCell>{item.dose}</TableCell>
                      <TableCell align="right">{item.drug_category}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            component="div"
            count={filteredInventory?.length || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Box>
    </RoleBasedAccess>
  );
}

export default Formulary; 