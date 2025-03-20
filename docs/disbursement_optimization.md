# Disbursement Management Optimization

## Current Implementation Analysis

The current disbursement management system handles medication disbursements with complex calculations for stock tracking. After reviewing the code, I've identified several areas where the calculation logic could be optimized for better performance, reliability, and maintainability.

### Key Components

1. **DisbursementForm Component**
   - Handles UI for adding/editing disbursements
   - Calculates stock changes for validation
   - Manages local state for disbursements

2. **Encounter Component**
   - Saves disbursement changes to the database
   - Updates inventory stock
   - Manages the overall encounter workflow

### Current Calculation Logic

The current implementation uses several functions for calculations:

1. `getNumericMultiplier`: Converts multiplier values (string or number) to numbers
2. `calculateTotalQuantity`: Multiplies quantity by multiplier
3. `calculateStockChange`: Determines how stock will change based on:
   - Current stock
   - Fixed quantity
   - Multiplier
   - Other disbursements of the same medication
   - Original values (for existing disbursements)

## Optimization Opportunities

### 1. Consolidate Calculation Logic

**Current Issue:**
- Calculations are performed in multiple places
- Different logic is used for UI validation vs. saving
- Redundant calculations are performed

**Recommendation:**
Create a single source of truth for disbursement calculations with a dedicated utility:

```typescript
// disbursementUtils.ts
export const calculateDisbursementQuantity = (
  fixedQuantity: number, 
  multiplier: string | number
): number => {
  const numericMultiplier = typeof multiplier === 'string' 
    ? (multiplier === '' ? 0 : parseFloat(multiplier) || 0)
    : multiplier || 0;
  
  return fixedQuantity * numericMultiplier;
};

export const calculateStockImpact = (
  disbursements: DisbursementItem[],
  currentStock: number,
  originalDisbursements: Map<string, DisbursementItem> = new Map()
): { 
  totalQuantity: number, 
  stockChange: number, 
  exceedsStock: boolean 
} => {
  // Calculate total quantity across all disbursements
  const totalQuantity = disbursements.reduce((total, d) => {
    if (d.markedForDeletion) return total;
    return total + calculateDisbursementQuantity(
      d.medicationDetails?.fixed_quantity || 0,
      d.multiplier
    );
  }, 0);
  
  // Calculate original quantity for comparison
  const originalQuantity = disbursements.reduce((total, d) => {
    if (!d.id || d.markedForDeletion) return total;
    const original = originalDisbursements.get(d.id);
    if (!original) return total;
    
    return total + calculateDisbursementQuantity(
      original.medicationDetails?.fixed_quantity || 0,
      original.multiplier
    );
  }, 0);
  
  // Calculate net stock change
  const stockChange = totalQuantity - originalQuantity;
  
  return {
    totalQuantity,
    stockChange,
    exceedsStock: (currentStock - stockChange) < 0
  };
};
```

### 2. Optimize Data Fetching

**Current Issue:**
- Fetches medication data multiple times
- Makes separate API calls for each disbursement
- Doesn't efficiently cache medication data

**Recommendation:**
Implement batch fetching and caching:

```typescript
// In Encounter component
const fetchMedicationsForDisbursements = async (disbursements: DisbursementItem[]) => {
  // Get unique medication IDs
  const medicationIds = [...new Set(
    disbursements
      .filter(d => d.medication && !d.markedForDeletion)
      .map(d => d.medication)
  )];
  
  // Batch fetch all medications in one request
  const medications = await pb.collection('inventory').getList(1, 100, {
    filter: `id ?~ "${medicationIds.join('","')}"`,
  });
  
  // Create a map for quick lookup
  const medicationMap = new Map(
    medications.items.map(med => [med.id, med])
  );
  
  return medicationMap;
};
```

### 3. Simplify State Management

**Current Issue:**
- Tracks both original and current values
- Uses different calculation logic for different modes
- Maintains multiple copies of the same data

**Recommendation:**
Use a more immutable approach with a reducer pattern:

```typescript
// Define action types
type DisbursementAction = 
  | { type: 'ADD_DISBURSEMENT', medication: MedicationRecord }
  | { type: 'REMOVE_DISBURSEMENT', index: number }
  | { type: 'UPDATE_DISBURSEMENT', index: number, field: string, value: any }
  | { type: 'MARK_FOR_DELETION', index: number }
  | { type: 'RESTORE_DISBURSEMENT', index: number }
  | { type: 'RESET', disbursements: DisbursementItem[] };

// Create reducer
const disbursementReducer = (state: DisbursementItem[], action: DisbursementAction): DisbursementItem[] => {
  switch (action.type) {
    case 'ADD_DISBURSEMENT':
      return [...state, {
        medication: action.medication.id,
        medicationDetails: action.medication,
        quantity: action.medication.fixed_quantity || 1,
        multiplier: '1',
        notes: '',
        markedForDeletion: false
      }];
      
    case 'REMOVE_DISBURSEMENT':
      return state.map((item, index) => 
        index === action.index 
          ? { ...item, markedForDeletion: true }
          : item
      );
      
    // Other cases...
      
    default:
      return state;
  }
};
```

### 4. Standardize Multiplier Handling

**Current Issue:**
- Converts between string and number formats
- Has multiple parsing points that could lead to inconsistencies

**Recommendation:**
Standardize multiplier handling with clear type conversions:

```typescript
// Always store multiplier as string in state for input handling
// Convert to number only when performing calculations
export const parseMultiplier = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

// Validate multiplier input
export const isValidMultiplier = (value: string | number | null | undefined): boolean => {
  const parsed = parseMultiplier(value);
  return parsed > 0;
};
```

### 5. Implement Batch Database Operations

**Current Issue:**
- Performs multiple database operations sequentially
- Doesn't handle transaction failures well

**Recommendation:**
Use batch operations where possible and implement better transaction handling:

```typescript
const saveDisbursementChanges = async () => {
  try {
    // Start a logical transaction
    const operations = [];
    
    // Process deletions
    for (const d of disbursementsToDelete) {
      operations.push(async () => {
        // Update stock
        await pb.collection('inventory').update(d.medication, {
          stock: d.medicationDetails.stock + calculateDisbursementQuantity(
            d.medicationDetails.fixed_quantity,
            d.multiplier
          )
        });
        
        // Delete disbursement
        await pb.collection('disbursements').delete(d.id);
      });
    }
    
    // Process updates and creations
    // ...
    
    // Execute all operations
    for (const operation of operations) {
      await operation();
    }
    
    return true;
  } catch (error) {
    console.error('Transaction failed:', error);
    // Implement rollback logic if possible
    return false;
  }
};
```

## Implementation Plan

1. **Phase 1: Create Utility Functions**
   - Implement `disbursementUtils.ts` with standardized calculation functions
   - Update existing code to use these utilities
   - Add comprehensive unit tests

2. **Phase 2: Optimize Data Fetching**
   - Implement batch fetching for medications
   - Add caching layer for frequently accessed data
   - Reduce unnecessary API calls

3. **Phase 3: Refactor State Management**
   - Implement reducer pattern for disbursement state
   - Simplify the component logic
   - Improve error handling

4. **Phase 4: Enhance Transaction Handling**
   - Implement batch operations
   - Add better error recovery
   - Improve user feedback during operations

## Expected Benefits

- **Performance Improvement**: Reduced calculations and API calls
- **Reliability**: Consistent calculation logic and better error handling
- **Maintainability**: Clearer code organization and separation of concerns
- **User Experience**: Faster response times and more accurate stock tracking

## Conclusion

The current disbursement management system works but has several opportunities for optimization. By implementing these recommendations, we can significantly improve performance, reliability, and maintainability while maintaining all existing functionality. 