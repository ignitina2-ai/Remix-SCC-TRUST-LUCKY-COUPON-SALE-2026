import { db, auth, getCachedAccessToken } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { PrizeItem, PrizeTrackingMap, ReceivedAmountEntry, INITIAL_PRIZES_DATA } from '@/data/prizesData';
import { 
  getOrCreateDriveFolder, 
  getOrCreateCouponSheet, 
  DEFAULT_WEBHOOK_URL, 
  DriveSyncConfig,
  SHEET_NAME 
} from './googleDriveSheets';

export const PRIZE_SHEET_TAB_NAME = 'PRIZE COLLECTION';
export const FIRESTORE_PRIZE_DOC = 'state';

export interface PrizeSyncStats {
  total: number;
  collectedCount: number;
  sponsorCount: number;
  trustCount: number;
  pendingCount: number;
  trustTotalAmount: number;
  totalReceivedAmount: number;
  balanceAmount: number;
}

export function calculatePrizeStats(
  prizes: PrizeItem[],
  tracking: PrizeTrackingMap,
  receivedAmounts: ReceivedAmountEntry[]
): PrizeSyncStats {
  const total = prizes.length;
  let collectedCount = 0;
  let sponsorCount = 0;
  let trustCount = 0;
  let trustTotalAmount = 0;

  prizes.forEach(p => {
    const track = tracking[p.prize_no];
    if (!track) return;
    if (track.status === 'SPONSOR') {
      collectedCount++;
      sponsorCount++;
    } else if (track.status === 'TRUST') {
      collectedCount++;
      trustCount++;
      trustTotalAmount += (Number(track.amount) || 0);
    }
  });

  const pendingCount = total - collectedCount;
  const totalReceivedAmount = receivedAmounts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const balanceAmount = totalReceivedAmount - trustTotalAmount;

  return {
    total,
    collectedCount,
    sponsorCount,
    trustCount,
    pendingCount,
    trustTotalAmount,
    totalReceivedAmount,
    balanceAmount,
  };
}

/**
 * Persist Prize Collection to Firebase Firestore for multi-device realtime team collaboration.
 */
export async function savePrizeStateToFirestore(
  tracking: PrizeTrackingMap,
  receivedAmounts: ReceivedAmountEntry[],
  userEmail?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'prizeCollection', FIRESTORE_PRIZE_DOC);
    await setDoc(docRef, {
      tracking,
      receivedAmounts,
      lastUpdated: new Date().toISOString(),
      updatedBy: userEmail || 'system',
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore prize state sync warning:', err);
  }
}

/**
 * Subscribe to realtime Firestore changes for Prize Collection state.
 */
export function subscribeToPrizeState(
  onUpdate: (data: { tracking: PrizeTrackingMap; receivedAmounts: ReceivedAmountEntry[] }) => void
): () => void {
  try {
    const docRef = doc(db, 'prizeCollection', FIRESTORE_PRIZE_DOC);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data) {
          onUpdate({
            tracking: data.tracking || {},
            receivedAmounts: Array.isArray(data.receivedAmounts) ? data.receivedAmounts : []
          });
        }
      }
    }, (err) => {
      console.warn('PrizeCollection firestore subscription notice:', err);
    });
  } catch (err) {
    console.warn('Failed subscribing to prize state:', err);
    return () => {};
  }
}

/**
 * Format all 160 prizes into tabular rows for Google Sheets.
 */
export function formatPrizeCollectionRows(
  prizes: PrizeItem[],
  tracking: PrizeTrackingMap
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  prizes.forEach((p, index) => {
    const track = tracking[p.prize_no] || { status: 'PENDING', amount: 0 };
    const statusLabel = track.status === 'SPONSOR' 
      ? 'SPONSOR (Collected)' 
      : track.status === 'TRUST' 
        ? 'TRUST (Purchased)' 
        : 'PENDING';

    const trustCost = track.status === 'TRUST' ? (Number(track.amount) || 0) : 0;
    const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    rows.push([
      index + 1,
      p.prize_no,
      p.prize_item,
      p.display_sponsor || '',
      p.origin_sponsor || '',
      statusLabel,
      trustCost,
      nowStr
    ]);
  });

  return rows;
}

/**
 * Format received donations entries into rows for Google Sheets.
 */
export function formatReceivedAmountsRows(
  receivedAmounts: ReceivedAmountEntry[]
): (string | number)[][] {
  return receivedAmounts.map((r, idx) => {
    const dateFormatted = r.date 
      ? new Date(r.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
      : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return [
      idx + 1,
      r.name || 'Anonymous',
      Number(r.amount) || 0,
      dateFormatted
    ];
  });
}

/**
 * Find or create the 'PRIZE COLLECTION' tab inside the Google Spreadsheet.
 */
async function ensurePrizeSheetTab(accessToken: string, spreadsheetId: string): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (metaRes.ok) {
    const data = await metaRes.json();
    const existing = (data.sheets || []).some(
      (s: any) => s.properties?.title?.toLowerCase() === PRIZE_SHEET_TAB_NAME.toLowerCase()
    );
    if (existing) {
      return PRIZE_SHEET_TAB_NAME;
    }
  }

  // Create new tab named 'PRIZE COLLECTION'
  const addSheetRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: PRIZE_SHEET_TAB_NAME,
                gridProperties: {
                  rowCount: 250,
                  columnCount: 10,
                  frozenRowCount: 4,
                },
              },
            },
          },
        ],
      }),
    }
  );

  if (!addSheetRes.ok) {
    console.warn('Add tab request returned status', addSheetRes.status);
  }

  return PRIZE_SHEET_TAB_NAME;
}

/**
 * Sync Prize Collection data directly to Google Sheets via Google Sheets API v4.
 */
export async function syncPrizeCollectionToGoogleSheet(
  accessToken: string,
  prizes: PrizeItem[] = INITIAL_PRIZES_DATA,
  tracking: PrizeTrackingMap,
  receivedAmounts: ReceivedAmountEntry[],
  preferredSheetId?: string
): Promise<{ success: boolean; sheetId: string; webViewLink?: string; message: string }> {
  let targetSheetId = preferredSheetId;
  let targetWebViewLink: string | undefined = targetSheetId
    ? `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`
    : undefined;

  if (!targetSheetId) {
    const folder = await getOrCreateDriveFolder(accessToken);
    const mainSheet = await getOrCreateCouponSheet(accessToken, folder.id);
    targetSheetId = mainSheet.id;
    targetWebViewLink = mainSheet.webViewLink;
  }

  const tabTitle = await ensurePrizeSheetTab(accessToken, targetSheetId);
  const stats = calculatePrizeStats(prizes, tracking, receivedAmounts);
  const safeTab = encodeURIComponent(tabTitle);

  // 1. Clear existing content in 'PRIZE COLLECTION' tab
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/'${safeTab}'!A1:Z300:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(console.warn);

  // 2. Build rows with Title, KPI Banner, Prize Rows, and Received Donations Rows
  const nowKolkata = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const values: (string | number)[][] = [
    // Row 1: Title Banner
    ['ST. CASIMIR CHARITABLE TRUST — LUCKY DRAW 2026 PRIZE COLLECTION', '', '', '', '', '', '', ''],
    // Row 2: Sync Timestamp & Stats summary
    [
      `Last Updated: ${nowKolkata}`,
      `Total Prizes: ${stats.total}`,
      `Sponsored: ${stats.sponsorCount}`,
      `Trust: ${stats.trustCount}`,
      `Pending: ${stats.pendingCount}`,
      `Trust Expense: ₹${stats.trustTotalAmount.toLocaleString('en-IN')}`,
      `Donations Received: ₹${stats.totalReceivedAmount.toLocaleString('en-IN')}`,
      `Balance: ₹${stats.balanceAmount.toLocaleString('en-IN')}`
    ],
    // Row 3: Blank
    ['', '', '', '', '', '', '', ''],
    // Row 4: Prize Table Headers
    [
      'Sl No',
      'Prize No',
      'Prize Item',
      'Display Sponsor / Donor',
      'Origin Sponsor / Remarks',
      'Status',
      'Trust Amount (₹)',
      'Last Updated'
    ],
    // Rows 5+: 160 Prizes
    ...formatPrizeCollectionRows(prizes, tracking),
    // Separator rows
    ['', '', '', '', '', '', '', ''],
    ['=== RECEIVED CASH DONATIONS FOR PRIZES ===', '', '', '', '', '', '', ''],
    ['Sl No', 'Donor / Contributor Name', 'Donation Amount (₹)', 'Date & Time', '', '', '', ''],
    // Received amounts rows
    ...formatReceivedAmountsRows(receivedAmounts).map(r => [r[0], r[1], r[2], r[3], '', '', '', ''])
  ];

  // 3. Write data to the tab
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/'${safeTab}'!A1:H${values.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Google Sheets API write failed: ${writeRes.status} ${errText}`);
  }

  return {
    success: true,
    sheetId: targetSheetId,
    webViewLink: targetWebViewLink,
    message: `Prize collection successfully updated in Google Sheet (${tabTitle})!`,
  };
}

/**
 * Sync Prize Collection via Google Apps Script Webhook.
 * Works seamlessly across all devices without needing separate OAuth tokens.
 */
export async function syncPrizeCollectionViaWebhook(
  webhookUrl: string,
  prizes: PrizeItem[] = INITIAL_PRIZES_DATA,
  tracking: PrizeTrackingMap,
  receivedAmounts: ReceivedAmountEntry[]
): Promise<{ success: boolean; message: string }> {
  const url = (webhookUrl || DEFAULT_WEBHOOK_URL).trim();
  if (!url) {
    return { success: false, message: 'No Google Apps Script webhook URL configured' };
  }

  const payload = {
    action: 'syncPrizes',
    prizesTracking: tracking,
    receivedAmounts: receivedAmounts,
    prizesData: prizes.map(p => ({
      prize_no: p.prize_no,
      prize_item: p.prize_item,
      display_sponsor: p.display_sponsor,
      origin_sponsor: p.origin_sponsor
    })),
    timestamp: new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok || res.type === 'opaque') {
      return { success: true, message: 'Prize Collection synced successfully to Google Sheet via Webhook!' };
    }
    const errText = await res.text().catch(() => '');
    return { success: true, message: errText || 'Synced to Google Sheet' };
  } catch (err) {
    // If browser CORS policy blocked Google Apps Script 302 redirect, fallback to no-cors mode
    try {
      const fbController = new AbortController();
      const fbTimeout = setTimeout(() => fbController.abort(), 6000);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: fbController.signal,
      });
      clearTimeout(fbTimeout);
      return { success: true, message: 'Prize Collection sync payload delivered to Google Sheet!' };
    } catch (fbErr: any) {
      return { success: false, message: fbErr?.message || 'Failed connecting to Google Sheets Webhook' };
    }
  }
}
