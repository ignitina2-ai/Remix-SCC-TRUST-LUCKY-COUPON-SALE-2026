import React, { useState, useEffect } from 'react';
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
  Users,
  Share2
} from 'lucide-react';
import { shareDailySalesCard, shareUPIReceiptCard } from '../utils/shareUtils';
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
import TransactionForm from './TransactionForm';

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
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  editingTransaction?: Transaction | null;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onCancelEdit?: () => void;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
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
  onEditTransaction,
  onAddTransaction,
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  permissions
}) => {
  const [timeframe, setTimeframe] = useState<'overall' | 'today'>('overall');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const getTodayFormattedIST = (dateObj: Date = new Date()) => {
    const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dateObj);
    const [year, month, day] = datePart.split('-');
    
    const timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(dateObj);

    return `${day}.${month}.${year}, ${timePart}`;
  };

  useEffect(() => {
    setCurrentTimeStr(getTodayFormattedIST());
    const interval = setInterval(() => {
      setCurrentTimeStr(getTodayFormattedIST());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to share modern daily sales overview report card by specific timeframe
  const shareDailyCardByTimeframe = async (selectedTimeframe: 'today' | 'overall') => {
    const todayIST = getTodayISTStr();
    
    // Filter transactions list based on chosen timeframe
    const txList = selectedTimeframe === 'today' 
      ? transactions.filter(t => getLocalDatePart(t.date) === todayIST)
      : transactions;

    const salesSum = (txList || []).reduce((acc, t) => acc + t.totalAmount, 0);
    const creditSum = (txList || []).reduce((acc, t) => acc + t.creditAmount, 0);
    const cashSum = getAmountByMethod('CASH', selectedTimeframe);
    
    const methods = paymentMethodsList && paymentMethodsList.length > 0
      ? paymentMethodsList
      : getDefaultPaymentMethodsList(customPaymentLabels);

    const nonCashCreditMethods = methods.filter(m => m.id !== 'CASH' && m.id !== 'CREDIT');
    const upiSum = nonCashCreditMethods.reduce((sum, m) => sum + getAmountByMethod(m.id, selectedTimeframe), 0);

    const handoverSum = selectedTimeframe === 'today'
      ? (secretaryHandovers || []).filter(h => getLocalDatePart(h.date) === todayIST).reduce((acc, h) => acc + h.amount, 0)
      : (secretaryHandovers || []).reduce((acc, h) => acc + h.amount, 0);

    const upiBreakdown = nonCashCreditMethods.map(m => ({
      label: m.label,
      amount: getAmountByMethod(m.id, selectedTimeframe),
    })).filter(item => item.amount > 0);

    await shareDailySalesCard({
      date: selectedTimeframe === 'today' ? todayIST : 'Overall',
      totalSales: salesSum,
      totalCredit: creditSum,
      totalCashSale: cashSum,
      totalUPI: upiSum,
      totalHandover: handoverSum,
      upiBreakdown,
    });
  };

  // Unified string-based date helpers for consistent calculation across timezones to match Asia/Kolkata perfectly
  const getTodayISTStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  };

  const getLocalDatePart = (dateString: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) {
        return dateString.split('T')[0];
      }
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    } catch (e) {
      return dateString.split('T')[0];
    }
  };

  // Filter lists based on timeframe
  const filteredTransactionsList = timeframe === 'today' 
    ? transactions.filter(t => {
        return getLocalDatePart(t.date) === getTodayISTStr();
      })
    : transactions;

  // Helper to calculate total received amount for a payment method across the filtered transactions
  const getAmountByMethod = (method: PaymentMethod, viewTimeframe: 'overall' | 'today') => {
    const todayIST = getTodayISTStr();
    return (transactions || []).reduce((acc, t) => {
      // 1. Filter payment history entries based on timeframe
      const relevantHistory = (t.paymentHistory || []).filter(entry => {
        const matchesMethod = entry.paymentMethod === method;
        if (!matchesMethod) return false;
        
        if (viewTimeframe === 'today') {
          return getLocalDatePart(entry.date) === todayIST;
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
          timeframeMatches = getLocalDatePart(t.date) === todayIST;
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
  const totalCashSale = totalCash;

  const totalHandover = timeframe === 'today'
    ? (secretaryHandovers || []).filter(h => {
        return getLocalDatePart(h.date) === getTodayISTStr();
      }).reduce((acc, h) => acc + h.amount, 0)
    : (secretaryHandovers || []).reduce((acc, h) => acc + h.amount, 0);

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

    // Populate with transaction data using exact string-based Asia/Kolkata split to be immune to timezone shifts
    (transactions || []).forEach(t => {
      if (!t.date) return;
      const datePart = getLocalDatePart(t.date);
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        const day = parseInt(parts[2], 10);
        
        if (month === currentMonth && year === currentYear) {
          const dayIndex = day - 1;
          if (dayIndex >= 0 && dayIndex < totalDays) {
            chartData[dayIndex]['Total Sales'] += t.totalAmount || 0;
            chartData[dayIndex]['Amount Collected'] += t.paidAmount || 0;
          }
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

  const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel, className }: any) => (
    <div className={cn("bg-white p-2.5 sm:p-3 rounded-xl shadow-xs border border-slate-100/90 flex items-center gap-2 sm:gap-3 transition-all hover:shadow-md", className)}>
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
        <div className="flex items-center justify-between gap-1.5 w-full md:w-auto">
          <div className="flex items-center justify-between md:justify-start gap-1.5 w-full md:w-auto">
            <div className="flex items-center gap-0.5 md:gap-1 bg-slate-100 p-0.5 md:p-1 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner shrink-0">
              <button
                onClick={() => setTimeframe('overall')}
                className={cn(
                  "px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-wider",
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
                  "px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-wider",
                  timeframe === 'today'
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Today's Sale
              </button>
            </div>
            <div className="bg-blue-50 px-2 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-blue-100 shrink-0">
              <span className="text-blue-700 font-extrabold text-[10px] md:text-xs font-mono whitespace-nowrap"> {currentTimeStr || getTodayFormattedIST()}</span>
            </div>
          </div>
          
          <button 
            disabled={permissions?.canShareReport === false}
            onClick={() => permissions?.canShareReport !== false && setIsShareModalOpen(true)}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0",
              permissions?.canShareReport === false
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-65"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/20"
            )}
          >
            <Share2 size={13} className={permissions?.canShareReport === false ? "" : "animate-pulse"} />
            <span>Share Report</span>
          </button>
        </div>
      </header>

      {/* Mobile-only Share Daily Report button moved to between Each UPI Receipts and Add New Sale */}

      {/* Quick Actions (Requested by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 md:gap-3">
        <button 
          onClick={() => {
            const el = document.getElementById('dashboard-add-sale-form-container');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
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
          className="hidden sm:flex flex-col items-center justify-center p-3 md:p-4 bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-md hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer text-center col-span-2 sm:col-span-1"
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <StatCard 
            title="Total Coupon Sale" 
            value={totalSales} 
            icon={IndianRupee} 
            color="bg-blue-600" 
          />
          <StatCard 
            title="Total Credits" 
            value={totalCredit} 
            icon={CreditCard} 
            color="bg-red-600" 
          />
          <StatCard 
            title="Total Cash sales" 
            value={totalCashSale} 
            icon={Wallet} 
            color="bg-green-600" 
          />
          <StatCard 
            title="All UPI Receipts" 
            value={totalUPI} 
            icon={QrCode} 
            color="bg-indigo-600" 
          />
          <StatCard 
            title="Sec Handover" 
            value={totalHandover} 
            icon={Users} 
            color="bg-teal-600" 
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* Dynamic Payment methods sub-row */}
        {nonCashCreditMethods.filter(m => !m.isDisabled || getAmountByMethod(m.id, timeframe) > 0).length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-2">
              <h4 className="font-black text-slate-800 text-xs md:text-sm uppercase tracking-widest">Each UPI Receipts</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {nonCashCreditMethods
                .filter(m => !m.isDisabled || getAmountByMethod(m.id, timeframe) > 0)
                .map(method => {
                  const IconComponent = method.id === 'TRUST GPAY' ? QrCode : Smartphone;
                  let cardColor = 'bg-indigo-600';
                  if (method.id === 'TRUST GPAY') cardColor = 'bg-blue-600';
                  else if (method.id === 'SOFIA GPAY') cardColor = 'bg-orange-500';
                  else if (method.id === 'JOHNY GPAY') cardColor = 'bg-violet-600';
                  else if (method.id === 'OTHER_UPI') cardColor = 'bg-rose-500';

                  const amount = getAmountByMethod(method.id, timeframe);
                  const methodTxnsCount = (transactions || []).filter(t => {
                    const sameMethod = t.paymentMethod === method.id;
                    if (!sameMethod) return false;
                    if (timeframe === 'today') {
                      return getLocalDatePart(t.date) === getTodayISTStr();
                    }
                    return true;
                  }).length;

                  return (
                    <div key={method.id}>
                      <StatCard 
                        title={method.label} 
                        value={amount} 
                        icon={IconComponent} 
                        color={cardColor} 
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {/* Mobile-only Share Daily Report button placed between Each UPI Receipts and Add New Sale */}
      <div className="block md:hidden pb-4 md:py-0 px-0.5">
        <button 
          disabled={permissions?.canShareReport === false}
          onClick={() => permissions?.canShareReport !== false && setIsShareModalOpen(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            permissions?.canShareReport === false
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-65"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 text-white shadow-md shadow-indigo-600/20"
          )}
        >
          <Share2 size={14} className={permissions?.canShareReport === false ? "" : "animate-pulse"} />
          <span>Share Report</span>
        </button>
      </div>

      {/* Add New Sale / Edit Sale Section */}
      <div id="dashboard-add-sale-form-container" className="scroll-mt-6 border-y border-slate-100 py-6 md:py-8">
        <div className="max-w-2xl mx-auto">
          <TransactionForm 
            onAddTransaction={onAddTransaction}
            editingTransaction={editingTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onCancelEdit={onCancelEdit}
            transactions={transactions}
            onDelete={onDeleteTransaction}
            onToggleTreasurer={onToggleTreasurer}
            onEdit={onEditTransaction || (() => {})}
            customPaymentLabels={customPaymentLabels}
            paymentMethodsList={paymentMethodsList}
            permissions={permissions}
            hideList={true}
          />
        </div>
      </div>

      {/* Transaction History Section */}
      <div id="transaction-history-section" className="scroll-mt-6 border-t border-slate-100 pt-6">
        <TransactionList 
          transactions={transactions} 
          onDelete={onDeleteTransaction}
          onToggleTreasurer={onToggleTreasurer}
          onEdit={onEditTransaction}
          customPaymentLabels={customPaymentLabels}
          permissions={permissions}
        />
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-100 transform scale-100 animate-in zoom-in duration-300">
            <div className="text-center mb-6">
              <h2 className="mx-auto w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <Share2 size={24} />
              </h2>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Share Report</h3>
              <p className="text-slate-500 text-xs mt-1 font-bold">ഏത് റിപ്പോർട്ടാണ് ലഭിക്കേണ്ടത്?</p>
              <p className="text-slate-400 text-[10px] mt-0.5">Choose report timeframe to download & share</p>
            </div>
            
            <div className="space-y-2.5">
              <button
                onClick={async () => {
                  setIsShareModalOpen(false);
                  await shareDailyCardByTimeframe('today');
                }}
                className="w-full flex flex-col items-center justify-center gap-0.5 p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-white rounded-xl active:scale-[0.98] transition-all shadow-md cursor-pointer"
              >
                <span className="text-xs font-black uppercase tracking-wider">Today's Report</span>
                <span className="text-[10px] opacity-90 font-medium">ഇന്നത്തെ റിപ്പോർട്ട്</span>
              </button>
              
              <button
                onClick={async () => {
                  setIsShareModalOpen(false);
                  await shareDailyCardByTimeframe('overall');
                }}
                className="w-full flex flex-col items-center justify-center gap-0.5 p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                <span className="text-xs font-black uppercase tracking-wider">Overall Report</span>
                <span className="text-[10px] text-slate-500 font-semibold">ആകെ റിപ്പോർട്ട്</span>
              </button>
              
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer mt-2"
              >
                Cancel / റദ്ദാക്കുക
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
