import React, { useState } from 'react';
import { 
  Search, 
  Trophy, 
  User, 
  MapPin, 
  Gift, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Save, 
  X, 
  FileText,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  LayoutGrid,
  AlertCircle,
  Printer
} from 'lucide-react';
import { Sponsor } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmationModal from './ConfirmationModal';

interface SponsorsListProps {
  sponsors: Sponsor[];
  onAddSponsor: (sponsor: Omit<Sponsor, 'id'>) => void;
  onUpdateSponsor: (id: string, updates: Partial<Sponsor>) => void;
  onDeleteSponsor: (id: string) => void;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

const SponsorsList: React.FC<SponsorsListProps> = ({ 
  sponsors, 
  onAddSponsor, 
  onUpdateSponsor, 
  onDeleteSponsor,
  permissions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COLLECTED' | 'PENDING' | 'FLAGGED'>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Default view to 'table' layout as requested
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isCollapseMode, setIsCollapseMode] = useState<boolean>(true);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [newSponsor, setNewSponsor] = useState({
    name: '',
    area: '',
    prizeDescription: '',
    prizeNumber: '' as string | number,
    amount: 0,
    collectedAmount: 0,
    status: 'PENDING' as 'COLLECTED' | 'PENDING' | 'FLAGGED',
  });

  const filteredSponsors = (sponsors || [])
    .filter(s => 
      ((s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
       (s.area || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (s.prizeDescription || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (s.prizeNumber?.toString() || '').includes(searchTerm)) &&
      (statusFilter === 'ALL' || s.status === statusFilter)
    );

  const totalAmount = (sponsors || []).reduce((acc, s) => acc + (s.amount || 0), 0);
  const totalCollected = (sponsors || []).reduce((acc, s) => acc + (s.collectedAmount || 0), 0);
  const pendingAmount = totalAmount - totalCollected;
  const flaggedCount = (sponsors || []).filter(s => s.status === 'FLAGGED').length;
  const flaggedAmount = (sponsors || []).filter(s => s.status === 'FLAGGED').reduce((acc, s) => acc + (s.amount || 0), 0);

  const isDuplicatePrizeNumber = (pNum: number, currentId?: string) => {
    return (sponsors || []).some(s => s.prizeNumber === pNum && s.id !== currentId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSponsor.name || !newSponsor.prizeDescription) return;

    const pNum = newSponsor.prizeNumber ? Number(newSponsor.prizeNumber) : undefined;
    const finalStatus = newSponsor.status;

    // Check for duplicate prize number
    if (pNum !== undefined && !isNaN(pNum)) {
      if (isDuplicatePrizeNumber(pNum, editingSponsor?.id)) {
        setDuplicateError(`Prize Number ${pNum} is already assigned to another sponsor! Please choose a different number.`);
        return;
      }
    }

    setDuplicateError(null);

    if (editingSponsor) {
      onUpdateSponsor(editingSponsor.id, {
        name: newSponsor.name,
        area: newSponsor.area || 'N/A', // area is saved but removed from creation form inputs
        prizeDescription: newSponsor.prizeDescription,
        prizeNumber: pNum,
        amount: Number(newSponsor.amount),
        collectedAmount: Number(newSponsor.collectedAmount),
        status: finalStatus,
        collectedDate: Number(newSponsor.collectedAmount) > 0 ? new Date().toISOString() : undefined
      });
    } else {
      onAddSponsor({
        name: newSponsor.name,
        area: newSponsor.area || 'N/A', // area is saved but removed from creation form inputs
        prizeDescription: newSponsor.prizeDescription,
        prizeNumber: pNum,
        amount: Number(newSponsor.amount),
        collectedAmount: Number(newSponsor.collectedAmount),
        status: finalStatus,
        collectedDate: Number(newSponsor.collectedAmount) > 0 ? new Date().toISOString() : undefined
      });
    }

    setNewSponsor({ name: '', area: '', prizeDescription: '', prizeNumber: '', amount: 0, collectedAmount: 0, status: 'PENDING' });
    setIsAdding(false);
    setEditingSponsor(null);
  };

  const handleEdit = (sponsor: Sponsor) => {
    setDuplicateError(null);
    setEditingSponsor(sponsor);
    setNewSponsor({
      name: sponsor.name,
      area: sponsor.area || '',
      prizeDescription: sponsor.prizeDescription,
      prizeNumber: sponsor.prizeNumber || '',
      amount: sponsor.amount,
      collectedAmount: sponsor.collectedAmount || 0,
      status: sponsor.status || 'PENDING',
    });
    setIsAdding(true);
  };

  const handleAddNew = () => {
    setDuplicateError(null);
    setNewSponsor({
      name: '',
      area: '',
      prizeDescription: '',
      prizeNumber: '',
      amount: 0,
      collectedAmount: 0,
      status: 'PENDING'
    });
    setEditingSponsor(null);
    setIsAdding(true);
  };

  const exportPDF = () => {
    // Explicitly configure A4 size (210mm x 297mm)
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
    
    const pdfTotalCommitted = filteredSponsors.reduce((acc, s) => acc + (s.amount || 0), 0);
    const pdfTotalCollected = filteredSponsors.reduce((acc, s) => acc + (s.collectedAmount || 0), 0);
    const pdfTotalPending = pdfTotalCommitted - pdfTotalCollected;
    const pdfTotalFlagged = filteredSponsors.filter(s => s.status === 'FLAGGED').reduce((acc, s) => acc + (s.amount || 0), 0);

    // 1. Draw elegant top branding & title banner
    // Left raw accent color bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 4, 14, 'F');

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('PRIZE SPONSORS REGISTRY REPORT', 22, 16);

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    const filterText = statusFilter === 'ALL' ? 'All Contributors' : `Status Filter: ${statusFilter}`;
    doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}   |   Scope: ${filterText} (${filteredSponsors.length} Record${filteredSponsors.length === 1 ? '' : 's'})`, 22, 22);

    // Horizontal line separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 26, 196, 26);

    // 2. Draw 4 modern horizontal metric summary cards
    // Layout geometry: 182mm available width. Let's do 4 cards of 42.5mm width and 4mm spacing
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
      
      // Card left-edge border accent
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

    // Draw Card 1: Total Committed
    drawSummaryCard(
      14, 
      startY, 
      cardWidth, 
      cardHeight, 
      [248, 250, 252], 
      [203, 213, 225], 
      "COMMITTED TOTAL", 
      `Rs. ${pdfTotalCommitted.toLocaleString('en-IN')}`, 
      [100, 116, 139], 
      [15, 23, 42]
    );

    // Draw Card 2: Total Collected
    drawSummaryCard(
      14 + (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [230, 244, 234], // light green (#e6f4ea)
      [52, 211, 153], 
      "COLLECTED AMOUNT", 
      `Rs. ${pdfTotalCollected.toLocaleString('en-IN')}`, 
      [4, 120, 87], 
      [6, 95, 70]
    );

    // Draw Card 3: Total Pending
    drawSummaryCard(
      14 + 2 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [252, 232, 230], // light red (#fce8e6)
      [252, 165, 165], 
      "PENDING AMOUNT", 
      `Rs. ${pdfTotalPending.toLocaleString('en-IN')}`, 
      [185, 28, 28], 
      [153, 27, 27]
    );

    // Draw Card 4: Total Flagged
    drawSummaryCard(
      14 + 3 * (cardWidth + cardGap), 
      startY, 
      cardWidth, 
      cardHeight, 
      [184, 227, 233], // light blue (#B8E3E9)
      [110, 190, 203], 
      "FLAGGED AMOUNT", 
      `Rs. ${pdfTotalFlagged.toLocaleString('en-IN')}`, 
      [30, 58, 138], 
      [23, 37, 84]
    );

    // 3. Assemble and draw Table data
    const tableData = [
      ...filteredSponsors.map(s => [
        s.prizeNumber ? `Prize ${s.prizeNumber}` : '-',
        s.name || '',
        s.prizeDescription || '',
        s.area && s.area !== 'N/A' ? s.area : '-',
        `Rs. ${(s.amount || 0).toLocaleString('en-IN')}`,
        `Rs. ${(s.collectedAmount || 0).toLocaleString('en-IN')}`,
        s.status || 'PENDING',
        s.collectedDate ? format(new Date(s.collectedDate), 'dd.MM.yyyy') : '-'
      ]),
      [
        'TOTAL SUMMARY',
        '',
        '',
        '',
        `Rs. ${pdfTotalCommitted.toLocaleString('en-IN')}`,
        `Rs. ${pdfTotalCollected.toLocaleString('en-IN')}`,
        `Pending: Rs. ${pdfTotalPending.toLocaleString('en-IN')}`,
        ''
      ]
    ];

    autoTable(doc, {
      head: [['Prize #', 'Sponsor Name', 'Prize Description', 'Location', 'Committed', 'Collected', 'Status', 'Date']],
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
        0: { cellWidth: 15, fontStyle: 'bold' }, // Prize # fits perfectly in 15mm
        1: { cellWidth: 30, fontStyle: 'bold' }, // Sponsor Name fits in 30mm
        2: { cellWidth: 35 }, // Prize Description fits in 35mm
        3: { cellWidth: 20 }, // Location fits in 20mm
        4: { cellWidth: 21, halign: 'right' }, // Committed fits in 21mm
        5: { cellWidth: 21, halign: 'right' }, // Collected fits in 21mm
        6: { cellWidth: 20, halign: 'center' }, // Status fits in 20mm
        7: { cellWidth: 20, halign: 'center' }, // Date fits in 20mm
      }, // Sum of column widths = 15 + 30 + 35 + 20 + 21 + 21 + 20 + 20 = 182mm (Perfect fit for A4 width: 210mm - 28mm margins = 182mm)
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
          // Highlight totals row in deep slate
          data.cell.styles.fillColor = [241, 245, 249]; // slate-100
          data.cell.styles.textColor = [15, 23, 42]; // slate-900
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }

        if (data.section === 'body' && !isLastRow) {
          // Style Status column values with exact light backgrounds
          if (data.column.index === 6) {
            const statusVal = data.row.raw[6];
            if (statusVal === 'COLLECTED') {
              data.cell.styles.fillColor = [230, 244, 234]; // Light Green
              data.cell.styles.textColor = [13, 148, 136]; // Dark Green
              data.cell.styles.fontStyle = 'bold';
            } else if (statusVal === 'PENDING') {
              data.cell.styles.fillColor = [252, 232, 230]; // Light Red
              data.cell.styles.textColor = [220, 38, 38]; // Dark Red
              data.cell.styles.fontStyle = 'bold';
            } else if (statusVal === 'FLAGGED') {
              data.cell.styles.fillColor = [184, 227, 233]; // Light Blue (#B8E3E9)
              data.cell.styles.textColor = [29, 78, 137]; // Dark Blue text
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      didDrawPage: function(data) {
        // Footer layout
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        
        // Horizontal footer divider (fits within A4 width)
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.5);
        doc.line(14, 278, 196, 278);
        
        // Footer Left Text
        doc.text(`Official Prize Sponsors Directory & Financial Statement • 2026`, 14, 283);
        
        // Footer Right Page count
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(pageText, 196 - doc.getTextWidth(pageText), 283);
      }
    });

    // Save final rendered PDF
    const filename = `sponsors_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {permissions && !permissions.canAdd && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Adding entry sponsors has been disabled by the Primary Admin.</span>
        </div>
      )}

      {permissions && !permissions.canEdit && editingSponsor && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>Editing entry sponsors has been disabled by the Primary Admin.</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">Prize Sponsors</h1>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">Manage contributions and prize collections</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-xs cursor-pointer"
          >
            <FileText size={14} className="text-rose-600" />
            <span>Export</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-xs cursor-pointer"
            title="Print List"
          >
            <Printer size={14} className="text-blue-600" />
            <span>Print</span>
          </button>
          <button 
            disabled={permissions?.canAdd === false}
            onClick={() => permissions?.canAdd !== false && handleAddNew()}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg md:rounded-xl font-bold transition-all shadow-md text-xs",
              permissions?.canAdd === false
                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-55 shadow-none"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 cursor-pointer"
            )}
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Committed</p>
          <h3 className="text-lg md:text-2xl font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-emerald-600 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Collected</p>
          <h3 className="text-lg md:text-2xl font-black text-slate-900">₹{totalCollected.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-amber-600 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Pending</p>
          <h3 className="text-lg md:text-2xl font-black text-slate-900">₹{pendingAmount.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-blue-55/70 p-3 md:p-5 rounded-xl md:rounded-2xl border border-blue-200/60 bg-[#eaf4fe] shadow-sm border-l-4 border-l-blue-500">
          <p className="text-blue-700 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Flagged</p>
          <h3 className="text-lg md:text-2xl font-black text-blue-900">₹{flaggedAmount.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Search sponsors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs md:text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-lg">
            {['ALL', 'COLLECTED', 'PENDING', 'FLAGGED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={cn(
                  "flex-1 py-1 rounded-md text-[10px] md:text-xs font-bold transition-all capitalize cursor-pointer",
                  statusFilter === status 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {status.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60 max-w-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                viewMode === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TableIcon size={14} />
              <span>Grid Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                viewMode === 'cards' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid size={14} />
              <span>Cards Grid</span>
            </button>
          </div>

          {viewMode === 'table' && (
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const anyExpanded = Object.values(expandedRows).some(Boolean);
                  const updated: Record<string, boolean> = {};
                  if (!anyExpanded) {
                    filteredSponsors.forEach(s => {
                      updated[s.id] = true;
                    });
                  }
                  setExpandedRows(updated);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 transition-all cursor-pointer"
              >
                <span>{Object.values(expandedRows).some(Boolean) ? 'Collapse All' : 'Expand All'}</span>
                {Object.values(expandedRows).some(Boolean) ? (
                  <ChevronUp size={14} className="text-slate-400" />
                ) : (
                  <ChevronDown size={14} className="text-slate-400" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Sponsor Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{editingSponsor ? 'Edit Sponsor' : 'New Prize Sponsor'}</h3>
              <button onClick={() => { setIsAdding(false); setEditingSponsor(null); }} className="p-1.5 hover:bg-slate-100 rounded-full transition-all text-slate-400 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {duplicateError && (
                <div className="p-3 bg-red-50 text-red-650 rounded-xl border border-red-150 flex items-start gap-2 text-xs font-bold">
                  <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                  <span>{duplicateError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Sponsor Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    required
                    value={newSponsor.name}
                    onChange={(e) => setNewSponsor({ ...newSponsor, name: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                    placeholder="Company or Individual Name"
                  />
                </div>
              </div>

              {/* Note: Area input field is completely removed as requested, so we keep the value as fallback empty */}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Prize Description</label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    required
                    value={newSponsor.prizeDescription}
                    onChange={(e) => setNewSponsor({ ...newSponsor, prizeDescription: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900"
                    placeholder="e.g., Ceiling Fan, Mixer Grinder"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Prize Number (1 - 100)</label>
                <div className="relative">
                  <select
                    value={newSponsor.prizeNumber}
                    onChange={(e) => {
                      setNewSponsor({ ...newSponsor, prizeNumber: e.target.value });
                      const num = Number(e.target.value);
                      if (num && isDuplicatePrizeNumber(num, editingSponsor?.id)) {
                        setDuplicateError(`Prize Number ${num} is already assigned!`);
                      } else {
                        setDuplicateError(null);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900 appearance-none cursor-pointer"
                  >
                    <option value="">No Specific Prize Number</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>Prize {num}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Committed Amount (₹)</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</div>
                  <input 
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newSponsor.amount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setNewSponsor({ 
                        ...newSponsor, 
                        amount: val,
                        collectedAmount: newSponsor.status === 'COLLECTED' ? val : newSponsor.collectedAmount 
                      });
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs text-slate-900"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Collected Amount (₹)</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</div>
                  <input 
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newSponsor.collectedAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setNewSponsor({ 
                        ...newSponsor, 
                        collectedAmount: val,
                        status: val === 0 ? 'PENDING' : (val >= newSponsor.amount ? (val > newSponsor.amount ? 'FLAGGED' : 'COLLECTED') : 'PENDING')
                      });
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs text-slate-900"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 ml-1 uppercase tracking-wider">Status</label>
                <div className="relative">
                  <select
                    value={newSponsor.status}
                    onChange={(e) => {
                      const val = e.target.value as 'COLLECTED' | 'PENDING' | 'FLAGGED';
                      setNewSponsor({ 
                        ...newSponsor, 
                        status: val,
                        collectedAmount: val === 'COLLECTED' ? newSponsor.amount : (val === 'PENDING' ? 0 : newSponsor.collectedAmount)
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-900 appearance-none cursor-pointer"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COLLECTED">Collected</option>
                    <option value="FLAGGED">Flagged / Under Review</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95 text-xs cursor-pointer text-center"
              >
                <Save size={14} />
                {editingSponsor ? 'Update Sponsor' : 'Save Sponsor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sponsors Details Display */}
      {filteredSponsors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
          <Trophy size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-900 font-bold text-base">No sponsors found</h3>
          <p className="text-slate-400 text-xs">Add your first prize sponsor to get started</p>
        </div>
      ) : viewMode === 'table' ? (
        /* --- GRID TABLE VIEW WITH COLLAPSE MODE --- */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
          {/* Header Row */}
          <div className="hidden md:grid grid-cols-12 gap-3 p-4 bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-wider border-b border-slate-100">
            <div className="col-span-2">Prize Number</div>
            <div className="col-span-3">Sponsor Name</div>
            <div className="col-span-4">Prize Description</div>
            <div className="col-span-2 text-right">Committed / Collected</div>
            <div className="col-span-1 text-center font-bold">Status</div>
          </div>

          {/* Rows */}
          {filteredSponsors.map((s) => {
            const isExpanded = !!expandedRows[s.id];
            
            // Background Colors requested: COLLECTED Light Green, PENDING Light Red, FLAGGED Light Blue (#B8E3E9)
            const rowBg = s.status === 'COLLECTED' 
              ? "bg-[#e6f4ea] hover:bg-[#d8eddcf0] border-l-4 border-l-emerald-600/80" 
              : s.status === 'FLAGGED' 
                ? "bg-[#B8E3E9] hover:bg-[#a5dadf] border-l-4 border-l-blue-600/80 text-blue-950" 
                : "bg-[#fce8e6] hover:bg-[#fbdad6fa] border-l-4 border-l-rose-500/80";

            const statusText = s.status === 'COLLECTED' ? "Collected" : s.status === 'FLAGGED' ? "Flagged" : "Pending";
            
            const statusBadgeClasses = s.status === 'COLLECTED' 
              ? "bg-emerald-100 text-emerald-850 border-emerald-300" 
              : s.status === 'FLAGGED' 
                ? "bg-blue-105 text-blue-800 border-blue-300 animate-pulse" 
                : "bg-rose-100 text-rose-850 border-rose-300";

            return (
              <div key={s.id} className={cn("transition-all", rowBg)}>
                {/* Main Row Line */}
                <div 
                  onClick={() => setExpandedRows(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 items-center text-xs text-slate-700 cursor-pointer select-none"
                >
                  {/* Collapsible Trigger & Prize Number */}
                  <div className="col-span-2 flex items-center gap-1.5 font-sans">
                    <div className="text-slate-400 transform transition-transform">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                    {s.prizeNumber ? (
                      <span className="bg-blue-105 text-blue-700 border border-blue-200 font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg">
                        Prize {s.prizeNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-bold italic">No specific number</span>
                    )}
                  </div>

                  {/* Sponsor Name */}
                  <div className="col-span-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                    <User size={12} className="text-slate-400 shrink-0 md:hidden animate-in fade-in" />
                    <span>{s.name}</span>
                  </div>

                  {/* Prize Description */}
                  <div className="col-span-4 font-semibold text-slate-800 flex items-center gap-1.5">
                    <Gift size={12} className="text-slate-400 shrink-0 md:hidden animate-in fade-in" />
                    <span className="truncate">{s.prizeDescription}</span>
                  </div>

                  {/* Amount Breakdown */}
                  <div className="col-span-2 text-left md:text-right font-black text-slate-800 flex md:block items-center justify-between">
                    <span className="md:hidden text-slate-400 text-[9px] uppercase font-bold tracking-wider">Amount:</span>
                    <span className="font-mono">
                      <span className="text-emerald-700">₹{s.collectedAmount?.toLocaleString('en-IN') || 0}</span>
                      <span className="text-slate-405 mx-0.5 text-xs font-sans">/</span>
                      <span className="text-slate-500">₹{s.amount?.toLocaleString('en-IN') || 0}</span>
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1 text-center flex md:block justify-start md:justify-center">
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider", statusBadgeClasses)}>
                      {statusText}
                    </span>
                  </div>
                </div>

                {/* Collapsible Details Block */}
                {isExpanded && (
                  <div className="px-6 md:px-12 pb-4 pt-1.5 border-t border-slate-200/30 text-xs text-slate-500 animate-in slide-in-from-top-1 duration-150 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <p className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mb-0.5">Collection Status</p>
                        {s.collectedDate ? (
                          <p className="text-slate-700 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            Collected on: {format(new Date(s.collectedDate), 'dd.MM.yyyy')}
                          </p>
                        ) : (
                          <p className="text-slate-500 font-semibold flex items-center gap-1.5">
                            <Clock size={14} className="text-slate-400" />
                            Pending receipt from sponsor
                          </p>
                        )}
                      </div>
                      
                      <div className="col-span-4">
                        {s.area && s.area !== 'N/A' && (
                          <>
                            <p className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mb-0.5">Sponsor Location</p>
                            <p className="text-slate-700 font-bold flex items-center gap-1.5">
                              <MapPin size={14} className="text-slate-400" />
                              {s.area}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Edit & Delete Action Buttons inside collapse details */}
                      <div className="col-span-4 flex items-center justify-end gap-2 p-1.5 bg-white/40 dark:bg-slate-900/10 rounded-xl border border-slate-200/30">
                        <button 
                          disabled={permissions?.canEdit === false}
                          onClick={() => permissions?.canEdit !== false && handleEdit(s)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95",
                            permissions?.canEdit === false
                              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-55"
                              : "bg-white text-blue-650 hover:bg-blue-50 border border-blue-200 cursor-pointer"
                          )}
                        >
                          <Edit2 size={12} />
                          <span>Edit Sponsor</span>
                        </button>
                        <button 
                          disabled={permissions?.canDelete === false}
                          onClick={() => permissions?.canDelete !== false && setDeleteId(s.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95",
                            permissions?.canDelete === false
                              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-55"
                              : "bg-white text-rose-650 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                          )}
                        >
                          <Trash2 size={12} />
                          <span>Delete Sponsor</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* --- CARDS GRID VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {filteredSponsors.map((s) => {
            // Background Colors requested: COLLECTED Light Green, PENDING Light Red, FLAGGED Light Blue (#B8E3E9)
            const cardBg = s.status === 'COLLECTED' 
              ? "bg-[#e6f4ea] border-emerald-250/70 hover:bg-[#dededd]" 
              : s.status === 'FLAGGED' 
                ? "bg-[#B8E3E9] border-blue-250/70 hover:bg-[#a5dadf] text-blue-950" 
                : "bg-[#fce8e6] border-rose-250/70 hover:bg-[#fbcccc]";

            return (
              <div key={s.id} className={cn("p-4 rounded-xl md:rounded-2xl border shadow-sm hover:shadow transition-all group relative overflow-hidden", cardBg)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "p-2 rounded-xl bg-white/80 shadow-xs text-slate-700 font-bold"
                    )}>
                      <Trophy size={16} />
                    </div>
                    {s.prizeNumber && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 font-extrabold text-[10px] px-2 py-0.5 rounded-lg shrink-0">
                        Prize {s.prizeNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      disabled={permissions?.canEdit === false}
                      onClick={() => permissions?.canEdit !== false && handleEdit(s)}
                      className={cn(
                        "p-1 px-1.5 rounded transition-all border",
                        permissions?.canEdit === false
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-55"
                          : "bg-white/80 text-slate-500 hover:text-blue-600 border-slate-100 hover:bg-blue-50 cursor-pointer"
                      )}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      disabled={permissions?.canDelete === false}
                      onClick={() => permissions?.canDelete !== false && setDeleteId(s.id)}
                      className={cn(
                        "p-1 px-1.5 rounded transition-all border",
                        permissions?.canDelete === false
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-55"
                          : "bg-white/80 text-slate-500 hover:text-rose-600 border-slate-100 hover:bg-rose-50 cursor-pointer"
                      )}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-900 text-sm md:text-base leading-tight">{s.prizeDescription}</h4>
                      {s.status === 'FLAGGED' && (
                        <span className="text-[8px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded animate-pulse shrink-0">REVIEW</span>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs font-extrabold mt-0.5 flex items-center gap-1">
                      <User size={12} className="text-slate-450" /> {s.name}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-900/10">
                    <div className="flex items-center gap-1 text-slate-500 text-xs font-bold leading-none">
                      <MapPin size={12} /> <span className="font-sans">{s.area && s.area !== 'N/A' ? s.area : 'No Loc'}</span>
                    </div>
                    <div className="text-right leading-tight5">
                      <p className="text-slate-450 text-[8px] font-bold uppercase tracking-wider">Collected / Committed</p>
                      <p className="text-slate-900 font-black text-sm">
                        <span className={cn(s.collectedAmount > s.amount ? "text-rose-600" : "text-emerald-700")}>₹{s.collectedAmount?.toLocaleString('en-IN') || 0}</span>
                        <span className="text-slate-450 mx-0.5 text-xs">/</span>
                        <span className="text-slate-600 text-xs font-sans">₹{s.amount.toLocaleString('en-IN')}</span>
                      </p>
                    </div>
                  </div>

                  {s.status !== 'PENDING' && s.collectedDate && (
                    <div className={cn(
                      "flex items-center gap-1 text-[8px] font-black uppercase tracking-widest",
                      s.status === 'COLLECTED' ? "text-emerald-700" : "text-rose-700"
                    )}>
                      <CheckCircle2 size={10} />
                      <span>{s.status === 'COLLECTED' ? 'Collected' : 'Flagged'}: {format(new Date(s.collectedDate), 'dd.MM.yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDeleteSponsor(deleteId)}
        title="Delete Sponsor"
        message="Are you sure you want to delete this sponsor? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default SponsorsList;
