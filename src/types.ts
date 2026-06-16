export type PaymentMethod = string;

export interface CustomPaymentMethod {
  id: string;
  label: string;
  isDisabled: boolean;
  isSystem: boolean;
}

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  date: string;
  paymentMethod?: PaymentMethod;
}

export interface Transaction {
  id: string;
  date: string;
  name: string;
  phone?: string;
  email?: string;
  area: string;
  books: number;
  coupons: number;
  bookNumber?: string;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  paymentMethod: PaymentMethod;
  paidToTreasurer: boolean;
  treasurerPaidDate?: string;
  paymentHistory?: PaymentHistoryEntry[];
}

export interface Sponsor {
  id: string;
  name: string;
  area: string;
  prizeDescription: string;
  prizeNumber?: number;
  amount: number;
  collectedAmount: number;
  status: 'COLLECTED' | 'PENDING' | 'FLAGGED';
  collectedDate?: string;
  prizeImageUrl?: string;
  prizeImageName?: string;
}

export interface CreditSettings {
  reminderEmailTemplate: string;
  reminderSMSTemplate: string;
  overdueThresholds: number[];
}

export interface SecretaryHandover {
  id: string;
  date: string;
  name: string;
  description: string;
  amount: number;
}

export interface AppData {
  transactions: Transaction[];
  sponsors: Sponsor[];
  incomeExpenses: IncomeExpense[];
  secretaryHandovers: SecretaryHandover[];
  logo?: string;
  logoMobile?: string;
  logoDesktop?: string;
  notificationsEnabled?: boolean;
  creditSettings?: CreditSettings;
  customPaymentLabels?: Record<PaymentMethod, string>;
  paymentMethodsList?: CustomPaymentMethod[];
}

export const DEFAULT_PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CREDIT: 'Credit',
  'TRUST GPAY': 'TRUST GPAY',
  'SOFIA GPAY': 'SOFIA GPAY',
  'JOHNY GPAY': 'JOHNY GPAY',
  OTHER_UPI: 'Other UPI',
};

export const getDefaultPaymentMethodsList = (customPaymentLabels?: Record<string, string>): CustomPaymentMethod[] => {
  return [
    { id: 'CASH', label: customPaymentLabels?.CASH || 'Cash', isDisabled: false, isSystem: true },
    { id: 'CREDIT', label: customPaymentLabels?.CREDIT || 'Credit', isDisabled: false, isSystem: true },
    { id: 'TRUST GPAY', label: customPaymentLabels?.['TRUST GPAY'] || 'TRUST GPAY', isDisabled: false, isSystem: false },
    { id: 'SOFIA GPAY', label: customPaymentLabels?.['SOFIA GPAY'] || 'SOFIA GPAY', isDisabled: false, isSystem: false },
    { id: 'JOHNY GPAY', label: customPaymentLabels?.['JOHNY GPAY'] || 'JOHNY GPAY', isDisabled: false, isSystem: false },
    { id: 'OTHER_UPI', label: customPaymentLabels?.OTHER_UPI || 'Other UPI', isDisabled: false, isSystem: false }
  ];
};

export type EntryType = 'INCOME' | 'EXPENSE';

export interface IncomeExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: EntryType;
  category?: string;
  receiptUrl?: string;
  receiptName?: string;
}

export const COUPON_PRICE = 100;
export const COUPONS_PER_BOOK = 25;
