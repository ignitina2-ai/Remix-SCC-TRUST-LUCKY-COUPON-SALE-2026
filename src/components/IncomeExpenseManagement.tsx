import React, { useState } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Edit2,
  Calendar, 
  Tag, 
  IndianRupee,
  Search,
  Filter,
  CheckCircle2,
  Save,
  FileText,
  Download,
  Eye,
  EyeOff,
  Loader2,
  X,
  Upload
} from 'lucide-react';
import { IncomeExpense, EntryType } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import ConfirmationModal from './ConfirmationModal';
import { auth } from '@/lib/firebase';
import { uploadFile, deleteFileFromStorage } from '@/lib/storage';

interface IncomeExpenseManagementProps {
  entries: IncomeExpense[];
  onAddEntry: (entry: Omit<IncomeExpense, 'id'>) => void;
  onUpdateEntry?: (id: string, updates: Partial<IncomeExpense>) => void;
  onDeleteEntry: (ids: string[]) => void;
}

const IncomeExpenseManagement: React.FC<IncomeExpenseManagementProps> = ({ 
  entries = [], 
  onAddEntry, 
  onUpdateEntry,
  onDeleteEntry 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | EntryType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const getTodayISTStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  };

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'EXPENSE' as EntryType,
    category: '',
    date: getTodayISTStr(),
    receiptUrl: '',
    receiptName: ''
  });
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReceipt(true);
    try {
      if (auth.currentUser) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniquePath = `receipts/receipt_${Date.now()}_${safeName}`;
        const downloadUrl = await uploadFile(file, uniquePath);
        setFormData(prev => ({
          ...prev,
          receiptUrl: downloadUrl,
          receiptName: file.name
        }));
      } else {
        // Local base64 mode
        if (file.size > 512 * 1024) {
          alert("Offline preview limit: 512KB. Connect cloud server to lift constraints.");
          setIsUploadingReceipt(false);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({
            ...prev,
            receiptUrl: reader.result as string,
            receiptName: file.name
          }));
          setIsUploadingReceipt(false);
        };
        reader.readAsDataURL(file);
        return; // Avoid executing finally block synchronously
      }
    } catch (err) {
      console.error("Receipt upload failed:", err);
      alert("Billing storage failed.");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleDeleteReceipt = async () => {
    if (formData.receiptUrl && formData.receiptUrl.startsWith('http')) {
      try {
        await deleteFileFromStorage(formData.receiptUrl);
      } catch (err) {
        console.warn("Could not delete receipt from cloud storage:", err);
      }
    }
    setFormData(prev => ({
      ...prev,
      receiptUrl: '',
      receiptName: ''
    }));
  };
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

  const totalIncome = (entries || [])
    .filter(e => e.type === 'INCOME')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpense = (entries || [])
    .filter(e => e.type === 'EXPENSE')
    .reduce((acc, e) => acc + e.amount, 0);

  const balance = totalIncome - totalExpense;

  const categories = Array.from(new Set((entries || []).map(e => e.category).filter(Boolean)));

  const handleEdit = (entry: IncomeExpense) => {
    setFormData({
      description: entry.description,
      amount: entry.amount.toString(),
      type: entry.type,
      category: entry.category || '',
      date: entry.date.split('T')[0],
      receiptUrl: entry.receiptUrl || '',
      receiptName: entry.receiptName || ''
    });
    setEditingId(entry.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredEntries = (entries || [])
    .filter(e => {
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.category?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'ALL' || e.type === filterType;
      
      const entryDate = new Date(e.date).getTime();
      const matchesStartDate = !startDate || entryDate >= new Date(startDate).getTime();
      const matchesEndDate = !endDate || entryDate <= new Date(endDate).getTime() + 86400000; // Include full day
      
      const matchesCategory = filterCategory === 'ALL' || e.category === filterCategory;

      return matchesSearch && matchesType && matchesStartDate && matchesEndDate && matchesCategory;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    if (editingId && onUpdateEntry) {
       onUpdateEntry(editingId, {
        description: formData.description,
        amount: Number(formData.amount),
        type: formData.type,
        category: formData.category,
        date: new Date(formData.date).toISOString(),
        receiptUrl: formData.receiptUrl || undefined,
        receiptName: formData.receiptName || undefined
      });
      setEditingId(null);
    } else {
      onAddEntry({
        description: formData.description,
        amount: Number(formData.amount),
        type: formData.type,
        category: formData.category,
        date: new Date(formData.date).toISOString(),
        receiptUrl: formData.receiptUrl || undefined,
        receiptName: formData.receiptName || undefined
      });
    }

    setFormData({
      description: '',
      amount: '',
      type: 'EXPENSE',
      category: '',
      date: getTodayISTStr(),
      receiptUrl: '',
      receiptName: ''
    });
    setShowForm(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
    
    const totalIncome = filteredEntries.filter(e => e.type === 'INCOME').reduce((acc, e) => acc + e.amount, 0);
    const totalExpense = filteredEntries.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
    const netAmount = totalIncome - totalExpense;
    const ledgerCount = filteredEntries.length;

    // 1. Draw top branding & registry title banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 4, 14, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('INCOME & EXPENDITURE CASH LEDGER', 22, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: All Logged Cash Accounts (${ledgerCount} Record${ledgerCount === 1 ? '' : 's'})`, 22, 22);

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

    // Card 1: Total Earnings / Inflow
    drawSummaryCard(
      14, 
      startY, 
      cardWidth, 
      cardHeight, 
      [230, 244, 234], // light green (#e6f4ea)
      [52, 211, 153], 
      "TOTAL INCOME INFLOW", 
      `₹${totalIncome.toLocaleString('en-IN')}`, 
      [4, 120, 87], 
      [6, 95, 70]
    );

    // Card 2: Total spending / Outflow
    drawSummaryCard(
      14 + (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [252, 232, 230], // light red (#fce8e6)
      [252, 165, 165], 
      "TOTAL EXPENDITURES", 
      `₹${totalExpense.toLocaleString('en-IN')}`, 
      [185, 28, 28], 
      [153, 27, 27]
    );

    // Card 3: Net Cash Balance
    drawSummaryCard(
      14 + 2 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      netAmount >= 0 ? [234, 244, 255] : [254, 243, 199], // blue vs amber
      netAmount >= 0 ? [147, 197, 253] : [252, 211, 77], 
      "NET SURPLUS POSITION", 
      `₹${netAmount.toLocaleString('en-IN')}`, 
      netAmount >= 0 ? [29, 78, 216] : [180, 83, 9], 
      netAmount >= 0 ? [30, 58, 138] : [146, 64, 14]
    );

    // Card 4: Ledger volume counts
    drawSummaryCard(
      14 + 3 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [248, 250, 252], // slate-50
      [203, 213, 225], 
      "TOTAL LEDGER ITEMS", 
      `${ledgerCount} Entry`, 
      [100, 116, 139], 
      [15, 23, 42]
    );

    // 3. Prepare table rows
    const tableData = [
      ...filteredEntries.map(e => [
        format(new Date(e.date), 'dd/MM/yyyy'),
        e.description,
        e.category || '-',
        e.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        `Rs. ${e.amount.toLocaleString('en-IN')}`
      ]),
      [
        'TOTAL SUMMARY',
        `Total Incomes: Rs. ${totalIncome.toLocaleString('en-IN')}  |  Total Expenses: Rs. ${totalExpense.toLocaleString('en-IN')}`,
        '',
        '',
        `Net Balance: Rs. ${netAmount.toLocaleString('en-IN')}`
      ]
    ];

    autoTable(doc, {
      head: [['Date', 'Description / Transaction Particulars', 'Category', 'Flow Type', 'Amount']],
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
        0: { cellWidth: 22, halign: 'center' }, // Date
        1: { cellWidth: 65, fontStyle: 'bold' }, // Description
        2: { cellWidth: 35 }, // Category
        3: { cellWidth: 25, halign: 'center' }, // Type (INCOME / EXPENSE)
        4: { cellWidth: 35, halign: 'right' }, // Amount
      }, // Sum of column widths = 22 + 65 + 35 + 25 + 35 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
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
          // Color flow types nicely
          if (data.column.index === 3) {
            const flowType = data.row.raw[3];
            if (flowType === 'INCOME') {
              data.cell.styles.fillColor = [230, 244, 234]; // green
              data.cell.styles.textColor = [16, 124, 65]; 
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [252, 232, 230]; // red
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Make amount columns clear & premium
          if (data.column.index === 4) {
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
        
        doc.text(`Official Income & Expenditure Ledger Statement • 2026`, 14, 283);
        
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(pageText, 196 - doc.getTextWidth(pageText), 283);
      }
    });

    doc.save(`income_expense_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  };

  const exportCSV = () => {
    const csvData = filteredEntries.map(e => ({
      Date: format(new Date(e.date), 'dd/MM/yyyy'),
      Description: e.description,
      Category: e.category || '',
      Type: e.type,
      Amount: e.amount
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `income_expense_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length && filteredEntries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Income & Expense</h1>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">Manage your daily cash flow</p>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedIds.size > 0 && (
            <button 
              onClick={() => setDeleteIds(Array.from(selectedIds))}
              className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg md:rounded-xl hover:bg-rose-100 transition-all font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
          <button 
            onClick={exportPDF}
            className="p-2 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Export PDF"
          >
            <FileText size={14} />
          </button>
          <button 
            onClick={exportCSV}
            className="p-2 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Export CSV"
          >
            <Download size={14} />
          </button>
          <button 
            onClick={() => setShowForm(!showForm)}
            className={cn(
              "px-3 py-1.5 rounded-lg md:rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 font-bold text-xs cursor-pointer",
              showForm ? "bg-slate-150 text-slate-600 border border-slate-200" : "bg-blue-600 text-white shadow-blue-600/10"
            )}
          >
            {showForm ? <Minus size={14} /> : <Plus size={14} />}
            <span>{showForm ? "Cancel" : "Add Entry"}</span>
          </button>
        </div>
      </header>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300">
          <CheckCircle2 size={16} />
          <span className="font-bold text-xs">Entry added successfully!</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
        <div className="bg-emerald-500 p-3.5 md:p-5 rounded-xl md:rounded-2xl text-white shadow-md shadow-emerald-500/10">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp size={20} className="text-emerald-100" />
            <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-600/30 px-1.5 py-0.5 rounded">Income</span>
          </div>
          <h2 className="text-lg md:text-2xl font-black">₹{totalIncome.toLocaleString('en-IN')}</h2>
          <p className="text-emerald-100 text-[8px] font-bold uppercase tracking-wider mt-0.5">Total Earnings</p>
        </div>

        <div className="bg-rose-500 p-3.5 md:p-5 rounded-xl md:rounded-2xl text-white shadow-md shadow-rose-500/10">
          <div className="flex items-center justify-between mb-1">
            <TrendingDown size={20} className="text-rose-100" />
            <span className="text-[8px] font-black uppercase tracking-widest bg-rose-600/30 px-1.5 py-0.5 rounded">Expense</span>
          </div>
          <h2 className="text-lg md:text-2xl font-black">₹{totalExpense.toLocaleString('en-IN')}</h2>
          <p className="text-rose-100 text-[8px] font-bold uppercase tracking-wider mt-0.5">Total Spending</p>
        </div>

        <div className={cn(
          "p-3.5 md:p-5 rounded-xl md:rounded-2xl text-white shadow-md",
          balance >= 0 ? "bg-blue-600 shadow-blue-600/10" : "bg-slate-800 shadow-slate-800/10"
        )}>
          <div className="flex items-center justify-between mb-1">
            <IndianRupee size={20} className="text-white/50" />
            <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded">Balance</span>
          </div>
          <h2 className="text-lg md:text-2xl font-black">₹{balance.toLocaleString('en-IN')}</h2>
          <p className="text-white/50 text-[8px] font-bold uppercase tracking-wider mt-0.5 font-sans">Net Cash Flow</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-lg animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Type</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-bold text-xs transition-all border-2 cursor-pointer",
                      formData.type === 'INCOME' 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                        : "bg-white border-slate-100 text-slate-400"
                    )}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-bold text-xs transition-all border-2 cursor-pointer",
                      formData.type === 'EXPENSE' 
                        ? "bg-rose-50 border-rose-500 text-rose-700" 
                        : "bg-white border-slate-100 text-slate-400"
                    )}
                  >
                    Expense
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</div>
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
                  placeholder="e.g., Office Rent, Sales Commission"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Category (Optional)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                    placeholder="e.g., Rent, Salary, Sale"
                  />
                </div>
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

            {/* Receipt Attachment Section */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">Receipt / Attachment (Optional)</span>
                <p className="text-slate-450 text-[10px] font-medium leading-relaxed">
                  Securely upload bill invoice, cash proof, or digital receipt onto the Cloud.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {isUploadingReceipt ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50/50 px-3 py-2 rounded-xl">
                    <Loader2 size={13} className="animate-spin" />
                    <span className="text-[10px]">Cloud Uploading...</span>
                  </div>
                ) : formData.receiptUrl ? (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100/60 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                    <span className="max-w-[130px] truncate text-[11px] font-black">{formData.receiptName || 'receipt.pdf'}</span>
                    <button 
                      type="button"
                      onClick={handleDeleteReceipt}
                      className="text-rose-500 hover:text-rose-700 transition cursor-pointer"
                      title="Remove attachment"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="file"
                      id="receipt-file-input"
                      onChange={handleReceiptUpload}
                      className="hidden"
                      accept="image/*,application/pdf"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('receipt-file-input')?.click()}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Upload size={12} />
                      <span>Upload Receipt</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-md shadow-blue-600/15 transition-all active:scale-95 text-xs cursor-pointer"
            >
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs shadow-sm"
            />
          </div>
          <div className="flex gap-1">
            {(['ALL', 'INCOME', 'EXPENSE'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-extrabold transition-all border cursor-pointer",
                  filterType === type 
                    ? "bg-slate-900 border-slate-900 text-white" 
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] md:text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Start Date"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] md:text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="End Date"
            />
          </div>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] md:text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {filteredEntries.length > 0 && (
          <button 
            onClick={toggleSelectAll}
            className="px-2 py-1 bg-slate-100 font-extrabold text-[10px] text-slate-650 rounded-md hover:bg-slate-200 transition-all shadow-sm cursor-pointer"
          >
            {selectedIds.size === filteredEntries.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Entries List */}
      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="bg-slate-50 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
              <Filter size={18} />
            </div>
            <p className="text-slate-400 font-bold text-xs">No entries found</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = !isCollapsedMode || expandedIds.has(entry.id);
            return (
              <div 
                key={entry.id}
                className={cn(
                  "bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all relative overflow-hidden group/card",
                  isCollapsedMode ? "cursor-pointer hover:border-blue-200" : "",
                  isExpanded ? "border-slate-200 shadow-sm" : "border-slate-100 shadow-sm"
                )}
                onClick={() => isCollapsedMode && toggleExpand(entry.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        className="rounded border-slate-305 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "p-1.5 rounded-lg text-white shrink-0",
                        entry.type === 'INCOME' ? "bg-emerald-500" : "bg-rose-500"
                      )}>
                        {entry.type === 'INCOME' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900 font-extrabold text-[13px] md:text-sm line-clamp-1">{entry.description}</span>
                          {isCollapsedMode && (
                            <span className="text-[8px] text-slate-400 font-black bg-slate-50 px-1 py-0.5 rounded transition-colors uppercase shrink-0">
                              {expandedIds.has(entry.id) ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 leading-none">
                          <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={10} /> <span className="font-sans">{format(new Date(entry.date), 'dd MMM')}</span>
                          </span>
                          {entry.category && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-sans uppercase">
                              <Tag size={6} /> {entry.category}
                            </span>
                          )}
                          {entry.receiptUrl && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-sans uppercase">
                              <FileText size={8} /> Attachment
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap leading-none">
                    <p className={cn(
                      "text-xs md:text-sm font-black",
                      entry.type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {entry.type === 'INCOME' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mt-0.5">
                      {entry.type}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-2.5 animate-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Type</span>
                        <p className={cn("font-extrabold text-[10px] mt-0.5", entry.type === 'INCOME' ? "text-emerald-700" : "text-rose-700")}>
                          {entry.type}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Category</span>
                        <p className="text-slate-700 font-extrabold text-[10px] mt-0.5">
                          {entry.category || 'Uncategorized'}
                        </p>
                      </div>
                    </div>

                    {entry.receiptUrl && (
                      <div className="bg-blue-50/40 p-2 rounded-lg flex items-center justify-between border border-blue-100/30">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText size={12} className="text-blue-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[150px] md:max-w-[200px]">
                            {entry.receiptName || 'Receipt Attachment'}
                          </span>
                        </div>
                        <a 
                          href={entry.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-blue-505 hover:text-blue-700 text-[10px] font-black shrink-0 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>View Receipt</span>
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                      <button 
                        onClick={() => handleEdit(entry)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-md font-bold text-[10px] hover:bg-blue-100 transition-all cursor-pointer shadow-sm"
                      >
                        <Edit2 size={10} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => setDeleteIds([entry.id])}
                        className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-md font-bold text-[10px] hover:bg-rose-100 transition-all cursor-pointer shadow-sm"
                      >
                        <Trash2 size={10} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={() => {
          onDeleteEntry(deleteIds);
          setSelectedIds(new Set([...selectedIds].filter(id => !deleteIds.includes(id))));
          setDeleteIds([]);
        }}
        title="Delete Entry"
        message={deleteIds.length > 1 
          ? `Are you sure you want to delete ${deleteIds.length} entries? This action cannot be undone.`
          : "Are you sure you want to delete this specific entry? This action cannot be undone."
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default IncomeExpenseManagement;
