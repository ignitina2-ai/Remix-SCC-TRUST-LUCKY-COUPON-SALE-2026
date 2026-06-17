import React, { useState } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Edit2,
  Calendar, 
  IndianRupee,
  Search,
  Filter,
  CheckCircle2,
  Users,
  FileText,
  Download,
  Eye,
  EyeOff,
  CreditCard,
  Wallet,
  QrCode,
  AlertCircle
} from 'lucide-react';
import { SecretaryHandover, Transaction, CustomPaymentMethod, PaymentMethod, DEFAULT_PAYMENT_LABELS, getDefaultPaymentMethodsList } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import ConfirmationModal from './ConfirmationModal';

interface SecretaryHandoverManagementProps {
  handovers: SecretaryHandover[];
  onAddHandover: (handover: Omit<SecretaryHandover, 'id'>) => void;
  onUpdateHandover?: (id: string, updates: Partial<SecretaryHandover>) => void;
  onDeleteHandover: (ids: string[]) => void;
  transactions?: Transaction[];
  paymentMethodsList?: CustomPaymentMethod[];
  customPaymentLabels?: Record<PaymentMethod, string>;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

const SecretaryHandoverManagement: React.FC<SecretaryHandoverManagementProps> = ({ 
  handovers = [], 
  onAddHandover, 
  onUpdateHandover,
  onDeleteHandover,
  transactions = [],
  paymentMethodsList,
  customPaymentLabels = DEFAULT_PAYMENT_LABELS,
  permissions
}) => {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const getTodayISTStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    date: getTodayISTStr()
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const totalHandover = (handovers || []).reduce((acc, h) => acc + h.amount, 0);

  // Helper to calculate total received amount for a payment method
  const getAmountByMethod = (method: PaymentMethod) => {
    return (transactions || []).reduce((acc, t) => {
      const relevantHistory = (t.paymentHistory || []).filter(entry => entry.paymentMethod === method);
      const historySum = relevantHistory.reduce((sum, entry) => sum + entry.amount, 0);

      const totalHistoryAmount = (t.paymentHistory || []).reduce((sum, entry) => sum + entry.amount, 0);
      const unaccountedPaid = Math.max(0, t.paidAmount - totalHistoryAmount);

      let initialPaidAllocated = 0;
      if (unaccountedPaid > 0) {
        if (t.paymentMethod === method) {
          initialPaidAllocated = unaccountedPaid;
        } else if (t.paymentMethod === 'CREDIT' && method === 'CASH') {
          initialPaidAllocated = unaccountedPaid;
        }
      }

      return acc + historySum + initialPaidAllocated;
    }, 0);
  };

  const totalSales = (transactions || []).reduce((acc, t) => acc + t.totalAmount, 0);
  const totalCredit = (transactions || []).reduce((acc, t) => acc + t.creditAmount, 0);
  const totalCash = getAmountByMethod('CASH');

  const methods = paymentMethodsList && paymentMethodsList.length > 0
    ? paymentMethodsList
    : getDefaultPaymentMethodsList(customPaymentLabels);

  const nonCashCreditMethods = methods.filter(m => m.id !== 'CASH' && m.id !== 'CREDIT');
  const totalUPI = nonCashCreditMethods.reduce((sum, m) => sum + getAmountByMethod(m.id), 0);
  const totalCashSale = totalCash;

  const handleEdit = (handover: SecretaryHandover) => {
    setFormData({
      name: handover.name,
      description: handover.description,
      amount: handover.amount.toString(),
      date: handover.date.split('T')[0]
    });
    setEditingId(handover.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredHandovers = (handovers || [])
    .filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            h.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const entryDate = new Date(h.date).getTime();
      const matchesStartDate = !startDate || entryDate >= new Date(startDate).getTime();
      const matchesEndDate = !endDate || entryDate <= new Date(endDate).getTime() + 86400000;
      
      return matchesSearch && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      const valA = isNaN(dateA) ? 0 : dateA;
      const valB = isNaN(dateB) ? 0 : dateB;
      if (valB !== valA) return valB - valA;
      return (b.id || '').localeCompare(a.id || '');
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) return;

    if (editingId && onUpdateHandover) {
      onUpdateHandover(editingId, {
        name: formData.name,
        description: formData.description,
        amount: Number(formData.amount),
        date: new Date(formData.date).toISOString()
      });
      setEditingId(null);
    } else {
      onAddHandover({
        name: formData.name,
        description: formData.description,
        amount: Number(formData.amount),
        date: new Date(formData.date).toISOString()
      });
    }

    setFormData({
      name: '',
      description: '',
      amount: '',
      date: getTodayISTStr()
    });
    setShowForm(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredHandovers.length && filteredHandovers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredHandovers.map(h => h.id)));
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

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
    
    const totalHandoverSum = filteredHandovers.reduce((acc, h) => acc + h.amount, 0);
    const distinctSecretaries = Array.from(new Set(filteredHandovers.map(h => h.name.trim()).filter(Boolean)));
    const secretaryCount = distinctSecretaries.length;
    const handoverCount = filteredHandovers.length;
    const averageTransfer = handoverCount > 0 ? Math.round(totalHandoverSum / handoverCount) : 0;

    // 1. Draw top branding & registry title banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 4, 14, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('SECRETARY TREASURY HANDOVER LEDGER', 22, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: Secretary Cash Clearances (${handoverCount} Record${handoverCount === 1 ? '' : 's'})`, 22, 22);

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

    // Card 1: Total Handed Over
    drawSummaryCard(
      14, 
      startY, 
      cardWidth, 
      cardHeight, 
      [234, 244, 255], // blue
      [147, 197, 253], 
      "TOTAL DEPOSITED FLOW", 
      `₹${totalHandoverSum.toLocaleString('en-IN')}`, 
      [29, 78, 216], 
      [30, 58, 138]
    );

    // Card 2: Distinct Secretaries
    drawSummaryCard(
      14 + (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [248, 250, 252], 
      [203, 213, 225], 
      "RECEIVING OFFICERS", 
      `${secretaryCount} Secretary${secretaryCount === 1 ? '' : 's'}`, 
      [100, 116, 139], 
      [15, 23, 42]
    );

    // Card 3: Avg Transfer size
    drawSummaryCard(
      14 + 2 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [230, 244, 234], // light green
      [52, 211, 153], 
      "AVG DEPOSIT SIZE", 
      `₹${averageTransfer.toLocaleString('en-IN')}`, 
      [4, 120, 87], 
      [6, 95, 70]
    );

    // Card 4: Batches counts
    drawSummaryCard(
      14 + 3 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [254, 243, 199], // warm amber
      [252, 211, 77], 
      "HANDOVER BATCHES", 
      `${handoverCount} Clearance${handoverCount === 1 ? '' : 's'}`, 
      [180, 83, 9], 
      [146, 64, 14]
    );

    // 3. Prepare table rows
    const tableData = [
      ...filteredHandovers.map(h => [
        format(new Date(h.date), 'dd/MM/yyyy'),
        h.name,
        h.description || '-',
        `Rs. ${h.amount.toLocaleString('en-IN')}`
      ]),
      [
        'TOTAL SUMMARY',
        `Consolidated Clearances: ${handoverCount}`,
        '',
        `Rs. ${totalHandoverSum.toLocaleString('en-IN')}`
      ]
    ];

    autoTable(doc, {
      head: [['Clearance Date', 'Receiver / Secretary Name', 'Particulars / Description', 'Handed Over Amount']],
      body: tableData,
      startY: startY + cardHeight + 8,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 30, bottom: 25 },
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' }, // Clearance Date
        1: { cellWidth: 45, fontStyle: 'bold' }, // Receiver / Secretary Name
        2: { cellWidth: 72 }, // Particulars / Description
        3: { cellWidth: 40, halign: 'right' }, // Handed Over Amount
      }, // Sum of column widths = 25 + 45 + 72 + 40 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
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
          // Style receiver name column beautifully
          if (data.column.index === 1) {
            data.cell.styles.textColor = [15, 23, 42];
          }
          // Highlight amount column with bold slate style
          if (data.column.index === 3) {
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
        
        doc.text(`Official Secretary Cash Handover Audit Ledger • 2026`, 14, 283);
        
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(pageText, 196 - doc.getTextWidth(pageText), 283);
      }
    });

    doc.save(`secretary_handovers_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  };

  const exportCSV = () => {
    const csvData = filteredHandovers.map(h => ({
      Date: format(new Date(h.date), 'dd/MM/yyyy'),
      Name: h.name,
      Description: h.description || '',
      Amount: h.amount
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `secretary_handovers_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {permissions && !permissions.canAdd && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Adding handover entries has been disabled by the Primary Admin.</span>
        </div>
      )}

      {permissions && !permissions.canEdit && editingId && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Editing handover entries has been disabled by the Primary Admin.</span>
        </div>
      )}

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Handover to Secretary</h1>
          <p className="text-slate-500 mt-0.5 font-semibold text-xs">Record cash handed over to the secretary</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportPDF}
            title="Print to PDF"
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg md:rounded-xl hover:bg-slate-50 hover:text-red-600 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <FileText size={14} />
          </button>
          <button
            onClick={exportCSV}
            title="Export as CSV"
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg md:rounded-xl hover:bg-slate-50 hover:text-emerald-600 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download size={14} />
          </button>
          {selectedIds.size > 0 && (
            <button 
              disabled={permissions?.canDelete === false}
              onClick={() => permissions?.canDelete !== false && setDeleteIds(Array.from(selectedIds))}
              className={cn(
                "p-2 border rounded-lg md:rounded-xl transition-all font-bold text-xs flex items-center gap-1",
                permissions?.canDelete === false
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-55"
                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
              )}
            >
              <Trash2 size={14} />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
          <button 
            disabled={permissions?.canAdd === false}
            onClick={() => permissions?.canAdd !== false && setShowForm(!showForm)}
            className={cn(
              "px-3 py-1.5 rounded-lg md:rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 font-bold text-xs",
              permissions?.canAdd === false
                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-55 shadow-none"
                : (showForm ? "bg-slate-150 text-slate-600 border border-slate-200 cursor-pointer" : "bg-blue-600 text-white shadow-blue-600/10 cursor-pointer")
            )}
          >
            {showForm ? <Minus size={14} /> : <Plus size={14} />}
            <span>{showForm ? "Cancel" : "Add Record"}</span>
          </button>
        </div>
      </header>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300">
          <CheckCircle2 size={16} />
          <span className="font-bold text-xs">Handover recorded successfully!</span>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-100/90 flex items-center gap-3 transition-all hover:shadow-md">
          <div className="p-2 rounded-lg shrink-0 bg-emerald-600">
            <IndianRupee className="text-white w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block truncate">Handover to Secretary </span>
            <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight">₹{totalHandover.toLocaleString('en-IN')}</h3>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
              
            </p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-lg animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Receiver Name</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                  placeholder="e.g., Secretary Name"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-405 font-bold text-xs">₹</div>
                  <input 
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-900"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Description</label>
                <input 
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                  placeholder="e.g., First collection deposit"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={editingId ? (permissions?.canEdit === false) : (permissions?.canAdd === false)}
              className={cn(
                "w-full py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 text-xs cursor-pointer",
                (editingId ? (permissions?.canEdit === false) : (permissions?.canAdd === false))
                  ? "bg-slate-300 border border-slate-400 cursor-not-allowed opacity-50 shadow-none text-slate-500"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/15"
              )}
            >
              {editingId ? 'Update Record' : 'Save Record'}
            </button>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] md:text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] md:text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filteredHandovers.length > 0 && (
          <button 
            onClick={toggleSelectAll}
            className="px-2.5 py-1 bg-slate-100 font-extrabold text-[10px] text-slate-650 rounded-md hover:bg-slate-200 transition-all shadow-sm cursor-pointer"
          >
            {selectedIds.size === filteredHandovers.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Recipient list card block */}
      {filteredHandovers.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="bg-slate-50 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
            <Filter size={18} />
          </div>
          <p className="text-slate-400 font-bold text-xs">No records found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
          {filteredHandovers.map((handover) => {
            const isExpanded = !isCollapsedMode || expandedIds.has(handover.id);
            return (
              <div 
                key={handover.id}
                className={cn(
                  "bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all relative overflow-hidden group/card",
                  isCollapsedMode ? "cursor-pointer hover:border-blue-200" : "",
                  isExpanded ? "border-slate-200 shadow-sm" : "border-slate-100 shadow-sm"
                )}
                onClick={() => isCollapsedMode && toggleExpand(handover.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.has(handover.id)}
                        onChange={() => toggleSelect(handover.id)}
                        className="rounded border-slate-305 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-900 font-extrabold text-[13px] md:text-sm line-clamp-1">{handover.name}</span>
                        {isCollapsedMode && (
                          <span className="text-[8px] text-slate-400 font-black bg-slate-50 px-1 py-0.5 rounded transition-colors uppercase shrink-0">
                            {expandedIds.has(handover.id) ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-slate-400 text-[9px] font-bold uppercase tracking-wider leading-none">
                        <span className="flex items-center gap-1"><Calendar size={10} /> <span className="font-sans">{format(new Date(handover.date), 'dd MMM')}</span></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right leading-none shrink-0 whitespace-nowrap">
                    <p className="text-xs md:text-sm font-black text-slate-900">₹{handover.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[8px] text-slate-400 font-black tracking-wider mt-0.5">AMOUNT</p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-2.5 animate-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                    {handover.description && (
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Description</p>
                        <p className="text-slate-700 text-xs font-semibold mt-0.5">{handover.description}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100 font-sans">
                      <button 
                        disabled={permissions?.canEdit === false}
                        onClick={() => permissions?.canEdit !== false && handleEdit(handover)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md font-bold text-[10px] transition-all",
                          permissions?.canEdit === false
                            ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-55"
                            : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 cursor-pointer"
                        )}
                      >
                        <Edit2 size={10} />
                        <span>Edit</span>
                      </button>
                      <button 
                        disabled={permissions?.canDelete === false}
                        onClick={() => permissions?.canDelete !== false && setDeleteIds([handover.id])}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md font-bold text-[10px] transition-all",
                          permissions?.canDelete === false
                            ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-55"
                            : "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 cursor-pointer"
                        )}
                      >
                        <Trash2 size={10} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={() => {
          onDeleteHandover(deleteIds);
          setSelectedIds(new Set([...selectedIds].filter(id => !deleteIds.includes(id))));
          setDeleteIds([]);
        }}
        title="Delete Record"
        message={deleteIds.length > 1 
          ? `Are you sure you want to delete ${deleteIds.length} records? This action cannot be undone.`
          : "Are you sure you want to delete this record? This action cannot be undone."
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default SecretaryHandoverManagement;
