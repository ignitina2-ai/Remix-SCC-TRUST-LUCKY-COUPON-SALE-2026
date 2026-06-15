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
  AlertCircle
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
  onDelete: (id: string) => void;
  onToggleTreasurer: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  customPaymentLabels?: Record<PaymentMethod, string>;
  paymentMethodsList?: CustomPaymentMethod[];
}

const AREAS = [
  'Kadavoor',
  'Mathilil',
  'Kureepuzha',
  'Kottayathu Kadavu',
  'Thevally',
  'Penayam',
  'Areekkakuzhi',
  'Venkekkara',
  'Sakthikulangara',
  'Thillery'
];

const InputField = ({ label, icon: Icon, ...props }: any) => (
  <div className="space-y-1 md:space-y-1.5">
    <label className="text-[10px] md:text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon size={14} className="md:w-4 md:h-4" />
      </div>
      <input 
        {...props}
        className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-900 font-medium text-xs md:text-sm"
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
  paymentMethodsList
}) => {
  const getIconForMethod = (id: string) => {
    if (id === 'CASH') return Wallet;
    if (id === 'CREDIT') return CreditCard;
    return Smartphone;
  };

  const getColorClassesForMethod = (id: string) => {
    switch(id) {
      case 'CASH': return { color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'CREDIT': return { color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'GOOGLE_PAY': return { color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'PHONE_PAY': return { color: 'text-indigo-600', bg: 'bg-indigo-50' };
      case 'PAYTM': return { color: 'text-sky-600', bg: 'bg-sky-50' };
      default: return { color: 'text-violet-600', bg: 'bg-violet-50' };
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    area: '',
    books: 0,
    coupons: 0,
    bookNumber: '',
    paymentMethod: 'CASH' as PaymentMethod,
    paidAmount: 0,
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
        paymentMethod: editingTransaction.paymentMethod,
        paidAmount: editingTransaction.paidAmount,
      });
    }
  }, [editingTransaction]);

  const [totalAmount, setTotalAmount] = useState(0);
  const [creditAmount, setCreditAmount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<PaymentMethod | null>(null);

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

    if (editingTransaction && onUpdateTransaction) {
      onUpdateTransaction(editingTransaction.id, {
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        books: Number(formData.books),
        coupons: Number(formData.coupons),
        bookNumber: formData.bookNumber,
        totalAmount,
        paidAmount: finalPaidAmount,
        creditAmount: finalCreditAmount,
        paymentMethod: formData.paymentMethod,
      });
    } else {
      onAddTransaction({
        date: new Date().toISOString(),
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        books: Number(formData.books),
        coupons: Number(formData.coupons),
        bookNumber: formData.bookNumber,
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
      paymentMethod: 'CASH',
      paidAmount: 0,
    });
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

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

      <form onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <InputField 
            label="Customer Name" 
            icon={User} 
            placeholder="John Doe" 
            value={formData.name}
            onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <div className="space-y-1 md:space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">Area / Location</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPin size={14} className="md:w-4 md:h-4" />
              </div>
              <input 
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-900 font-medium text-xs md:text-sm"
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
          <InputField 
            label="Books (25 coupons each)" 
            icon={BookOpen} 
            type="number" 
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            value={formData.books}
            onChange={(e: any) => setFormData({ ...formData, books: parseInt(e.target.value) || 0 })}
          />
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
          <InputField 
            label="Book Number (Optional)" 
            icon={BookOpen} 
            placeholder="e.g. 101-105" 
            value={formData.bookNumber}
            onChange={(e: any) => setFormData({ ...formData, bookNumber: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:space-y-3">
          <label className="text-[10px] md:text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">Payment Method</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
            {(paymentMethodsList && paymentMethodsList.length > 0
              ? paymentMethodsList.filter(m => !m.isDisabled || m.id === formData.paymentMethod || m.id === 'CASH')
              : [
                  { id: 'CASH', label: 'Cash', isDisabled: false, isSystem: true },
                  { id: 'CREDIT', label: 'Credit', isDisabled: false, isSystem: true },
                  { id: 'GOOGLE_PAY', label: 'Google Pay', isDisabled: false, isSystem: false },
                  { id: 'PHONE_PAY', label: 'PhonePe', isDisabled: false, isSystem: false },
                  { id: 'PAYTM', label: 'Paytm', isDisabled: false, isSystem: false },
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
                      ? cn("border-blue-600 ring-2 ring-blue-50", colorClasses.bg) 
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  <IconComp className={cn(formData.paymentMethod === method.id ? colorClasses.color : "text-slate-400")} size={16} />
                  <span className={cn("text-[9px] md:text-[10px] font-bold uppercase tracking-tight", formData.paymentMethod === method.id ? "text-slate-900" : "text-slate-500")}>
                    {method.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 md:px-6 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95 text-xs md:text-sm cursor-pointer"
          >
            <Save size={16} />
            {editingTransaction ? 'Update Sale' : 'Save'}
          </button>
        </div>
      </form>

      <div className="mt-12 pt-12 border-t border-slate-200">
        <TransactionList 
          transactions={transactions} 
          onDelete={onDelete}
          onToggleTreasurer={onToggleTreasurer}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
};

const IndianRupee = ({ size }: { size: number }) => (
  <span style={{ fontSize: size, fontWeight: 'bold' }}>₹</span>
);

export default TransactionForm;
