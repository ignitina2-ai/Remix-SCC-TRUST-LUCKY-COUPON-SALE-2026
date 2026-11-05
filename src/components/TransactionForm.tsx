import React, { useState, useEffect } from 'react';
import { 
  Save, 
  User, 
  MapPin, 
  BookOpen, 
  Ticket, 
  CreditCard, 
  Wallet, 
  Smartphone,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Calendar,
  QrCode,
  Copy,
  Check
} from 'lucide-react';
import { Transaction, PaymentMethod, COUPON_PRICE, COUPONS_PER_BOOK, CustomPaymentMethod } from '@/types';
import { cn } from '@/lib/utils';

import TransactionList from './TransactionList';

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  editingTransaction?: Transaction | null;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onCancelEdit?: () => void;
  transactions: Transaction[];
  onDelete: (ids: string[]) => void;
  onToggleTreasurer: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  customPaymentLabels?: Record<PaymentMethod, string>;
  paymentMethodsList?: CustomPaymentMethod[];
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  hideList?: boolean;
}

const AREAS = [
  'Kadavoor',
  'Church sale',
  'Mathilil',
  'Chirakkara',
  'Kureepuzha',
  'Neeravil',
  'Kottayathu Kadavu',
  'Thevally',
  'Penayazhikam',
  'Venkkekkara',
  '18 padi, Mathilil',
  'Kollam Area',
  'Areekkakuzhi',
  'Venkekkara',
  'Sakthikulangara',
  'Thillery'
];

/**
 * Automatically calculates count of books or items from range strings such as:
 * - "1-25" -> 25
 * - "1 - 25" -> 25
 * - "1 to 25" -> 25
 * - "101-105" -> 5 (105 - 101 + 1)
 * - "1, 2, 3" -> 3
 * - "1-5, 8, 10-12" -> 9
 * - "1-25=25" -> 25
 */
export const calculateCountFromRangeString = (input: string): number | null => {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Explicit equals format: e.g. "1-25=25" or "= 25"
  const equalsMatch = trimmed.match(/=\s*(\d+)/);
  if (equalsMatch) {
    const val = parseInt(equalsMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Comma, semicolon, or "and" separated segments
  const parts = trimmed.split(/[,;&]|\band\b/i);
  let total = 0;
  let hasRangeOrList = false;

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    // Check for range: "1-25", "1 - 25", "1 to 25", "1–25", "1—25"
    const rangeMatch = part.match(/^(\d+)\s*(?:[-–—]|to)\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        total += (end - start + 1);
        hasRangeOrList = true;
        continue;
      }
    }

    // Check for single standalone number
    const singleMatch = part.match(/\b(\d+)\b/);
    if (singleMatch) {
      total += 1;
      if (parts.length > 1) {
        hasRangeOrList = true;
      }
      continue;
    }
  }

  if (hasRangeOrList && total > 0) {
    return total;
  }

  // If a single plain number was entered (e.g. "25" without dash)
  if (total === 1 && !trimmed.includes('-')) {
    return 1;
  }

  return null;
};

const InputField = ({ label, icon: Icon, bgClass = "bg-slate-50", labelClass = "text-slate-600", ...props }: any) => (
  <div className="space-y-1 md:space-y-1.5 w-full">
    <label className={cn("text-[10px] md:text-xs font-bold ml-1 uppercase tracking-wider", labelClass)}>{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon size={14} className="md:w-4 md:h-4" />
      </div>
      <input 
        {...props}
        className={cn(
          "w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-900 font-semibold text-xs md:text-sm",
          bgClass
        )}
      />
    </div>
  </div>
);

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onAddTransaction, 
  editingTransaction, 
  onUpdateTransaction, 
  onCancelEdit,
  transactions,
  onDelete,
  onToggleTreasurer,
  onEdit,
  customPaymentLabels,
  paymentMethodsList,
  permissions,
  hideList = false
}) => {
  const getIconForMethod = (id: string) => {
    if (id === 'CASH') return Wallet;
    if (id === 'CREDIT') return CreditCard;
    return Smartphone;
  };

  const getColorClassesForMethod = (id: string) => {
    switch(id) {
      case 'CASH': 
        return { 
          color: 'text-green-950', 
          bg: 'bg-green-600/50', 
          border: 'border-green-600', 
          text: 'text-green-950 font-black', 
          ring: 'ring-green-400/50' 
        };
      case 'CREDIT': 
        return { 
          color: 'text-red-950', 
          bg: 'bg-red-600/50', 
          border: 'border-red-600', 
          text: 'text-red-950 font-black', 
          ring: 'ring-red-400/50' 
        };
      case 'TRUST GPAY': 
        return { 
          color: 'text-blue-950', 
          bg: 'bg-blue-600/50', 
          border: 'border-blue-600', 
          text: 'text-blue-950 font-black', 
          ring: 'ring-blue-400/50' 
        };
      case 'SOFIA GPAY': 
        return { 
          color: 'text-orange-950', 
          bg: 'bg-orange-500/50', 
          border: 'border-orange-500', 
          text: 'text-orange-950 font-black', 
          ring: 'ring-orange-350/50' 
        };
      case 'JOHNY GPAY': 
        return { 
          color: 'text-violet-950', 
          bg: 'bg-violet-600/50', 
          border: 'border-violet-600', 
          text: 'text-violet-950 font-black', 
          ring: 'ring-violet-400/50' 
        };
      default: 
        return { 
          color: 'text-slate-950', 
          bg: 'bg-slate-500/50', 
          border: 'border-slate-600', 
          text: 'text-slate-950 font-black', 
          ring: 'ring-slate-400/50' 
        };
    }
  };

  // Generate today Ist string for form defaults
  const getTodayISTStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    area: '',
    books: 0,
    coupons: 0,
    bookNumber: '',
    couponNumber: '',
    paymentMethod: 'CASH' as PaymentMethod,
    paidAmount: 0,
    date: getTodayISTStr(),
  });

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        name: editingTransaction.name,
        phone: editingTransaction.phone || '',
        area: editingTransaction.area,
        books: editingTransaction.books,
        coupons: editingTransaction.coupons,
        bookNumber: editingTransaction.bookNumber || '',
        couponNumber: editingTransaction.couponNumber || '',
        paymentMethod: editingTransaction.paymentMethod,
        paidAmount: editingTransaction.paidAmount,
        date: editingTransaction.date ? editingTransaction.date.split('T')[0] : getTodayISTStr(),
      });
    }
  }, [editingTransaction]);

  const [totalAmount, setTotalAmount] = useState(0);
  const [creditAmount, setCreditAmount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<PaymentMethod | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShowQr(false);
    setCopied(false);
  }, [formData.paymentMethod]);

  const handleBookNumberChange = (value: string) => {
    const calculatedCount = calculateCountFromRangeString(value);
    setFormData(prev => ({
      ...prev,
      bookNumber: value,
      books: (calculatedCount !== null && calculatedCount > 0) ? calculatedCount : prev.books
    }));
  };

  const handleCouponNumberChange = (value: string) => {
    const calculatedCount = calculateCountFromRangeString(value);
    setFormData(prev => ({
      ...prev,
      couponNumber: value,
      coupons: (calculatedCount !== null && calculatedCount > 0) ? calculatedCount : prev.coupons
    }));
  };

  useEffect(() => {
    const total = (formData.books * COUPONS_PER_BOOK + formData.coupons) * COUPON_PRICE;
    setTotalAmount(total);
    
    if (formData.paymentMethod === 'CREDIT') {
      setCreditAmount(total - formData.paidAmount);
    } else {
      setCreditAmount(0);
      setFormData(prev => ({ ...prev, paidAmount: total }));
    }
  }, [formData.books, formData.coupons, formData.paymentMethod, formData.paidAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.area || (formData.books === 0 && formData.coupons === 0)) {
      return;
    }

    const safePaidAmount = Number(formData.paidAmount) || 0;
    const finalPaidAmount = formData.paymentMethod === 'CREDIT' ? safePaidAmount : totalAmount;
    const finalCreditAmount = formData.paymentMethod === 'CREDIT' ? totalAmount - safePaidAmount : 0;

    const now = new Date();
    const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
    const timeStr = `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
    const finalDateStr = new Date(formData.date + timeStr).toISOString();

    if (editingTransaction && onUpdateTransaction) {
      onUpdateTransaction(editingTransaction.id, {
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        books: Number(formData.books),
        coupons: Number(formData.coupons),
        bookNumber: formData.bookNumber,
        couponNumber: formData.couponNumber,
        totalAmount,
        paidAmount: finalPaidAmount,
        creditAmount: finalCreditAmount,
        paymentMethod: formData.paymentMethod,
        date: finalDateStr,
      });
    } else {
      onAddTransaction({
        date: finalDateStr,
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        books: Number(formData.books),
        coupons: Number(formData.coupons),
        bookNumber: formData.bookNumber,
        couponNumber: formData.couponNumber,
        totalAmount,
        paidAmount: finalPaidAmount,
        creditAmount: finalCreditAmount,
        paymentMethod: formData.paymentMethod,
        paidToTreasurer: false,
      });
    }

    setLastTransactionType(formData.paymentMethod);

    setFormData({
      name: '',
      phone: '',
      area: formData.area, // Keep area for next entry
      books: 0,
      coupons: 0,
      bookNumber: '',
      couponNumber: '',
      paymentMethod: 'CASH',
      paidAmount: 0,
      date: new Date().toISOString().split('T')[0],
    });
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  const getTodaySalesStats = () => {
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    const getLocalDatePart = (dateString: string) => {
      if (!dateString) return '';
      try {
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? dateString.split('T')[0] : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } catch (e) {
        return dateString.split('T')[0];
      }
    };

    const todayTransactions = (transactions || []).filter(t => {
      return getLocalDatePart(t.date) === todayIST;
    });

    const totalAmount = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCredit = todayTransactions.reduce((sum, t) => sum + t.creditAmount, 0);
    
    const methods = paymentMethodsList && paymentMethodsList.length > 0
      ? paymentMethodsList
      : [
          { id: 'CASH', label: 'Cash', isDisabled: false, isSystem: true },
          { id: 'CREDIT', label: 'Credit', isDisabled: false, isSystem: true },
          { id: 'TRUST GPAY', label: 'TRUST GPAY', isDisabled: false, isSystem: false },
          { id: 'SOFIA GPAY', label: 'SOFIA GPAY', isDisabled: false, isSystem: false },
          { id: 'JOHNY GPAY', label: 'JOHNY GPAY', isDisabled: false, isSystem: false },
          { id: 'OTHER_UPI', label: 'Other UPI', isDisabled: false, isSystem: false },
        ];
    const nonCashCreditMethods = methods.filter(m => m.id !== 'CASH' && m.id !== 'CREDIT');
    const nonCashCreditMethodsIds = nonCashCreditMethods.map(m => m.id);

    const totalUPI = todayTransactions.reduce((sum, t) => {
      let upiAmountForTx = 0;

      const totalHistoryAmount = (t.paymentHistory || []).reduce((histSum, h) => histSum + h.amount, 0);
      const unaccountedPaid = Math.max(0, t.paidAmount - totalHistoryAmount);

      // 1. History entries from today that are UPI
      const relevantHistory = (t.paymentHistory || []).filter(entry => {
        const matchesMethod = nonCashCreditMethodsIds.includes(entry.paymentMethod || '');
        if (!matchesMethod) return false;
        return getLocalDatePart(entry.date) === todayIST;
      });
      const historySum = relevantHistory.reduce((histSum, h) => histSum + h.amount, 0);

      // 2. Initial payment if tx occurred today and is UPI
      let initialPaidAllocated = 0;
      if (unaccountedPaid > 0) {
        const isTxFromToday = getLocalDatePart(t.date) === todayIST;
        if (isTxFromToday) {
          const isUpiMethod = nonCashCreditMethodsIds.includes(t.paymentMethod);
          if (isUpiMethod) {
            initialPaidAllocated = unaccountedPaid;
          }
        }
      }

      upiAmountForTx = historySum + initialPaidAllocated;
      return sum + upiAmountForTx;
    }, 0);

    const totalCash = (transactions || []).reduce((acc, t) => {
      const relevantHistory = (t.paymentHistory || []).filter(entry => {
        return entry.paymentMethod === 'CASH' && getLocalDatePart(entry.date) === todayIST;
      });
      const historySum = relevantHistory.reduce((sum, entry) => sum + entry.amount, 0);

      const totalHistoryAmount = (t.paymentHistory || []).reduce((sum, entry) => sum + entry.amount, 0);
      const unaccountedPaid = Math.max(0, t.paidAmount - totalHistoryAmount);

      let initialPaidAllocated = 0;
      if (unaccountedPaid > 0) {
        const isTxFromToday = getLocalDatePart(t.date) === todayIST;
        if (isTxFromToday) {
          if (t.paymentMethod === 'CASH' || t.paymentMethod === 'CREDIT') {
            initialPaidAllocated = unaccountedPaid;
          }
        }
      }

      return acc + historySum + initialPaidAllocated;
    }, 0);

    return {
      totalAmount,
      totalCredit,
      totalUPI,
      totalCash,
      count: todayTransactions.length
    };
  };

  const todayStats = getTodaySalesStats();

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{editingTransaction ? 'Edit Sale' : 'Add New Sale'}</h1>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">{editingTransaction ? 'Update details for this transaction' : 'Enter details for a new coupon transaction'}</p>
        </div>
        {editingTransaction && (
          <button 
            onClick={onCancelEdit}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg md:rounded-xl font-bold text-xs md:text-sm hover:bg-slate-200 transition-all cursor-pointer"
          >
            Cancel Edit
          </button>
        )}
      </header>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-xl flex items-center justify-between gap-3 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span className="font-bold text-xs md:text-sm">Transaction saved successfully!</span>
          </div>
          {lastTransactionType === 'CREDIT' && (
            <button 
              onClick={() => (window as any).setActiveTab?.('credit')}
              className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded-lg hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer"
            >
              View Credit
            </button>
          )}
        </div>
      )}

      {permissions && !permissions.canAdd && !editingTransaction && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Adding entries has been disabled by the Primary Admin.</span>
        </div>
      )}

      {permissions && !permissions.canEdit && editingTransaction && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Editing entries has been disabled by the Primary Admin.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-300 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Row 1: Customer Name & Sale Date */}
          <InputField 
            label="Customer Name" 
            icon={User} 
            placeholder="John Doe" 
            value={formData.name}
            onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <InputField 
            label="Sale Date" 
            icon={Calendar} 
            type="date" 
            value={formData.date}
            onChange={(e: any) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          {/* Row 2: Mobile Number & Area / Location */}
          <InputField 
            label="Mobile Number (Optional)" 
            icon={Phone} 
            placeholder="e.g. 9876543210" 
            value={formData.phone}
            onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
          />

          <div className="space-y-1 md:space-y-1.5 w-full">
            <label className="text-[10px] md:text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">Area / Location</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPin size={14} className="md:w-4 md:h-4" />
              </div>
              <input 
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-900 font-semibold text-xs md:text-sm"
                required
                list="areas-list"
                placeholder="Select or type area"
              />
              <datalist id="areas-list">
                {AREAS.map(area => (
                  <option key={area} value={area} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 3: Books (25 coupons each) and Book Number (Optional) column styled as single line, light blue bg 50% opacity style */}
          <div className="col-span-1 md:col-span-2 bg-blue-100/90 border-2 border-blue-300 p-3.5 rounded-2xl grid grid-cols-2 gap-3 shadow-sm shadow-blue-50">
            <div>
              <InputField 
                label="Books (25 coupons each)" 
                icon={BookOpen} 
                type="number" 
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={formData.books}
                onChange={(e: any) => setFormData({ ...formData, books: parseInt(e.target.value) || 0 })}
                bgClass="bg-white border-blue-400 text-blue-950 focus:ring-blue-600 focus:border-blue-600 font-bold"
                labelClass="text-blue-950 font-black"
              />
            </div>
            <div>
              <InputField 
                label="Book Number (Optional)" 
                icon={BookOpen} 
                placeholder="e.g. 1-25" 
                value={formData.bookNumber}
                onChange={(e: any) => handleBookNumberChange(e.target.value)}
                bgClass="bg-white border-blue-400 text-blue-950 placeholder:text-blue-400 focus:ring-blue-600 focus:border-blue-600 font-bold"
                labelClass="text-blue-950 font-black"
              />
              {formData.bookNumber && calculateCountFromRangeString(formData.bookNumber) !== null && (
                <p className="text-[10px] font-black text-blue-900 mt-1 flex items-center gap-1 leading-tight">
                  <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                  <span>Auto-counted: {calculateCountFromRangeString(formData.bookNumber)} Books ({calculateCountFromRangeString(formData.bookNumber)! * COUPONS_PER_BOOK} Coupons)</span>
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Individual Coupons and Coupon Number (Optional) */}
          <InputField 
            label="Individual Coupons" 
            icon={Ticket} 
            type="number" 
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            value={formData.coupons}
            onChange={(e: any) => setFormData({ ...formData, coupons: parseInt(e.target.value) || 0 })}
          />

          <div>
            <InputField 
              label="Coupon Number (Optional)" 
              icon={Ticket} 
              placeholder="e.g. 1-10=10 coupons" 
              value={formData.couponNumber}
              onChange={(e: any) => handleCouponNumberChange(e.target.value)}
            />
            {formData.couponNumber && calculateCountFromRangeString(formData.couponNumber) !== null && (
              <p className="text-[10px] font-bold text-slate-600 mt-1 flex items-center gap-1 leading-tight">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <span>Auto-counted: {calculateCountFromRangeString(formData.couponNumber)} Coupons</span>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 md:space-y-3">
          <label className="text-[10px] md:text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">Payment Method</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
            {(paymentMethodsList && paymentMethodsList.length > 0
              ? paymentMethodsList.filter(m => !m.isDisabled || m.id === formData.paymentMethod || m.id === 'CASH')
              : [
                  { id: 'CASH', label: 'Cash', isDisabled: false, isSystem: true },
                  { id: 'CREDIT', label: 'Credit', isDisabled: false, isSystem: true },
                  { id: 'TRUST GPAY', label: 'TRUST GPAY', isDisabled: false, isSystem: false },
                  { id: 'SOFIA GPAY', label: 'SOFIA GPAY', isDisabled: false, isSystem: false },
                  { id: 'JOHNY GPAY', label: 'JOHNY GPAY', isDisabled: false, isSystem: false },
                  { id: 'OTHER_UPI', label: 'Other UPI', isDisabled: false, isSystem: false },
                ]
            ).map((method) => {
              const IconComp = getIconForMethod(method.id);
              const colorClasses = getColorClassesForMethod(method.id);
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setFormData({ 
                    ...formData, 
                    paymentMethod: method.id as PaymentMethod,
                    paidAmount: method.id === 'CREDIT' ? 0 : formData.paidAmount
                  })}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 md:p-3 rounded-lg md:rounded-xl border-2 transition-all gap-0.5 md:gap-1 cursor-pointer",
                    formData.paymentMethod === method.id 
                      ? cn(colorClasses.border, "ring-2", colorClasses.ring, colorClasses.bg) 
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  <IconComp className={cn(formData.paymentMethod === method.id ? colorClasses.color : "text-slate-400")} size={16} />
                  <span className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-tight", formData.paymentMethod === method.id ? colorClasses.text : "text-slate-500")}>
                    {method.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {formData.paymentMethod !== 'CASH' && formData.paymentMethod !== 'CREDIT' && (() => {
          const matchedMethod = (paymentMethodsList || []).find(m => m.id === formData.paymentMethod);
          const currentUpiId = matchedMethod?.upiId;
          const currentLabel = matchedMethod?.label || formData.paymentMethod;

          return (
            <div className="bg-slate-50 p-4 rounded-xl md:rounded-2xl border border-slate-100 flex flex-col gap-3 text-left animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                    <QrCode size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">QR Code Payment Option</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Generate instant scan-and-pay code</p>
                  </div>
                </div>
                {currentUpiId ? (
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer",
                      showQr 
                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300" 
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    )}
                  >
                    {showQr ? 'Hide QR' : 'Display QR'}
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md flex items-center gap-1">
                    <AlertCircle size={12} />
                    Not Set Up
                  </span>
                )}
              </div>

              {!currentUpiId ? (
                <p className="text-[10px] text-amber-700 font-semibold leading-relaxed bg-amber-50/50 p-2.5 rounded-xl border border-dashed border-amber-200">
                  ⚠️ No UPI ID has been configured for <strong>{currentLabel}</strong> in your settings. 
                  Go to <strong>Settings &gt; Payment Methods Manager</strong> to add a UPI ID or mobile number to enable scan-and-pay.
                </p>
              ) : showQr ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Scan With Any UPI App
                  </div>
                  
                  {/* QR Code Container */}
                  <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-inner flex items-center justify-center">
                    {totalAmount > 0 ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          `upi://pay?pa=${currentUpiId}&pn=${encodeURIComponent(currentLabel)}&am=${totalAmount}&cu=INR`
                        )}`}
                        alt="UPI Payment QR Code"
                        className="w-44 h-44 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-400 gap-1">
                        <AlertCircle size={24} />
                        <span className="text-[10px] font-bold">Add books/coupons first</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 w-full max-w-xs">
                    <div className="text-sm font-black text-slate-800">
                      ₹{totalAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-100 rounded-lg py-1 px-3.5 w-fit mx-auto">
                      <span className="font-mono text-[10px] text-slate-600 font-semibold">{currentUpiId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentUpiId);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded transition-all cursor-pointer"
                        title="Copy UPI ID"
                      >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-wider animate-bounce">
                        Copied to Clipboard!
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {formData.paymentMethod === 'CREDIT' && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            <InputField 
              label="Paid Amount (Partial Payment)" 
              icon={IndianRupee} 
              type="number" 
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              max={totalAmount}
              value={formData.paidAmount === 0 ? '' : formData.paidAmount} // Allow empty when it's 0 to easily type
              onChange={(e: any) => setFormData({ ...formData, paidAmount: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
            />
            <p className="text-[9px] md:text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1 uppercase tracking-wider">
              <AlertCircle size={10} />
              Remaining Credit: ₹{creditAmount.toLocaleString('en-IN')}
            </p>
          </div>
        )}

        <div className="bg-slate-50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Total Amount</p>
            <p className="text-lg md:text-2xl font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</p>
          </div>
          <button 
            type="submit"
            disabled={editingTransaction ? (permissions?.canEdit === false) : (permissions?.canAdd === false)}
            className={cn(
              "text-white px-4 py-2.5 md:px-6 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 text-xs md:text-sm cursor-pointer",
              (editingTransaction ? (permissions?.canEdit === false) : (permissions?.canAdd === false))
                ? "bg-slate-300 border border-slate-400 cursor-not-allowed opacity-50 shadow-none text-slate-500"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            )}
          >
            <Save size={16} />
            {editingTransaction ? 'Update Sale' : 'Save'}
          </button>
        </div>

        {/* Google Drive & Sheet auto-sync notice */}
        <div className="flex items-center justify-end px-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50/70 border border-emerald-100/70 px-2.5 py-1 rounded-lg font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Auto syncs to Google Sheet
          </span>
        </div>
      </form>

      {!hideList && (
        <div className="mt-12 pt-12 border-t border-slate-200">
          <TransactionList 
            transactions={transactions} 
            onDelete={onDelete}
            onToggleTreasurer={onToggleTreasurer}
            onEdit={onEdit}
            customPaymentLabels={customPaymentLabels}
            permissions={permissions}
          />
        </div>
      )}
    </div>
  );
};

const IndianRupee = ({ size }: { size: number }) => (
  <span style={{ fontSize: size, fontWeight: 'bold' }}>₹</span>
);

export default TransactionForm;
