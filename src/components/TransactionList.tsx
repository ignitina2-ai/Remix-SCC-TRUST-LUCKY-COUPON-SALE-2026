import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  Table as TableIcon,
  Calendar,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  MapPin,
  User,
  IndianRupee,
  CreditCard,
  Wallet,
  Smartphone,
  Eye,
  EyeOff,
  Share2,
  Printer
} from 'lucide-react';
import { shareTransactionReceiptCard } from '../utils/shareUtils';
import { Transaction, PaymentMethod, DEFAULT_PAYMENT_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import ConfirmationModal from './ConfirmationModal';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (ids: string[]) => void;
  onToggleTreasurer: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  customPaymentLabels?: Record<PaymentMethod, string>;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  onDelete, 
  onToggleTreasurer,
  onEdit,
  customPaymentLabels,
  permissions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCollapsedMode, setIsCollapsedMode] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const filteredTransactions = (transactions || [])
    .filter(t => {
      const name = (t.name || '').toLowerCase();
      const area = (t.area || '').toLowerCase();
      const date = t.date || '';
      const term = searchTerm.toLowerCase();
      return (name.includes(term) || area.includes(term)) &&
             (dateFilter === '' || date.startsWith(dateFilter));
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      
      const valA = isNaN(dateA) ? 0 : dateA;
      const valB = isNaN(dateB) ? 0 : dateB;
      
      const diff = sortOrder === 'desc' ? valB - valA : valA - valB;
      if (diff !== 0) return diff;
      
      const idA = a.id || '';
      const idB = b.id || '';
      return sortOrder === 'desc' ? idB.localeCompare(idA) : idA.localeCompare(idB);
    });

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
    
    const totalAmountSum = filteredTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
    const totalBooksSum = filteredTransactions.reduce((acc, t) => acc + t.books, 0);
    const totalCouponsSum = filteredTransactions.reduce((acc, t) => acc + t.coupons, 0);
    const paidTreasurerCount = filteredTransactions.filter(t => t.paidToTreasurer).length;
    const paidToTreasurerAmount = filteredTransactions.filter(t => t.paidToTreasurer).reduce((acc, t) => acc + t.totalAmount, 0);

    // 1. Draw top branding & registry title banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 4, 14, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('COUPON SALES TRANSACTION HISTORY', 22, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: All Coupon Transactions (${filteredTransactions.length} Record${filteredTransactions.length === 1 ? '' : 's'})`, 22, 22);

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

    // Card 1: Total Transacted
    drawSummaryCard(
      14, 
      startY, 
      cardWidth, 
      cardHeight, 
      [248, 250, 252], // slate-50
      [203, 213, 225], // slate-300
      "TOTAL SALES VOLUME", 
      `₹${totalAmountSum.toLocaleString('en-IN')}`, 
      [100, 116, 139], 
      [15, 23, 42]
    );

    // Card 2: Total Books Sold
    drawSummaryCard(
      14 + (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [234, 244, 255], // light energetic blue
      [147, 197, 253], 
      "BOOKS DISTRIBUTED", 
      `${totalBooksSum.toLocaleString('en-IN')} Book${totalBooksSum === 1 ? '' : 's'}`, 
      [29, 78, 216], 
      [30, 58, 138]
    );

    // Card 3: Total Coupons Issued
    drawSummaryCard(
      14 + 2 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [254, 243, 199], // warm amber (#fef3c7)
      [252, 211, 77], 
      "COUPONS ISSUED", 
      `${totalCouponsSum.toLocaleString('en-IN')} Coupon${totalCouponsSum === 1 ? '' : 's'}`, 
      [180, 83, 9], 
      [146, 64, 14]
    );

    // Card 4: Paid to Treasurer ratio
    drawSummaryCard(
      14 + 3 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [230, 244, 234], // light green (#e6f4ea)
      [52, 211, 153], 
      "TREASURER HANDOVER", 
      `₹${paidToTreasurerAmount.toLocaleString('en-IN')} (${paidTreasurerCount}/${filteredTransactions.length})`, 
      [4, 120, 87], 
      [6, 95, 70]
    );

    // 3. Prepare rows & headers
    const tableData = [
      ...filteredTransactions.map(t => {
        const methodLabel = customPaymentLabels?.[t.paymentMethod] || DEFAULT_PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod.replace('_', ' ');
        return [
          format(new Date(t.date), 'dd.MM.yyyy'),
          t.name,
          t.area && t.area !== 'N/A' ? t.area : '-',
          t.books.toString(),
          t.coupons.toString(),
          t.bookNumber || '-',
          `Rs. ${t.totalAmount.toLocaleString('en-IN')}`,
          methodLabel,
          t.paidToTreasurer ? 'PAID' : 'PENDING'
        ];
      }),
      [
        'TOTAL SUMMARY',
        '',
        '',
        totalBooksSum.toString(),
        totalCouponsSum.toString(),
        '',
        `Rs. ${totalAmountSum.toLocaleString('en-IN')}`,
        '',
        `Paid: ${paidTreasurerCount}`
      ]
    ];

    autoTable(doc, {
      head: [['Date', 'Sponsor / Buyer', 'Location', 'Books', 'Coupons', 'Book No', 'Amount', 'Payment Method', 'Treasurer']],
      body: tableData,
      startY: startY + cardHeight + 8,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 30, bottom: 25 },
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' }, // Date
        1: { cellWidth: 32, fontStyle: 'bold' }, // Buyer / Name
        2: { cellWidth: 22 }, // Location
        3: { cellWidth: 12, halign: 'center' }, // Books
        4: { cellWidth: 14, halign: 'center' }, // Coupons
        5: { cellWidth: 15, halign: 'center' }, // Book No
        6: { cellWidth: 21, halign: 'right' }, // Amount
        7: { cellWidth: 24, halign: 'left' }, // Payment Method
        8: { cellWidth: 24, halign: 'center' }, // Treasurer
      }, // Sum of column widths = 18 + 32 + 22 + 12 + 14 + 15 + 21 + 24 + 24 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
      styles: {
        fontSize: 7.2,
        cellPadding: 2.2,
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
          data.cell.styles.fontSize = 7.8;
        }

        if (data.section === 'body' && !isLastRow) {
          // Highlight Treasurer status cell
          if (data.column.index === 8) {
            const trStatus = data.row.raw[8];
            if (trStatus === 'PAID') {
              data.cell.styles.fillColor = [230, 244, 234]; // Light Green
              data.cell.styles.textColor = [16, 124, 65]; // Green text
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [254, 243, 199]; // Light amber
              data.cell.styles.textColor = [180, 83, 9]; // Amber text
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Make column prices stand out
          if (data.column.index === 6) {
            data.cell.styles.fontStyle = 'bold';
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
        
        doc.text(`Official Coupon Sales Transaction History & Audit Ledger • 2026`, 14, 283);
        
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(pageText, 196 - doc.getTextWidth(pageText), 283);
      }
    });

    const filename = `transactions_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
    doc.save(filename);
  };

  const exportCSV = () => {
    const csvData = filteredTransactions.map(t => ({
      Date: format(new Date(t.date), 'dd.MM.yyyy'),
      Name: t.name,
      Area: t.area,
      Books: t.books,
      Coupons: t.coupons,
      BookNumber: t.bookNumber || '',
      TotalAmount: t.totalAmount,
      PaidAmount: t.paidAmount,
      CreditAmount: t.creditAmount,
      PaymentMethod: t.paymentMethod,
      PaidToTreasurer: t.paidToTreasurer ? 'YES' : 'NO'
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PaymentIcon = ({ method }: { method: PaymentMethod }) => {
    switch (method) {
      case 'CASH': return <Wallet size={16} className="text-emerald-600" />;
      case 'CREDIT': return <CreditCard size={16} className="text-amber-600" />;
      case 'GOOGLE_PAY': return <Smartphone size={16} className="text-blue-600" />;
      case 'PHONE_PAY': return <Smartphone size={16} className="text-indigo-600" />;
      case 'PAYTM': return <Smartphone size={16} className="text-sky-600" />;
      case 'OTHER_UPI': return <Smartphone size={16} className="text-violet-600" />;
      default: return null;
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Transaction History</h1>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">View and manage all coupon sales</p>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedIds.size > 0 && (
            <button 
              disabled={permissions?.canDelete === false}
              onClick={() => permissions?.canDelete !== false && setDeleteIds(Array.from(selectedIds))}
              className={cn(
                "px-2.5 py-1.5 border rounded-lg md:rounded-xl transition-all font-bold text-[10px] md:text-xs flex items-center gap-1 shadow-sm",
                permissions?.canDelete === false
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50"
                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
              )}
            >
              <Trash2 size={14} className="md:w-4 md:h-4" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-[10px] md:text-xs cursor-pointer"
            title="Print List"
          >
            <Printer size={14} className="text-blue-600 md:w-4 md:h-4" />
            Print
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs md:text-sm"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs md:text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl text-slate-700 font-semibold hover:bg-slate-100 transition-all text-[10px] md:text-xs cursor-pointer"
          >
            {sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            Sort
          </button>
        </div>
      </div>

      {/* Select All Checkbox (Top of List) */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-100 rounded-lg md:rounded-xl shadow-sm">
          <input 
            type="checkbox"
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
            onChange={toggleSelectAll}
            id="selectAllTxns"
          />
          <label htmlFor="selectAllTxns" className="text-slate-600 text-xs md:text-sm font-bold cursor-pointer select-none">
            Select All
          </label>
        </div>
      )}

      {/* List */}
      <div className="space-y-2 md:space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="bg-slate-50 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Search size={18} className="text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-bold text-sm">No transactions found</h3>
            <p className="text-slate-400 text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          filteredTransactions.map((t) => (
            <div 
              key={t.id} 
              className={cn(
                "p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all group",
                selectedIds.has(t.id) ? "bg-blue-50/50 border-blue-200" : "bg-white border-slate-100 shadow-sm hover:shadow"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg md:rounded-xl text-blue-600 ml-0.5 cursor-pointer select-none" onClick={() => toggleExpand(t.id)}>
                    <User size={16} className="md:w-5 md:h-5" />
                  </div>
                  <div className="flex-1 cursor-pointer select-none" onClick={() => toggleExpand(t.id)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm md:text-base leading-tight">{t.name}</h3>
                      {isCollapsedMode && (
                        <span className="text-[8px] md:text-[9px] text-slate-400 font-bold bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 px-1 py-0.5 rounded transition-colors shrink-0">
                          {expandedIds.has(t.id) ? '▲ Hide' : '▼ Details'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 mt-0.5 text-slate-500 text-[9px] md:text-[11px] font-semibold">
                      <span className="flex items-center gap-0.5"><MapPin size={10} /> {t.area}</span>
                      <span className="flex items-center gap-0.5"><Calendar size={10} /> {format(new Date(t.date), 'dd.MM.yyyy')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:text-right sm:justify-end ml-6 sm:ml-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">Amount</span>
                    <span className="text-sm md:text-base font-black text-slate-900">₹{t.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">Method</span>
                    <div className="flex items-center gap-1 font-semibold text-slate-700 text-[10px] md:text-xs">
                      <PaymentIcon method={t.paymentMethod} />
                      <span className="truncate max-w-[65px] sm:max-w-none">
                        {customPaymentLabels?.[t.paymentMethod] || DEFAULT_PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">Treasurer</span>
                    <button 
                      disabled={permissions?.canEdit === false}
                      onClick={() => permissions?.canEdit !== false && onToggleTreasurer(t.id)}
                      className={cn(
                        "flex items-center gap-0.5 font-bold text-[9px] md:text-[10px] px-1.5 py-0.5 md:px-2 md:py-1 rounded-full transition-all",
                        permissions?.canEdit === false ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "cursor-pointer",
                        t.paidToTreasurer 
                          ? (permissions?.canEdit === false ? "bg-slate-100 text-emerald-400/60" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100") 
                          : (permissions?.canEdit === false ? "bg-slate-100 text-slate-300" : "bg-slate-50 text-slate-400 hover:bg-slate-100")
                      )}
                    >
                      {t.paidToTreasurer ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {t.paidToTreasurer ? 'Paid' : 'Pending'}
                    </button>
                  </div>
                </div>
              </div>
              
              {(!isCollapsedMode || expandedIds.has(t.id)) && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[9px] md:text-[10px] font-semibold text-slate-500 animate-in slide-in-from-top-1 duration-200">
                  <div className="bg-slate-50 px-1.5 py-0.5 rounded-md">
                    Books: <span className="text-slate-900 font-bold">{t.books}</span>
                  </div>
                  <div className="bg-slate-50 px-1.5 py-0.5 rounded-md">
                    Coupons: <span className="text-slate-900 font-bold">{t.coupons}</span>
                  </div>
                  {t.bookNumber && (
                    <div className="bg-slate-50 px-1.5 py-0.5 rounded-md">
                      Book No: <span className="text-slate-900 font-bold">{t.bookNumber}</span>
                    </div>
                  )}
                  {t.creditAmount > 0 && (
                    <div className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0">
                      Credit: ₹{t.creditAmount.toLocaleString('en-IN')}
                    </div>
                  )}
                  
                  {/* Action buttons in expanded mode */}
                  <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        const paymentLabel = customPaymentLabels?.[t.paymentMethod] || DEFAULT_PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod;
                        shareTransactionReceiptCard(t, paymentLabel);
                      }}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold text-[9px] md:text-[10px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all cursor-pointer"
                      title="Share Receipt Card"
                    >
                      <Share2 size={10} />
                      Share Card
                    </button>
                    {onEdit && (
                      <button 
                        disabled={permissions?.canEdit === false}
                        onClick={() => permissions?.canEdit !== false && onEdit(t)}
                        className={cn(
                          "flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold text-[9px] md:text-[10px] transition-all",
                          permissions?.canEdit === false
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                        )}
                      >
                        <Edit2 size={10} />
                        Edit
                      </button>
                    )}
                    <button 
                      disabled={permissions?.canDelete === false}
                      onClick={() => permissions?.canDelete !== false && setDeleteIds([t.id])}
                      className={cn(
                        "flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold text-[9px] md:text-[10px] transition-all",
                        permissions?.canDelete === false
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                          : "bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                      )}
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={() => {
          onDelete(deleteIds);
          setSelectedIds(new Set([...selectedIds].filter(id => !deleteIds.includes(id))));
          setDeleteIds([]);
        }}
        title="Delete Transaction"
        message={deleteIds.length > 1
          ? `Are you sure you want to delete ${deleteIds.length} transactions? This action cannot be undone.`
          : "Are you sure you want to delete this transaction? This action cannot be undone."
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default TransactionList;
