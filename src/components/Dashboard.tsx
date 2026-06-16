import React, { useState } from 'react';
import { 
  IndianRupee, 
  CreditCard, 
  Wallet, 
  ArrowUpRight, 
  TrendingUp,
  TrendingDown,
  Smartphone,
  QrCode,
  PlusCircle,
  History,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Transaction, Sponsor, IncomeExpense, SecretaryHandover, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod, getDefaultPaymentMethodsList } from '@/types';
import { cn } from '@/lib/utils';
import TransactionList from './TransactionList';

interface DashboardProps {
  transactions: Transaction[];
  sponsors: Sponsor[];
  incomeExpenses: IncomeExpense[];
  secretaryHandovers: SecretaryHandover[];
  customPaymentLabels?: Record<PaymentMethod, string>;
  paymentMethodsList?: CustomPaymentMethod[];
  onDeleteTransaction: (ids: string[]) => void;
  onToggleTreasurer: (id: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions = [], 
  sponsors = [], 
  incomeExpenses = [], 
  secretaryHandovers = [],
  customPaymentLabels = DEFAULT_PAYMENT_LABELS,
  paymentMethodsList,
  onDeleteTransaction,
  onToggleTreasurer,
  onEditTransaction
}) => {
  const [timeframe, setTimeframe] = useState<'overall' | 'today'>('overall');

  // Filter lists based on timeframe
  const filteredTransactionsList = timeframe === 'today' 
    ? transactions.filter(t => {
        const d = new Date(t.date);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      })
    : transactions;

  // Helper to calculate total received amount for a payment method across the filtered transactions
  const getAmountByMethod = (method: PaymentMethod, viewTimeframe: 'overall' | 'today') => {
    return (transactions || []).reduce((acc, t) => {
      // 1. Filter payment history entries based on timeframe
      const relevantHistory = (t.paymentHistory || []).filter(entry => {
        const matchesMethod = entry.paymentMethod === method;
        if (!matchesMethod) return false;
        
        if (viewTimeframe === 'today') {
          const d = new Date(entry.date);
          const today = new Date();
          return d.getDate() === today.getDate() &&
                 d.getMonth() === today.getMonth() &&
                 d.getFullYear() === today.getFullYear();
        }
        return true; // overall
      });
      
      const historySum = relevantHistory.reduce((sum, entry) => sum + entry.amount, 0);

      // 2. Account for initial paid amount (not in payment history)
      const totalHistoryAmount = (t.paymentHistory || []).reduce((sum, entry) => sum + entry.amount, 0);
      const unaccountedPaid = Math.max(0, t.paidAmount - totalHistoryAmount);

      let initialPaidAllocated = 0;
      if (unaccountedPaid > 0) {
        let timeframeMatches = true;
        if (viewTimeframe === 'today') {
          const d = new Date(t.date);
          const today = new Date();
          timeframeMatches = d.getDate() === today.getDate() &&
                             d.getMonth() === today.getMonth() &&
                             d.getFullYear() === today.getFullYear();
        }

        if (timeframeMatches) {
          if (t.paymentMethod === method) {
            initialPaidAllocated = unaccountedPaid;
          } else if (t.paymentMethod === 'CREDIT' && method === 'CASH') {
            // If the transaction's main method was CREDIT, attribute initial partial payment to CASH
            initialPaidAllocated = unaccountedPaid;
          }
        }
      }

      return acc + historySum + initialPaidAllocated;
    }, 0);
  };

  // Calculations
  const totalSales = (filteredTransactionsList || []).reduce((acc, t) => acc + t.totalAmount, 0);
  const totalCredit = (filteredTransactionsList || []).reduce((acc, t) => acc + t.creditAmount, 0);
  const totalCash = getAmountByMethod('CASH', timeframe);
  
  const methods = paymentMethodsList && paymentMethodsList.length > 0
    ? paymentMethodsList
    : getDefaultPaymentMethodsList(customPaymentLabels);

  const nonCashCreditMethods = methods.filter(m => m.id !== 'CASH' && m.id !== 'CREDIT');
  const totalUPI = nonCashCreditMethods.reduce((sum, m) => sum + getAmountByMethod(m.id, timeframe), 0);
  const totalCashSale = totalCash + totalUPI;
  const totalHandover = (secretaryHandovers || []).reduce((acc, h) => acc + h.amount, 0);

  // calculations for monthly chart
  const getMonthlyChartData = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get number of days in the current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Initialize array of days
    const chartData = Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      return {
        day,
        dateLabel: `${day} ${today.toLocaleString('en-IN', { month: 'short' })}`,
        'Total Sales': 0,
        'Amount Collected': 0,
      };
    });

    // Populate with transaction data
    (transactions || []).forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      // Verify same month and year
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const dayIndex = d.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < totalDays) {
          chartData[dayIndex]['Total Sales'] += t.totalAmount || 0;
          chartData[dayIndex]['Amount Collected'] += t.paidAmount || 0;
        }
      }
    });

    return chartData;
  };

  const monthlyChartData = getMonthlyChartData();
  const currentMonthTotalSales = monthlyChartData.reduce((sum, item) => sum + item['Total Sales'], 0);
  const currentMonthTotalCollected = monthlyChartData.reduce((sum, item) => sum + item['Amount Collected'], 0);
  const currentMonthCollectionRate = currentMonthTotalSales > 0 
    ? Math.round((currentMonthTotalCollected / currentMonthTotalSales) * 100) 
    : 0;

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs text-left">
          <p className="font-bold text-slate-300 mb-1">{label} Jun</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-mono flex justify-between gap-4" style={{ color: entry.stroke || entry.color }}>
              <span className="uppercase font-bold tracking-wider">{entry.name}:</span>
              <span>₹{entry.value.toLocaleString('en-IN')}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel }: any) => (
    <div className="bg-white p-2.5 sm:p-3 rounded-xl shadow-xs border border-slate-100/90 flex items-center gap-2 sm:gap-3 transition-all hover:shadow-md">
      <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", color)}>
        <Icon className="text-white w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <span className="text-slate-500 text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wider block truncate">{title}</span>
        <h3 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight">₹{value.toLocaleString('en-IN')}</h3>
        {subValue !== undefined && subLabel && (
          <p className="text-[8px] sm:text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
            <span>{subLabel}:</span>
            <span className="text-slate-705 font-extrabold">₹{subValue.toLocaleString('en-IN')}</span>
          </p>
        )}
      </div>
    </div>
  );


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="hidden md:block">
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Overview</h2>
          
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 md:p-1 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setTimeframe('overall')}
              className={cn(
                "px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-wider",
                timeframe === 'overall'
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Overall
            </button>
            <button
              onClick={() => setTimeframe('today')}
              className={cn(
                "px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-wider",
                timeframe === 'today'
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Today's Sale
            </button>
          </div>
          <div className="bg-blue-50 px-2.5 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-blue-100">
            <span className="text-blue-700 font-bold text-xs">Today: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </header>

      {/* Quick Actions (Requested by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 md:gap-3">
        <button 
          onClick={() => (window as any).setActiveTab?.('add-transaction')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-blue-700 transition-all active:scale-95 cursor-pointer text-center"
        >
          <PlusCircle className="mb-1.5 w-5 h-5" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Add Sale</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('transactions')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-800 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-slate-900 transition-all active:scale-95 cursor-pointer text-center"
        >
          <History className="mb-1.5 w-5 h-5" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Sales History</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('credit')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-amber-500 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-amber-600 transition-all active:scale-95 cursor-pointer text-center"
        >
          <CreditCard className="mb-1.5 w-5 h-5" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Credit</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('income-expense')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer text-center"
        >
          <TrendingDown className="mb-1.5 w-5 h-5" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Income & Expense</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('secretary-handover')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer text-center col-span-2 sm:col-span-1"
        >
          <Users className="mb-1.5 w-5 h-5" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Sec Handover</span>
        </button>
      </div>

      {/* SECTION 1: Coupon Sales Ledger */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-2">
          <h3 className="font-black text-slate-800 text-xs md:text-sm uppercase tracking-widest">Coupon Sales</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard 
            title="Total Coupon Revenue" 
            value={totalSales} 
            icon={IndianRupee} 
            color="bg-blue-600" 
          />
          <StatCard 
            title="Scc Book Credits" 
            value={totalCredit} 
            icon={CreditCard} 
            color="bg-amber-500" 
          />
          <StatCard 
            title="Total Cash sales" 
            value={totalCashSale} 
            icon={Wallet} 
            color="bg-emerald-600" 
          />
          <StatCard 
            title="Total UPI Receipts" 
            value={totalUPI} 
            icon={QrCode} 
            color="bg-indigo-600" 
          />
        </div>

        {/* Dynamic Payment methods sub-row */}
        {nonCashCreditMethods.filter(m => !m.isDisabled || getAmountByMethod(m.id, timeframe) > 0).length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-2">
              <h4 className="font-black text-slate-800 text-xs md:text-sm uppercase tracking-widest">UPI App Channel Receipts</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {nonCashCreditMethods
                .filter(m => !m.isDisabled || getAmountByMethod(m.id, timeframe) > 0)
                .map(method => {
                  const IconComponent = method.id === 'TRUST GPAY' ? QrCode : Smartphone;
                  let cardColor = 'bg-indigo-600';
                  if (method.id === 'TRUST GPAY') cardColor = 'bg-teal-600';
                  else if (method.id === 'SOFIA GPAY') cardColor = 'bg-violet-600';
                  else if (method.id === 'JOHNY GPAY') cardColor = 'bg-sky-600';
                  else if (method.id === 'OTHER_UPI') cardColor = 'bg-rose-500';

                  return (
                    <StatCard 
                      key={method.id}
                      title={method.label} 
                      value={getAmountByMethod(method.id, timeframe)} 
                      icon={IconComponent} 
                      color={cardColor} 
                    />
                  );
                })}
            </div>
          </div>
        )}
      </section>


      {/* Transaction History Section */}
      <div id="transaction-history-section" className="scroll-mt-6 border-t border-slate-100 pt-6">
        <TransactionList 
          transactions={transactions} 
          onDelete={onDeleteTransaction}
          onToggleTreasurer={onToggleTreasurer}
          onEdit={onEditTransaction}
          customPaymentLabels={customPaymentLabels}
        />
      </div>
    </div>
  );
};

export default Dashboard;
