import React, { useState } from 'react';
import { 
  Search, 
  Calendar, 
  Phone, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare, 
  Clock,
  ChevronRight,
  ArrowRight,
  Settings as SettingsIcon,
  X,
  Save,
  Plus,
  Trash2,
  FileText,
  Download,
  Eye,
  EyeOff,
  Edit2
} from 'lucide-react';
import { Transaction, CreditSettings, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod } from '@/types';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import ConfirmationModal from './ConfirmationModal';

interface CreditManagementProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete?: (ids: string[]) => void;
  customPaymentLabels?: Record<PaymentMethod, string>;
  paymentMethodsList?: CustomPaymentMethod[];
}

const CreditManagement: React.FC<CreditManagementProps> = ({ 
  transactions, 
  onUpdateTransaction,
  onEdit,
  onDelete,
  customPaymentLabels,
  paymentMethodsList
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [overdueDaysFilter, setOverdueDaysFilter] = useState<number>(0);
  const [paymentModal, setPaymentModal] = useState<{ id: string, amount: number, paymentMethod: PaymentMethod } | null>(null);
  const [isCollapsedMode, setIsCollapsedMode] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const creditTransactions = transactions.filter(t => t.creditAmount > 0);

  const filteredCredits = creditTransactions.filter(t => {
    const days = differenceInDays(new Date(), new Date(t.date));
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.area.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOverdue = days >= overdueDaysFilter;
    return matchesSearch && matchesOverdue;
  });

  const handleRecordPayment = (id: string, amount: number, paymentMethod: PaymentMethod) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const newPaidAmount = transaction.paidAmount + amount;
    const newCreditAmount = transaction.totalAmount - newPaidAmount;

    const paymentHistory = transaction.paymentHistory || [];
    const newHistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      date: new Date().toISOString(),
      paymentMethod,
    };

    onUpdateTransaction(id, {
      paidAmount: newPaidAmount,
      creditAmount: newCreditAmount,
      paymentHistory: [...paymentHistory, newHistoryEntry],
      paymentMethod: newCreditAmount === 0 ? paymentMethod : transaction.paymentMethod,
    });

    setPaymentModal(null);
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
    
    const totalAmountSum = filteredCredits.reduce((sum, t) => sum + t.totalAmount, 0);
    const paidAmountSum = filteredCredits.reduce((sum, t) => sum + t.paidAmount, 0);
    const creditAmountSum = filteredCredits.reduce((sum, t) => sum + t.creditAmount, 0);
    const casesCount = filteredCredits.length;

    // 1. Draw top branding & registry title banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 4, 14, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('CREDIT REGISTRY & RECOVERY LEDGER', 22, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: Outstanding Credit Cases (${casesCount} Record${casesCount === 1 ? '' : 's'})`, 22, 22);

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 26, 196, 26);

    // 2. Draw 4 modern horizontal metric summary cards
    const cardWidth = 42.5;
    const cardHeight = 20;
    const cardGap = 4;
    const startY = 32;

    const drawSummaryCard = (
      x: number, 
      y: number, 
      w: number, 
      h: number, 
      fillColor: [number, number, number], 
      strokeColor: [number, number, number], 
      label: string, 
      value: string, 
      labelColor: [number, number, number], 
      valueColor: [number, number, number]
    ) => {
      doc.setFillColor(...fillColor);
      doc.setDrawColor(...strokeColor);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, 'FD');
      
      doc.setFillColor(...strokeColor);
      doc.rect(x, y, 2.5, h, 'F');

      // Card Label
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...labelColor);
      doc.text(label, x + 5, y + 7);

      // Card Value
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...valueColor);
      doc.text(value, x + 5, y + 15);
    };

    // Card 1: Sales Amount
    drawSummaryCard(
      14, 
      startY, 
      cardWidth, 
      cardHeight, 
      [248, 250, 252], // slate-50
      [203, 213, 225], // slate-300
      "SALES VALUE", 
      `₹${totalAmountSum.toLocaleString('en-IN')}`, 
      [100, 116, 139], 
      [15, 23, 42]
    );

    // Card 2: Recovered / Paid amount
    drawSummaryCard(
      14 + (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [230, 244, 234], // light green
      [52, 211, 153], 
      "RECOVERED AMOUNT", 
      `₹${paidAmountSum.toLocaleString('en-IN')}`, 
      [4, 120, 87], 
      [6, 95, 70]
    );

    // Card 3: Outstanding Credit remaining
    drawSummaryCard(
      14 + 2 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [252, 232, 230], // light red
      [252, 165, 165], 
      "OUTSTANDING BALANCE", 
      `₹${creditAmountSum.toLocaleString('en-IN')}`, 
      [185, 28, 28], 
      [153, 27, 27]
    );

    // Card 4: Cases Count
    drawSummaryCard(
      14 + 3 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [254, 243, 199], // warm amber
      [252, 211, 77], 
      "ACTIVE COLLECTIONS", 
      `${casesCount} Case${casesCount === 1 ? '' : 's'}`, 
      [180, 83, 9], 
      [146, 64, 14]
    );

    // 3. Prepare table report rows & headers
    const tableData = [
      ...filteredCredits.map(t => [
        format(new Date(t.date), 'dd/MM/yyyy'),
        t.name,
        t.area && t.area !== 'N/A' ? t.area : '-',
        `Rs. ${t.totalAmount.toLocaleString('en-IN')}`,
        `Rs. ${t.paidAmount.toLocaleString('en-IN')}`,
        `Rs. ${t.creditAmount.toLocaleString('en-IN')}`,
        t.bookNumber || '-'
      ]),
      [
        'TOTAL SUMMARY',
        '',
        '',
        `Rs. ${totalAmountSum.toLocaleString('en-IN')}`,
        `Rs. ${paidAmountSum.toLocaleString('en-IN')}`,
        `Rs. ${creditAmountSum.toLocaleString('en-IN')}`,
        ''
      ]
    ];

    autoTable(doc, {
      head: [['Sale Date', 'Customer Name', 'Location', 'Committed', 'Collected', 'Credit Due', 'Book No']],
      body: tableData,
      startY: startY + cardHeight + 8,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 30, bottom: 25 },
      headStyles: {
        fillColor: [15, 23, 42], // deep slate
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' }, // Sale Date
        1: { cellWidth: 35, fontStyle: 'bold' }, // Customer Name
        2: { cellWidth: 25 }, // Location / Area
        3: { cellWidth: 24, halign: 'right' }, // Committed
        4: { cellWidth: 24, halign: 'right' }, // Collected
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }, // Credit Balance
        6: { cellWidth: 24, halign: 'center' }, // Book No
      }, // Sum of column widths = 20 + 35 + 25 + 24 + 24 + 30 + 24 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [51, 65, 85], // slate-700
        lineColor: [226, 232, 240], // slate-200
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // slate-50
      },
      didParseCell: function(data) {
        const isLastRow = data.row.index === tableData.length - 1;
        
        if (isLastRow) {
          data.cell.styles.fillColor = [241, 245, 249]; // slate-100
          data.cell.styles.textColor = [15, 23, 42]; // slate-900
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }

        if (data.section === 'body' && !isLastRow) {
          // Highlight credit due column with soft red styling
          if (data.column.index === 5) {
            data.cell.styles.fillColor = [252, 232, 230]; // Light red (#fce8e6)
            data.cell.styles.textColor = [185, 28, 28]; // Dark red
            data.cell.styles.fontStyle = 'bold';
          }
          // Highlight customer name text in deep dark-slate color
          if (data.column.index === 1) {
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      },
      didDrawPage: function(data) {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.5);
        doc.line(14, 278, 196, 278);
        
        doc.text(`Official Outstanding Credits Recovery Statement • 2026`, 14, 283);
        
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(pageText, 196 - doc.getTextWidth(pageText), 283);
      }
    });

    doc.save(`outstanding_credits_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  };

  const exportCSV = () => {
    const csvData = filteredCredits.map(t => ({
      Date: format(new Date(t.date), 'dd/MM/yyyy'),
      Name: t.name,
      Area: t.area,
      TotalAmount: t.totalAmount,
      PaidAmount: t.paidAmount,
      CreditAmount: t.creditAmount,
      BookNumber: t.bookNumber || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `outstanding_credits_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Credit Management</h1>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">Track and recover outstanding balances</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportPDF}
            title="Print to PDF"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg md:rounded-xl hover:bg-slate-50 hover:text-red-600 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={exportCSV}
            title="Export as CSV"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg md:rounded-xl hover:bg-slate-50 hover:text-emerald-600 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download size={16} />
          </button>
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-2 py-0.5 md:px-3 md:py-1 bg-amber-50 rounded-lg md:rounded-xl">
              <p className="text-[7px] md:text-[8px] font-black text-amber-600 uppercase tracking-wider">Outstanding</p>
              <p className="text-[11px] md:text-sm font-black text-amber-700">₹{creditTransactions.reduce((acc, t) => acc + t.creditAmount, 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="px-2 py-0.5 md:px-3 md:py-1 bg-blue-50 rounded-lg md:rounded-xl">
              <p className="text-[7px] md:text-[8px] font-black text-blue-600 uppercase tracking-wider">Cases</p>
              <p className="text-[11px] md:text-sm font-black text-blue-700">{creditTransactions.length}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text"
            placeholder="Search customer or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs md:text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="text-slate-400 shrink-0" size={14} />
          <select 
            value={overdueDaysFilter}
            onChange={(e) => setOverdueDaysFilter(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs md:text-sm appearance-none cursor-pointer"
          >
            <option value={0}>All Overdue</option>
            <option value={7}>7+ Days Overdue</option>
            <option value={15}>15+ Days Overdue</option>
            <option value={30}>30+ Days Overdue</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 md:space-y-3">
        {filteredCredits.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="bg-slate-50 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={20} className="text-emerald-300" />
            </div>
            <h3 className="text-slate-900 font-bold text-sm">No outstanding credits</h3>
            <p className="text-slate-400 text-xs">All payments are up to date!</p>
          </div>
        ) : (
          filteredCredits.map((t) => {
            const days = differenceInDays(new Date(), new Date(t.date));
            const isExpanded = !isCollapsedMode || expandedIds.has(t.id);
            return (
              <div 
                key={t.id} 
                className={cn(
                  "bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all group relative overflow-hidden",
                  isCollapsedMode ? "cursor-pointer hover:border-blue-200" : "",
                  isExpanded ? "border-slate-200 shadow-sm" : "border-slate-100 shadow-sm"
                )}
                onClick={() => isCollapsedMode && toggleExpand(t.id)}
              >
                {days >= 30 && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />}
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-start gap-2.5">
                      <div className="bg-blue-50 p-2 rounded-lg md:rounded-xl text-blue-600 shrink-0">
                        <IndianRupee size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm md:text-base leading-tight">{t.name}</h3>
                          {isCollapsedMode && (
                            <span className="text-[8px] md:text-[9px] text-slate-400 font-bold bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 px-1 py-0.5 rounded transition-colors shrink-0">
                              {expandedIds.has(t.id) ? '▲ Hide' : '▼ Details'}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-[9px] md:text-xs font-semibold flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {format(new Date(t.date), 'dd MMM')} • {t.area}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[8px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                            days >= 30 ? "bg-rose-50 text-rose-600" : 
                            days >= 15 ? "bg-amber-50 text-amber-600" : 
                            "bg-blue-50 text-blue-600"
                          )}>
                            {days} Days Overdue
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row items-center justify-between sm:justify-end gap-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[8px] font-black uppercase tracking-wider">Balance Due</span>
                      <span className="text-base md:text-xl font-black text-rose-600 leading-tight">₹{t.creditAmount.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-slate-400 font-medium">Total: ₹{t.totalAmount}</span>
                    </div>

                    {isExpanded && (
                      <div className="flex items-center">
                        <button 
                          onClick={() => setPaymentModal({ id: t.id, amount: t.creditAmount, paymentMethod: 'CASH' })}
                          className="bg-slate-900 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl font-bold text-xs hover:bg-slate-800 transition-all active:scale-95 shadow flex items-center gap-1 cursor-pointer"
                        >
                          <span>Record</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                    {t.paymentHistory && t.paymentHistory.length > 0 && (
                      <div>
                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment History</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.paymentHistory.map((entry) => {
                            const mLabel = entry.paymentMethod 
                              ? (customPaymentLabels?.[entry.paymentMethod] || DEFAULT_PAYMENT_LABELS[entry.paymentMethod])
                              : 'Cash';
                            return (
                              <div key={entry.id} className="bg-slate-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-700 font-sans">₹{entry.amount}</span>
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider bg-white px-1 py-0.5 rounded border border-slate-100">
                                  {mLabel}
                                </span>
                                <span className="text-[9px] text-slate-400">{format(new Date(entry.date), 'dd MMM')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action buttons inside expanded card */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                      <button 
                        onClick={() => onEdit(t)}
                        className="p-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all cursor-pointer"
                        title="Edit Transaction"
                      >
                        <Edit2 size={14} />
                      </button>
                      {onDelete && (
                        <button 
                          onClick={() => setDeleteId(t.id)}
                          className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 transition-all cursor-pointer"
                          title="Delete Transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Record Payment</h3>
              <p className="text-slate-500 text-sm mt-1">Enter the amount received from the customer</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Amount Received</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</div>
                  <input 
                    type="number"
                    value={paymentModal.amount}
                    onChange={(e) => setPaymentModal({ ...paymentModal, amount: parseInt(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg"
                  />
                </div>
              </div>

              {/* Payment Method Selector Grid */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(paymentMethodsList && paymentMethodsList.length > 0
                    ? paymentMethodsList.filter(m => m.id !== 'CREDIT' && !m.isDisabled)
                    : [
                        { id: 'CASH', label: customPaymentLabels?.CASH || 'Cash' },
                        { id: 'GOOGLE_PAY', label: customPaymentLabels?.GOOGLE_PAY || 'Google Pay' },
                        { id: 'PHONE_PAY', label: customPaymentLabels?.PHONE_PAY || 'PhonePe' },
                        { id: 'PAYTM', label: customPaymentLabels?.PAYTM || 'Paytm' },
                        { id: 'OTHER_UPI', label: customPaymentLabels?.OTHER_UPI || 'Other UPI' }
                      ]
                  ).map((methodObj) => {
                    const method = methodObj.id;
                    const customLabel = methodObj.label;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentModal({ ...paymentModal, paymentMethod: method })}
                        className={cn(
                          "px-3 py-2 border rounded-xl text-[10px] font-bold transition-all text-center truncate",
                          paymentModal.paymentMethod === method
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {customLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPaymentModal(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleRecordPayment(paymentModal.id, paymentModal.amount, paymentModal.paymentMethod)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId && onDelete) {
            onDelete([deleteId]);
          }
          setDeleteId(null);
        }}
        title="Delete Credit Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

const IndianRupee = ({ size }: { size: number }) => (
  <span style={{ fontSize: size, fontWeight: 'bold' }}>₹</span>
);

export default CreditManagement;
