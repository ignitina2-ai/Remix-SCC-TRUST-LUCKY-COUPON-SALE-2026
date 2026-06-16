import React, { useState } from 'react';
import { Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { AppData, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod, getDefaultPaymentMethodsList } from '@/types';
import { cn } from '@/lib/utils';

interface PaymentSettingsProps {
  appData: AppData;
  onUpdatePaymentLabels: (labels: Record<PaymentMethod, string>) => void;
  onUpdatePaymentMethodsList?: (list: CustomPaymentMethod[]) => void;
}

export const PaymentSettings: React.FC<PaymentSettingsProps> = ({
  appData,
  onUpdatePaymentLabels,
  onUpdatePaymentMethodsList,
}) => {
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [newMethodUpiId, setNewMethodUpiId] = useState('');

  const rawMethodsList = appData.paymentMethodsList && appData.paymentMethodsList.length > 0
    ? appData.paymentMethodsList
    : getDefaultPaymentMethodsList(appData.customPaymentLabels);

  const allowedSystemIds = ['CASH', 'CREDIT', 'TRUST GPAY', 'SOFIA GPAY', 'JOHNY GPAY', 'OTHER_UPI'];

  // Only show what has been configured/added to the transaction sales form (plus any custom user methods)
  const methodsList = rawMethodsList.filter(m => 
    allowedSystemIds.includes(m.id) || m.id.startsWith('CUSTOM_')
  );

  const handleAddPaymentMethod = () => {
    if (!newMethodLabel.trim()) return;
    const newId = `CUSTOM_${Date.now()}`;
    const newMethodObj: CustomPaymentMethod = {
      id: newId,
      label: newMethodLabel.trim(),
      isDisabled: false,
      isSystem: false,
      upiId: newMethodUpiId.trim() || undefined
    };
    const updatedList = [...methodsList, newMethodObj];
    onUpdatePaymentMethodsList?.(updatedList);
    const updatedLabels = {
      ...(appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS),
      [newId]: newMethodLabel.trim()
    };
    onUpdatePaymentLabels(updatedLabels);
    setNewMethodLabel('');
    setNewMethodUpiId('');
  };

  const handleRenamePaymentMethod = (id: string, newLabel: string) => {
    const updatedList = methodsList.map(m => m.id === id ? { ...m, label: newLabel } : m);
    onUpdatePaymentMethodsList?.(updatedList);
    const updatedLabels = {
      ...(appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS),
      [id]: newLabel
    };
    onUpdatePaymentLabels(updatedLabels);
  };

  const handleUpdateUpiId = (id: string, upiId: string) => {
    const updatedList = methodsList.map(m => m.id === id ? { ...m, upiId: upiId.trim() } : m);
    onUpdatePaymentMethodsList?.(updatedList);
  };

  const handleTogglePaymentMethod = (id: string) => {
    const updatedList = methodsList.map(m => m.id === id ? { ...m, isDisabled: !m.isDisabled } : m);
    onUpdatePaymentMethodsList?.(updatedList);
  };

  const handleDeletePaymentMethod = (id: string) => {
    const updatedList = methodsList.filter(m => m.id !== id);
    onUpdatePaymentMethodsList?.(updatedList);
    if (appData.customPaymentLabels) {
      const updatedLabels = { ...appData.customPaymentLabels };
      delete updatedLabels[id];
      onUpdatePaymentLabels(updatedLabels);
    }
  };

  return (
    <div id="settings-card-payment" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
          <SettingsIcon size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Payment Methods Manager</h3>
      </div>
      <p className="text-slate-500 text-xs font-semibold leading-relaxed text-left">
        Configure system and custom payment options. You can add more payment modes, modify display labels, disable inactive modes, or delete custom items.
      </p>

      {/* Add Custom Payment Mode Form */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-left">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Custom Payment Mode</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mode Label</label>
            <input
              type="text"
              value={newMethodLabel}
              onChange={(e) => setNewMethodLabel(e.target.value)}
              placeholder="e.g. Airtel Money, Amazon Pay"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">UPI ID or Mobile (Optional)</label>
            <input
              type="text"
              value={newMethodUpiId}
              onChange={(e) => setNewMethodUpiId(e.target.value)}
              placeholder="e.g. 9876543210@paytm"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
            />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            onClick={handleAddPaymentMethod}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-700 transition-all cursor-pointer shadow-sm shrink-0 uppercase tracking-wider"
          >
            Add Mode & Save
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left">All Configured Modes</h4>
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
          {methodsList.map((method) => (
            <div key={method.id} className={cn("p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white", method.isDisabled && "bg-slate-50/40")}>
              <div className="flex items-start gap-3 flex-1 min-w-0 text-left">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1", method.id === 'CASH' ? 'bg-emerald-50 text-emerald-600' : method.id === 'CREDIT' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600')}>
                  {method.id === 'CASH' ? '₵' : method.id === 'CREDIT' ? '💳' : '📱'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {method.isSystem ? 'System' : 'Custom'}
                    </span>
                    {method.isDisabled && (
                      <span className="text-[8px] font-extrabold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mt-1.5">
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Payment Label</label>
                      <input
                        type="text"
                        value={method.label}
                        onChange={(e) => handleRenamePaymentMethod(method.id, e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-850"
                        placeholder="Display Name"
                      />
                    </div>
                    {method.id !== 'CASH' && method.id !== 'CREDIT' && (
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">UPI ID or Mobile (for QR code)</label>
                        <input
                          type="text"
                          value={method.upiId || ''}
                          onChange={(e) => handleUpdateUpiId(method.id, e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-700"
                          placeholder="e.g. name@upi or 9876543215@paytm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {method.id !== 'CASH' && (
                  <button
                    onClick={() => handleTogglePaymentMethod(method.id)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      method.isDisabled ? "bg-slate-200" : "bg-blue-600"
                    )}
                    title={method.isDisabled ? "Click to Enable" : "Click to Disable"}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        method.isDisabled ? "translate-x-0" : "translate-x-4"
                      )}
                    />
                  </button>
                )}

                {!method.isSystem && (
                  <button
                    onClick={() => handleDeletePaymentMethod(method.id)}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    title="Delete custom mode"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
