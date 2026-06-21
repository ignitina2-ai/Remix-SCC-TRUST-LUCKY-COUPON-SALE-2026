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
  Printer,
  Upload,
  AlertCircle,
  Check
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
  onAddTransaction?: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void;
  customPaymentLabels?: Record<PaymentMethod, string>;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canShareReport?: boolean;
    hideIncomeExpense?: boolean;
    hideSecretaryHandover?: boolean;
  };
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  onDelete, 
  onToggleTreasurer,
  onEdit,
  onAddTransaction,
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

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<Omit<Transaction, 'id'>[]>([]);
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const downloadSampleTemplate = () => {
    const headers = [
      'Date',
      'Sponsor / Buyer',
      'Mobile',
      'Location',
      'Books',
      'Coupons',
      'Book No',
      'Coupon No',
      'Amount',
      'Payment Method',
      'Treasurer'
    ];
    const sampleRow = [
      format(new Date(), 'dd.MM.yyyy'),
      'Mathew Joseph',
      '9876543210',
      'Kadavanthra',
      '1',
      '0',
      'B-108',
      '',
      '2500',
      'CASH',
      'NO'
    ];
    const sampleRow2 = [
      format(new Date(), 'dd.MM.yyyy'),
      'Anjali Nair',
      '9447123456',
      'Vyttila',
      '0',
      '5',
      '',
      '1520-1524',
      '500',
      'CREDIT',
      'NO'
    ];
    const csvContent = Papa.unparse({
      fields: headers,
      data: [sampleRow, sampleRow2]
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'scc_trust_transactions_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mapHeadersAndParse = (row: Record<string, any>, index: number): Omit<Transaction, 'id'> | null => {
    // Normalize row keys (lowercase, trim, remove spaces/underscores)
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const normKey = key.toLowerCase().replace(/[\s\-_]/g, '');
      normalizedRow[normKey] = row[key];
    }

    // Find Name field
    const name = normalizedRow['name'] || normalizedRow['sponsors/buyer'] || normalizedRow['buyer'] || normalizedRow['sponsor'] || normalizedRow['sponsor/buyer'] || row['Sponsor / Buyer'] || row['Name'] || '';
    if (!name || String(name).trim() === '') {
      return null; // Skip invalid row (missing name)
    }

    // Date
    let dateVal = normalizedRow['date'] || normalizedRow['datetime'] || row['Date'] || '';
    let dateStr = '';
    if (dateVal) {
      const rawStr = String(dateVal).trim();
      const dotDmyMatch = rawStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      const slashDmyMatch = rawStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dotDmyMatch) {
        const [_, d, m, y] = dotDmyMatch;
        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (slashDmyMatch) {
        const [_, d, m, y] = slashDmyMatch;
        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        try {
          const parsedDate = new Date(rawStr);
          if (!isNaN(parsedDate.getTime())) {
            dateStr = parsedDate.toISOString().split('T')[0];
          }
        } catch (e) {
          // ignore parsing error, will fall back
        }
      }
    }
    if (!dateStr) {
      dateStr = format(new Date(), 'yyyy-MM-dd');
    }

    // Location/Area
    const area = normalizedRow['area'] || normalizedRow['location'] || normalizedRow['place'] || row['Location'] || row['Area'] || 'N/A';

    // Mobile/Phone
    const phone = normalizedRow['phone'] || normalizedRow['mobile'] || normalizedRow['mobilenumber'] || normalizedRow['phonenumber'] || row['Mobile'] || row['Phone'] || '';

    // Books / Coupons
    const books = parseInt(normalizedRow['books'] || normalizedRow['bookscount'] || row['Books'] || '0', 10) || 0;
    const coupons = parseInt(normalizedRow['coupons'] || normalizedRow['couponscount'] || row['Coupons'] || '0', 10) || 0;

    // Book & Coupon numbers
    const bookNumber = normalizedRow['booknumber'] || normalizedRow['bookno'] || normalizedRow['book_number'] || row['Book No'] || row['BookNumber'] || '';
    const couponNumber = normalizedRow['couponnumber'] || normalizedRow['couponno'] || normalizedRow['coupon_number'] || row['Coupon No'] || row['CouponNumber'] || '';

    // Payment Method
    let paymentMethod = String(normalizedRow['paymentmethod'] || normalizedRow['payment_method'] || normalizedRow['method'] || row['Payment Method'] || row['PaymentMethod'] || 'CASH').toUpperCase().trim();
    if (paymentMethod.includes('CASH')) {
      paymentMethod = 'CASH';
    } else if (paymentMethod.includes('CREDIT')) {
      paymentMethod = 'CREDIT';
    } else if (paymentMethod.includes('SOFIA')) {
      paymentMethod = 'SOFIA GPAY';
    } else if (paymentMethod.includes('JOHNY')) {
      paymentMethod = 'JOHNY GPAY';
    } else if (paymentMethod.includes('TRUST')) {
      paymentMethod = 'TRUST GPAY';
    } else if (paymentMethod.includes('GPAY') || paymentMethod.includes('UPI')) {
      paymentMethod = 'OTHER_UPI';
    } else {
      paymentMethod = 'CASH';
    }

    // PaidToTreasurer
    const paidToTrStr = String(normalizedRow['paidtotreasurer'] || normalizedRow['paid_to_treasurer'] || normalizedRow['treasurer'] || normalizedRow['handedover'] || row['Treasurer'] || row['PaidToTreasurer'] || 'NO').toUpperCase().trim();
    const paidToTreasurer = ['YES', 'TRUE', '1', 'PAID'].includes(paidToTrStr);

    // Total Amount
    let totalAmount = parseInt(normalizedRow['totalamount'] || normalizedRow['amount'] || normalizedRow['value'] || row['Amount'] || row['TotalAmount'] || '', 10);
    if (isNaN(totalAmount)) {
      totalAmount = (books * 25 + coupons) * 100;
    }

    // Paid, Credit calculation
    let paidAmount = parseInt(normalizedRow['paidamount'] || normalizedRow['paid'] || row['PaidAmount'] || '', 10);
    let creditAmount = parseInt(normalizedRow['creditamount'] || normalizedRow['credit'] || normalizedRow['balance'] || row['CreditAmount'] || '', 10);

    if (paymentMethod === 'CREDIT') {
      if (isNaN(paidAmount)) paidAmount = 0;
      if (isNaN(creditAmount)) creditAmount = totalAmount - paidAmount;
    } else {
      if (isNaN(paidAmount)) paidAmount = totalAmount;
      if (isNaN(creditAmount)) creditAmount = 0;
    }

    return {
      date: dateStr,
      name: String(name).trim(),
      phone: String(phone).trim() ? String(phone).trim() : undefined,
      area: String(area).trim(),
      books,
      coupons,
      bookNumber: String(bookNumber).trim() ? String(bookNumber).trim() : undefined,
      couponNumber: String(couponNumber).trim() ? String(couponNumber).trim() : undefined,
      totalAmount,
      paidAmount,
      creditAmount,
      paymentMethod,
      paidToTreasurer,
      paymentHistory: paymentMethod === 'CREDIT' ? [] : [{
        id: Math.random().toString(36).substr(2, 9),
        amount: paidAmount,
        date: dateStr,
        paymentMethod
      }]
    };
  };

  const handleCSVFile = (file: File) => {
    if (!file) return;
    setImportFile(file);
    setParsingErrors([]);
    setParsedTransactions([]);
    setSuccessMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedList: Omit<Transaction, 'id'>[] = [];
        const errorsList: string[] = [];

        results.data.forEach((row: any, i: number) => {
          const parsed = mapHeadersAndParse(row, i);
          if (parsed) {
            parsedList.push(parsed);
          } else {
            const nameCandidate = row['Sponsor / Buyer'] || row['Name'] || row['buyer'] || '';
            if (!nameCandidate || String(nameCandidate).trim() === '') {
              errorsList.push(`Row ${i + 1}: Skipped row due to empty or missing Name.`);
            } else {
              errorsList.push(`Row ${i + 1}: Failed to parse Row.`);
            }
          }
        });

        setParsedTransactions(parsedList);
        setParsingErrors(errorsList);
      },
      error: (err) => {
        setParsingErrors([`Failed to read file: ${err.message}`]);
      }
    });
  };

  const executeImport = async () => {
    if (!onAddTransaction || parsedTransactions.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    let progressCount = 0;
    const total = parsedTransactions.length;

    for (const txn of parsedTransactions) {
      try {
        await onAddTransaction(txn);
      } catch (e) {
        console.error('Failed to import transaction', txn, e);
      }
      progressCount++;
      setImportProgress(Math.round((progressCount / total) * 100));
    }

    setIsImporting(false);
    setSuccessMessage(`Successfully imported ${total} transactions!`);
    setParsedTransactions([]);
    setImportFile(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        handleCSVFile(file);
      } else {
        setParsingErrors(['Please drop a valid .csv files only.']);
      }
    }
  };

  const resetImportState = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setParsedTransactions([]);
    setParsingErrors([]);
    setSuccessMessage(null);
    setImportProgress(0);
    setIsImporting(false);
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
    doc.rect(14, 10, 4, 18, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('ST. CASIMIR CHARITABLE TRUST', 22, 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text('SCC TRUST LUCKY COUPON SALE 2026', 22, 19);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`COUPON SALES TRANSACTION HISTORY  |  Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: ${filteredTransactions.length} Record${filteredTransactions.length === 1 ? '' : 's'}`, 22, 24);

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    // 2. Draw 4 modern horizontal metric summary cards
    const cardWidth = 42.5;
    const cardHeight = 20;
    const cardGap = 4;
    const startY = 34;

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
          t.phone || '-',
          t.area && t.area !== 'N/A' ? t.area : '-',
          t.books.toString(),
          t.coupons.toString(),
          t.bookNumber || '-',
          t.couponNumber || '-',
          `Rs. ${t.totalAmount.toLocaleString('en-IN')}`,
          methodLabel,
          t.paidToTreasurer ? 'PAID' : 'PENDING'
        ];
      }),
      [
        'TOTAL SUMMARY',
        '',
        '',
        '',
        totalBooksSum.toString(),
        totalCouponsSum.toString(),
        '',
        '',
        `Rs. ${totalAmountSum.toLocaleString('en-IN')}`,
        '',
        `Paid: ${paidTreasurerCount}`
      ]
    ];

    autoTable(doc, {
      head: [['Date', 'Sponsor / Buyer', 'Mobile', 'Location', 'Books', 'Coupons', 'Book No', 'Coupon No', 'Amount', 'Payment Method', 'Treasurer']],
      body: tableData,
      startY: startY + cardHeight + 8,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 30, bottom: 25 },
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontSize: 7.0,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' }, // Date
        1: { cellWidth: 24, fontStyle: 'bold' }, // Buyer / Name
        2: { cellWidth: 18, halign: 'center' }, // Mobile (phone)
        3: { cellWidth: 18 }, // Location
        4: { cellWidth: 10, halign: 'center' }, // Books
        5: { cellWidth: 10, halign: 'center' }, // Coupons
        6: { cellWidth: 12, halign: 'center' }, // Book No
        7: { cellWidth: 15, halign: 'center' }, // Coupon No
        8: { cellWidth: 18, halign: 'right' }, // Amount
        9: { cellWidth: 22, halign: 'left' }, // Payment Method
        10: { cellWidth: 20, halign: 'center' }, // Treasurer
      }, // Sum of column widths = 15 + 24 + 18 + 18 + 10 + 10 + 12 + 15 + 18 + 22 + 20 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
      styles: {
        fontSize: 6.8,
        cellPadding: 2.0,
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
          data.cell.styles.fontSize = 7.4;
        }

        if (data.section === 'body' && !isLastRow) {
          // Highlight Treasurer status cell
          if (data.column.index === 10) {
            const trStatus = data.row.raw[10];
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
          if (data.column.index === 8) {
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
      Mobile: t.phone || '',
      Area: t.area,
      Books: t.books,
      Coupons: t.coupons,
      BookNumber: t.bookNumber || '',
      CouponNumber: t.couponNumber || '',
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
      case 'CASH': return <Wallet size={16} className="text-green-600 shrink-0" />;
      case 'CREDIT': return <CreditCard size={16} className="text-red-600 shrink-0" />;
      case 'TRUST GPAY': return <Smartphone size={16} className="text-blue-600 shrink-0" />;
      case 'SOFIA GPAY': return <Smartphone size={16} className="text-orange-500 shrink-0" />;
      case 'JOHNY GPAY': return <Smartphone size={16} className="text-violet-600 shrink-0" />;
      default: return <Smartphone size={16} className="text-slate-500 shrink-0" />;
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
          {selectedIds.size > 0 && permissions?.canDelete !== false && (
            <button 
              disabled={permissions?.canDelete === false}
              onClick={() => permissions?.canDelete !== false && setDeleteIds(Array.from(selectedIds))}
              className="px-2.5 py-1.5 border border-rose-250 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg md:rounded-xl transition-all font-bold text-[10px] md:text-xs flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Trash2 size={14} className="md:w-4 md:h-4" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
          {permissions?.canAdd !== false && onAddTransaction && (
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 font-bold rounded-lg md:rounded-xl transition-all shadow-sm text-[10px] md:text-xs cursor-pointer animate-pulse"
              title="Import CSV"
            >
              <Upload size={14} className="md:w-4 md:h-4" />
              <span>Import</span>
            </button>
          )}
          <button 
            onClick={exportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-[10px] md:text-xs cursor-pointer"
            title="Export CSV"
          >
            <TableIcon size={14} className="text-emerald-600 md:w-4 md:h-4" />
            CSV
          </button>
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
                  {permissions?.canDelete !== false && (
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </div>
                  )}
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
                  {t.phone && (
                    <div className="bg-slate-50 px-1.5 py-0.5 rounded-md text-slate-600">
                      Mobile: <span className="text-slate-900 font-bold">{t.phone}</span>
                    </div>
                  )}
                  {t.couponNumber && (
                    <div className="bg-slate-50 px-1.5 py-0.5 rounded-md text-slate-600">
                      Coupon No: <span className="text-slate-900 font-bold">{t.couponNumber}</span>
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
                      disabled={permissions?.canShareReport === false}
                      onClick={() => {
                        if (permissions?.canShareReport !== false) {
                          const paymentLabel = customPaymentLabels?.[t.paymentMethod] || DEFAULT_PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod;
                          shareTransactionReceiptCard(t, paymentLabel);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold text-[9px] md:text-[10px] transition-all",
                        permissions?.canShareReport === false
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                          : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                      )}
                      title={permissions?.canShareReport === false ? "Restricted from sharing receipt cards" : "Share Receipt Card"}
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
                    {permissions?.canDelete !== false && (
                      <button 
                        disabled={permissions?.canDelete === false}
                        onClick={() => permissions?.canDelete !== false && setDeleteIds([t.id])}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold text-[9px] md:text-[10px] transition-all bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100/50 cursor-pointer"
                      >
                        <Trash2 size={10} />
                        Delete
                      </button>
                    )}
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

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">Import Transactions from CSV</h3>
                <p className="text-slate-500 text-xs mt-0.5 font-semibold">Add multiple transactions securely into the registry</p>
              </div>
              <button 
                onClick={resetImportState}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                disabled={isImporting}
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Success Message Banner */}
              {successMessage ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-4 rounded-2xl flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Import Completed Successfully</h4>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">{successMessage}</p>
                    <button
                      onClick={resetImportState}
                      className="mt-3 px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-all select-none cursor-pointer"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Instructions and download template */}
                  <div className="bg-blue-50/50 border border-blue-150/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-blue-900 flex items-center gap-1">
                        <AlertCircle size={14} className="text-blue-500 shrink-0" />
                        CSV Layout and Format Rules
                      </h4>
                      <p className="text-blue-750 text-[11px] font-semibold leading-relaxed max-w-md">
                        Ensure columns like <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800 font-mono text-[10px]">Date</code>, <code className="bg-blue-150/30 px-1 py-0.5 rounded text-blue-800 font-mono text-[10px]">Sponsor / Buyer</code>, and <code className="bg-blue-150/30 px-1 py-0.5 rounded text-blue-800 font-mono text-[10px]">Amount</code> are mapped appropriately. Missing amounts will be automatically calculated.
                      </p>
                    </div>
                    <button
                      onClick={downloadSampleTemplate}
                      className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 font-semibold text-[11px] rounded-xl hover:bg-blue-50 transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      Get Sample CSV
                    </button>
                  </div>

                  {/* Drag and Drop Zone */}
                  {!importFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] select-none",
                        isDragging 
                          ? "border-blue-500 bg-blue-50" 
                          : "border-slate-250 bg-slate-50 hover:bg-slate-100 hover:border-slate-350"
                      )}
                      onClick={() => document.getElementById('csvFileInput')?.click()}
                    >
                      <input 
                        type="file"
                        id="csvFileInput"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleCSVFile(e.target.files[0]);
                          }
                        }}
                      />
                      <Upload size={32} className={cn("mb-2 text-slate-400", isDragging && "text-blue-500 animate-bounce")} />
                      <p className="font-bold text-sm text-slate-800">Drag and drop your CSV file here</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-semibold">or click to browse from computer</p>
                    </div>
                  ) : (
                    /* Selected File Status */
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                          <TableIcon size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 truncate">{importFile.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">{(importFile.size / 1024).toFixed(1)} KB • {parsedTransactions.length} records parsed</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setImportFile(null);
                          setParsedTransactions([]);
                          setParsingErrors([]);
                        }}
                        disabled={isImporting}
                        className="px-2.5 py-1 text-rose-600 bg-rose-50 border border-rose-100 font-bold text-xs rounded-lg hover:bg-rose-100 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Errors & Skip Warnings */}
                  {parsingErrors.length > 0 && (
                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3.5 space-y-1.5">
                      <h5 className="font-bold text-[11px] text-rose-800 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Import Parsing Notifications ({parsingErrors.length})
                      </h5>
                      <ul className="text-[10px] text-rose-700 space-y-0.5 list-disc pl-4 font-bold max-h-[80px] overflow-y-auto">
                        {parsingErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Columns Preview Card */}
                  {parsedTransactions.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-xs text-slate-900 px-0.5">Preview of Parsed Transactions (Up to 5 rows)</h4>
                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] text-slate-600 min-w-[500px]">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                              <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Location</th>
                                <th className="px-3 py-2">Books/Coupons</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                                <th className="px-3 py-2">Method</th>
                                <th className="px-3 py-2">Treasurer</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold bg-white">
                              {parsedTransactions.slice(0, 5).map((row, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                  <td className="px-3 py-2 font-black text-slate-900 truncate max-w-[120px]">{row.name}</td>
                                  <td className="px-3 py-2">{row.area}</td>
                                  <td className="px-3 py-2">{row.books}B / {row.coupons}C</td>
                                  <td className="px-3 py-2 text-right font-black text-slate-800">₹{row.totalAmount.toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2">{row.paymentMethod}</td>
                                  <td className="px-3 py-2 text-[9px] font-black">
                                    <span className={cn(
                                      "px-1 py-0.5 rounded",
                                      row.paidToTreasurer ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                      {row.paidToTreasurer ? "Paid" : "Pending"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {parsedTransactions.length > 5 && (
                          <div className="bg-slate-50 px-3 py-1 text-center text-[9px] text-slate-400 font-extrabold border-t border-slate-150">
                            And {parsedTransactions.length - 5} more records...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Import Live Progress Spinner */}
                  {isImporting && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                          Importing transactions to safe cloud registry...
                        </span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full transition-all duration-200" 
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Buttons */}
            {!successMessage && (
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 shrink-0 justify-end">
                <button
                  onClick={resetImportState}
                  disabled={isImporting}
                  className="px-4 py-2 border border-slate-200 bg-white text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={parsedTransactions.length === 0 || isImporting}
                  onClick={executeImport}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all flex items-center gap-1 hover:shadow-lg hover:shadow-blue-200 active:scale-95 border border-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  {isImporting ? "Importing..." : `Import ${parsedTransactions.length} Records`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
