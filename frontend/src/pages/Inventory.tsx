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
import { pb } from '../atoms/auth';
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
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Inventory</Typography>
      
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

      {/* Inventory Table */}
      <TableContainer component={Paper}>
        <Table>
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
                <TableCell colSpan={4} align="center">Loading...</TableCell>
              </TableRow>
            ) : filteredInventory?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">No inventory items found</TableCell>
              </TableRow>
            ) : (
              filteredInventory
                ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item: InventoryItem) => (
                  <TableRow 
                    key={item.id}
                    sx={{ 
                      backgroundColor: item.stock <= item.fixed_quantity ? '#fff4e5' : 'inherit'
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
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredInventory?.length || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default Inventory;
