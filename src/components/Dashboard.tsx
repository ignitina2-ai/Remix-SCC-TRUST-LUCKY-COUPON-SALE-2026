import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  IndianRupee, 
  CreditCard, 
  Wallet, 
  UserCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Users,
  Smartphone,
  QrCode
} from 'lucide-react';
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

  const filteredSponsorsList = timeframe === 'today'
    ? sponsors.filter(s => {
        if (!s.collectedDate) return false;
        const d = new Date(s.collectedDate);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      })
    : sponsors;

  const filteredIncomeExpensesList = timeframe === 'today'
    ? incomeExpenses.filter(e => {
        const d = new Date(e.date);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      })
    : incomeExpenses;

  const filteredSecretaryHandoversList = timeframe === 'today'
    ? secretaryHandovers.filter(h => {
        const d = new Date(h.date);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      })
    : secretaryHandovers;

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
  
  const cashPaidToTreasurer = (transactions || [])
    .reduce((acc, t) => {
      if (!t.paidToTreasurer) return acc;

      let timeframeMatches = true;
      if (timeframe === 'today') {
        if (!t.treasurerPaidDate) {
          const d = new Date(t.date);
          const today = new Date();
          timeframeMatches = d.getDate() === today.getDate() &&
                             d.getMonth() === today.getMonth() &&
                             d.getFullYear() === today.getFullYear();
        } else {
          const d = new Date(t.treasurerPaidDate);
          const today = new Date();
          timeframeMatches = d.getDate() === today.getDate() &&
                             d.getMonth() === today.getMonth() &&
                             d.getFullYear() === today.getFullYear();
        }
      }

      if (!timeframeMatches) return acc;

      const historyCash = (t.paymentHistory || [])
        .filter(entry => {
          if (entry.paymentMethod !== 'CASH') return false;
          if (timeframe === 'today') {
            const d = new Date(entry.date);
            const today = new Date();
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
          }
          return true;
        })
        .reduce((sum, entry) => sum + entry.amount, 0);
      
      const totalHistoryAmount = (t.paymentHistory || []).reduce((sum, entry) => sum + entry.amount, 0);
      const unaccountedPaid = Math.max(0, t.paidAmount - totalHistoryAmount);

      let initialCash = 0;
      if (unaccountedPaid > 0) {
        let initTimeframeMatches = true;
        if (timeframe === 'today') {
          const d = new Date(t.date);
          const today = new Date();
          initTimeframeMatches = d.getDate() === today.getDate() &&
                                 d.getMonth() === today.getMonth() &&
                                 d.getFullYear() === today.getFullYear();
        }

        if (initTimeframeMatches) {
          if (t.paymentMethod === 'CASH' || t.paymentMethod === 'CREDIT') {
            initialCash = unaccountedPaid;
          }
        }
      }

      return acc + historyCash + initialCash;
    }, 0);

  const totalHandedToSecretary = (filteredSecretaryHandoversList || []).reduce((acc, h) => acc + h.amount, 0);
  
  const cashInHand = totalCash - cashPaidToTreasurer - totalHandedToSecretary;

  const totalSponsorAmount = (filteredSponsorsList || []).reduce((acc, s) => acc + s.amount, 0);
  const collectedSponsorAmount = (filteredSponsorsList || [])
    .filter(s => s.status === 'COLLECTED')
    .reduce((acc, s) => acc + s.amount, 0);
  const pendingSponsorAmount = totalSponsorAmount - collectedSponsorAmount;

  const totalIncome = (filteredIncomeExpensesList || [])
    .filter(e => e.type === 'INCOME')
    .reduce((acc, e) => acc + e.amount, 0);
  const totalExpense = (filteredIncomeExpensesList || [])
    .filter(e => e.type === 'EXPENSE')
    .reduce((acc, e) => acc + e.amount, 0);
  const netCashFlow = totalIncome - totalExpense;

  // Chart Data: Daily Sales (Last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const dailyTransactions = filteredTransactionsList.filter(t => t.date.startsWith(date));
    return {
      name: dailyTransactions.length > 0 ? new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }) : new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      amount: dailyTransactions.reduce((acc, t) => acc + t.totalAmount, 0),
      credit: dailyTransactions.reduce((acc, t) => acc + t.creditAmount, 0),
    };
  });

  const paymentMethodData = [
    { name: customPaymentLabels.CASH || 'Cash', value: totalCash, color: '#10b981' },
    { name: 'UPI', value: totalUPI, color: '#3b82f6' },
    { name: customPaymentLabels.CREDIT || 'Credit', value: totalCredit, color: '#f59e0b' },
  ];

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-2.5 md:p-4 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className={cn("p-1.5 md:p-2.5 rounded-lg md:rounded-xl shrink-0", color)}>
          <Icon className="text-white w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-wider line-clamp-1">{title}</p>
        <h3 className="text-sm md:text-lg font-black text-slate-900 mt-0.5">₹{value.toLocaleString('en-IN')}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="hidden md:block">
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Overview Dashboard</h2>
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
          <div className="bg-blue-50 px-2.5 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-blue-100 hidden sm:block">
            <span className="text-blue-700 font-bold text-xs md:text-sm">Today: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </header>

      {/* Quick Actions (Requested by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <button 
          onClick={() => (window as any).setActiveTab?.('add-transaction')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-md md:shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 cursor-pointer"
        >
          <TrendingUp className="mb-1.5 w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Add Sale</span>
        </button>
        <button 
          onClick={() => document.getElementById('transaction-history-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-800 text-white rounded-xl md:rounded-2xl shadow-md md:shadow-lg shadow-slate-800/20 hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
        >
          <ArrowUpRight className="mb-1.5 w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">History</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('credit')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-amber-500 text-white rounded-xl md:rounded-2xl shadow-md md:shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95 cursor-pointer"
        >
          <CreditCard className="mb-1.5 w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Credit</span>
        </button>
        <button 
          onClick={() => (window as any).setActiveTab?.('income-expense')}
          className="flex flex-col items-center justify-center p-3 md:p-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl shadow-md md:shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
        >
          <TrendingDown className="mb-1.5 w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Expense</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-4 border-b border-slate-100 pb-4 md:pb-6">
        <StatCard 
          title="Total Sales" 
          value={totalSales} 
          icon={IndianRupee} 
          color="bg-blue-600" 
        />
        <StatCard 
          title="Credit" 
          value={totalCredit} 
          icon={CreditCard} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Cash sale" 
          value={totalCashSale} 
          icon={Wallet} 
          color="bg-emerald-600" 
        />
        {nonCashCreditMethods
          .filter(m => !m.isDisabled || getAmountByMethod(m.id, timeframe) > 0)
          .map(method => {
            const IconComponent = method.id === 'GOOGLE_PAY' ? QrCode : Smartphone;
            let bgColor = 'bg-indigo-500';
            if (method.id === 'GOOGLE_PAY') bgColor = 'bg-teal-600';
            else if (method.id === 'PHONE_PAY') bgColor = 'bg-indigo-600';
            else if (method.id === 'PAYTM') bgColor = 'bg-sky-500';
            else if (method.id === 'OTHER_UPI') bgColor = 'bg-violet-600';

            return (
              <StatCard 
                key={method.id}
                title={method.label} 
                value={getAmountByMethod(method.id, timeframe)} 
                icon={IconComponent} 
                color={bgColor} 
              />
            );
          })}
        <StatCard 
          title="To Secretary" 
          value={totalHandedToSecretary} 
          icon={Users} 
          color="bg-purple-600" 
        />
      </div>

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
