import { MedicationRecord, DisbursementItem } from '../components/DisbursementForm';

/**
 * Converts a multiplier value (string or number) to a numeric value
 * @param value The multiplier value to convert
 * @returns The numeric multiplier value
 */
export const parseMultiplier = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Validates if a multiplier value is valid (positive number)
 * @param value The multiplier value to validate
 * @returns True if the multiplier is valid
 */
export const isValidMultiplier = (value: string | number | null | undefined): boolean => {
  const parsed = parseMultiplier(value);
  return parsed > 0;
};

/**
 * Calculates the total quantity for a disbursement
 * @param fixedQuantity The fixed quantity of the medication
 * @param multiplier The multiplier value
 * @returns The total quantity
 */
export const calculateDisbursementQuantity = (
  fixedQuantity: number, 
  multiplier: string | number
): number => {
  const numericMultiplier = parseMultiplier(multiplier);
  return fixedQuantity * numericMultiplier;
};

/**
 * Calculates the impact on stock for a set of disbursements
 * @param disbursements The disbursements to calculate impact for
 * @param currentStock The current stock of the medication
 * @param originalDisbursements Map of original disbursements for comparison
 * @returns Object with totalQuantity, stockChange, and exceedsStock
 */
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

/**
 * Calculates the stock change for a single disbursement
 * @param disbursement The disbursement to calculate for
 * @param otherDisbursements Other disbursements of the same medication
 * @param originalDisbursement The original state of the disbursement (if existing)
 * @param isPharmacyMode Whether we're in pharmacy mode
 * @returns Object with stockChange, exceedsStock, and totalDisbursedAmount
 */
export const calculateSingleDisbursementStockChange = (
  disbursement: DisbursementItem,
  otherDisbursements: DisbursementItem[],
  originalDisbursement: DisbursementItem | null = null,
  isPharmacyMode: boolean = false
): { 
  stockChange: number, 
  exceedsStock: boolean, 
  totalDisbursedAmount: number 
} => {
  if (!disbursement.medicationDetails || !disbursement.medication || disbursement.markedForDeletion) {
    return { 
      stockChange: 0, 
      exceedsStock: false, 
      totalDisbursedAmount: 0 
    };
  }

  const currentStock = disbursement.medicationDetails.stock || 0;
  const fixedQuantity = disbursement.medicationDetails.fixed_quantity || 0;
  const currentAmount = calculateDisbursementQuantity(fixedQuantity, disbursement.multiplier);
  
  // Calculate total amount being disbursed for this medication by other disbursements
  const otherDisbursementsTotal = otherDisbursements.reduce((total, d) => {
    const qty = d.medicationDetails?.fixed_quantity || 0;
    const mult = parseMultiplier(d.multiplier);
    return total + (qty * mult);
  }, 0);

  // For pharmacy mode, we always show the absolute change from current stock
  if (isPharmacyMode) {
    const stockChange = currentAmount;
    const exceedsStock = (currentAmount + otherDisbursementsTotal) > currentStock;
    return { 
      stockChange, 
      exceedsStock, 
      totalDisbursedAmount: currentAmount + otherDisbursementsTotal 
    };
  }

  // For other modes (provider view), we show the change relative to initial state
  const initialAmount = originalDisbursement 
    ? calculateDisbursementQuantity(
        originalDisbursement.medicationDetails?.fixed_quantity || 0, 
        originalDisbursement.multiplier
      )
    : 0;

  // Calculate the relative stock change
  const stockChange = disbursement.id 
    ? currentAmount - initialAmount  // For existing: only count the difference
    : currentAmount;                 // For new: count the full amount

  // Check if total disbursements would exceed current stock
  const exceedsStock = (currentAmount + otherDisbursementsTotal) > currentStock;
  
  return { 
    stockChange, 
    exceedsStock, 
    totalDisbursedAmount: currentAmount + otherDisbursementsTotal 
  };
};

/**
 * Fetches medications for a set of disbursements in batch
 * @param pb PocketBase instance
 * @param disbursements The disbursements to fetch medications for
 * @returns Map of medication IDs to medication records
 */
export const fetchMedicationsForDisbursements = async (
  pb: any,
  disbursements: DisbursementItem[]
): Promise<Map<string, MedicationRecord>> => {
  // Get unique medication IDs
  const medicationIds = disbursements
    .filter(d => d.medication && !d.markedForDeletion)
    .map(d => d.medication)
    .filter((id, index, self) => self.indexOf(id) === index); // Unique values
  
  if (medicationIds.length === 0) {
    return new Map<string, MedicationRecord>();
  }
  
  // Batch fetch all medications in one request
  const medications = await pb.collection('inventory').getList(1, 100, {
    filter: medicationIds.length > 0 ? `id ?~ "${medicationIds.join('","')}"` : '',
  });
  
  // Create a map for quick lookup
  const medicationMap = new Map<string, MedicationRecord>();
  medications.items.forEach((med: MedicationRecord) => {
    medicationMap.set(med.id, med);
  });
  
  return medicationMap;
}; 