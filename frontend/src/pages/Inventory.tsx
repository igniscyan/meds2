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
  Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { RoleBasedAccess } from '../components/RoleBasedAccess';
import { Record } from 'pocketbase';

interface InventoryItem extends Record {
  drug_name: string;
  drug_category: string;  // Note: This is the actual field name from the schema, despite the typo
  stock: number;
  fixed_quantity: number;
  dose: string;
}

const Inventory: React.FC = () => {
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
    return <Typography color="error">Error loading inventory: {error.message}</Typography>;
  }

  return (
    <RoleBasedAccess requiredRole={['provider', 'pharmacy'] as const}>
      <Box sx={{ p: { xs: 2, sm: 2 } }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Inventory</Typography>

        {/* Search Bar */}
        <Paper sx={{ p: 1.5, mb: 2 }}>
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

        {/* Inventory Table */}
        <TableContainer component={Paper} sx={{ height: 'calc(100vh - 220px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Drug Name</TableCell>
                <TableCell>Dose</TableCell>
                <TableCell align="right">Drug Category</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Fixed Quantity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">Loading...</TableCell>
                </TableRow>
              ) : filteredInventory?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No inventory items found</TableCell>
                </TableRow>
              ) : (
                filteredInventory
                  ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item: InventoryItem) => (
                    <TableRow 
                      key={item.id}
                      sx={{ 
                        backgroundColor: item.stock <= item.fixed_quantity ? '#fff4e5' : 'inherit',
                        '&:hover': {
                          backgroundColor: item.stock <= item.fixed_quantity ? '#ffecb5' : '#f5f5f5'
                        }
                      }}
                    >
                      <TableCell>{item.drug_name}</TableCell>
                      <TableCell>{item.dose}</TableCell>
                      <TableCell align="right">{item.drug_category}</TableCell>
                      <TableCell align="right">{item.stock}</TableCell>
                      <TableCell align="right">{item.fixed_quantity}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredInventory?.length || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </TableContainer>
      </Box>
    </RoleBasedAccess>
  );
};

export default Inventory;
