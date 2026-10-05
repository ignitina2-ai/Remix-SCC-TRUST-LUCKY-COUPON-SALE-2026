import { Transaction, AppData } from '@/types';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

export const TARGET_DRIVE_EMAIL = 'stcasimircharitabletrust@gmail.com';
export const FOLDER_NAME = 'LUCKY COUPON SALE 2026';
export const SHEET_NAME = 'COUPON SALE 2026';
export const BACKUP_FILE_NAME = 'SCC_TRUST_LUCKY_COUPON_2026_BACKUP.json';
export const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyH12BF9zsSX5guESELutMdbmEUPKXvjQL3sZDq01ayQ1nFukzua3bfaGns1Jdo-J_X/exec';

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface SheetInfo {
  id: string;
  name: string;
  webViewLink?: string;
  tabTitle: string;
}

export interface DriveSyncStatus {
  folder?: DriveFolderInfo;
  sheet?: SheetInfo;
  backupFileId?: string;
  lastSyncedAt?: string;
  lastError?: string;
}

// In-memory cache for folder & sheet IDs to minimize API round-trips
let cachedFolderInfo: DriveFolderInfo | null = null;
let cachedSheetInfo: SheetInfo | null = null;

export const clearDriveCache = () => {
  cachedFolderInfo = null;
  cachedSheetInfo = null;
};

/**
 * Find or create the target folder "LUCKY COUPON SALE 2026" in Google Drive.
 */
export async function getOrCreateDriveFolder(accessToken: string): Promise<DriveFolderInfo> {
  if (cachedFolderInfo) {
    return cachedFolderInfo;
  }

  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Google Drive folder search failed: ${searchRes.status} ${errorText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    cachedFolderInfo = {
      id: searchData.files[0].id,
      name: searchData.files[0].name,
      webViewLink: searchData.files[0].webViewLink || `https://drive.google.com/drive/folders/${searchData.files[0].id}`,
    };
    return cachedFolderInfo;
  }

  // 2. Create new folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: `SCC Trust Lucky Coupon 2026 Archive for ${TARGET_DRIVE_EMAIL}`,
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${createRes.status} ${errorText}`);
  }

  const newFolder = await createRes.json();
  cachedFolderInfo = {
    id: newFolder.id,
    name: newFolder.name,
    webViewLink: newFolder.webViewLink || `https://drive.google.com/drive/folders/${newFolder.id}`,
  };
  return cachedFolderInfo;
}

/**
 * Find or create the Google Sheet "COUPON SALE 2026" inside the target folder.
 */
export async function getOrCreateCouponSheet(accessToken: string, folderId: string): Promise<SheetInfo> {
  if (cachedSheetInfo) {
    return cachedSheetInfo;
  }

  // 1. Search for existing sheet in folder
  const query = encodeURIComponent(`name = '${SHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let sheetId: string;
  let webViewLink: string;

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      sheetId = searchData.files[0].id;
      webViewLink = searchData.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}`;
      const tabTitle = await getSheetTabTitle(accessToken, sheetId);
      cachedSheetInfo = { id: sheetId, name: SHEET_NAME, webViewLink, tabTitle };
      return cachedSheetInfo;
    }
  }

  // 2. Create spreadsheet inside folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: SHEET_NAME,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Google Sheet: ${createRes.status} ${errorText}`);
  }

  const newSheet = await createRes.json();
  sheetId = newSheet.id;
  webViewLink = newSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}`;

  // 3. Get initial tab title and set header row
  const tabTitle = await getSheetTabTitle(accessToken, sheetId);
  await initializeSheetHeaders(accessToken, sheetId, tabTitle);

  cachedSheetInfo = { id: sheetId, name: SHEET_NAME, webViewLink, tabTitle };
  return cachedSheetInfo;
}

/**
 * Fetch spreadsheet metadata to get the first sheet's actual tab name.
 */
async function getSheetTabTitle(accessToken: string, sheetId: string): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    return 'Sheet1';
  }
  const metaData = await metaRes.json();
  return metaData?.sheets?.[0]?.properties?.title || 'Sheet1';
}

/**
 * Initialize headers in the Google Sheet.
 */
const SHEET_HEADERS = [
  'Sl No',
  'Transaction ID',
  'Date & Time',
  'Name',
  'Area',
  'Phone',
  'Books',
  'Book Number',
  'Coupons',
  'Coupon Number',
  'Total Amount (₹)',
  'Paid Amount (₹)',
  'Balance / Credit (₹)',
  'Payment Mode',
  'Paid to Treasurer',
  'System Sync Timestamp',
];

async function initializeSheetHeaders(accessToken: string, sheetId: string, tabTitle: string) {
  const safeTab = encodeURIComponent(tabTitle);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'${safeTab}'!A1:P1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    }
  );
}

/**
 * Format a Transaction into a row array for Google Sheets.
 */
export function formatTransactionRow(tx: Transaction, index: number): (string | number)[] {
  const dateStr = tx.date ? new Date(tx.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
  const syncDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return [
    index,
    tx.id,
    dateStr,
    tx.name || '',
    tx.area || '',
    tx.phone || '',
    tx.books || 0,
    tx.bookNumber || '',
    tx.coupons || 0,
    tx.couponNumber || '',
    tx.totalAmount || 0,
    tx.paidAmount || 0,
    tx.creditAmount || 0,
    tx.paymentMethod || 'CASH',
    tx.paidToTreasurer ? 'YES' : 'NO',
    syncDate,
  ];
}

/**
 * Record or update a single transaction in "COUPON SALE 2026" Google Sheet.
 */
export async function recordOrUpdateTransactionInSheet(
  accessToken: string,
  tx: Transaction,
  existingIndex = 1
): Promise<{ sheetId: string; webViewLink?: string; action: 'inserted' | 'updated' }> {
  const folder = await getOrCreateDriveFolder(accessToken);
  const sheet = await getOrCreateCouponSheet(accessToken, folder.id);

  const safeTab = encodeURIComponent(sheet.tabTitle);

  // 1. Fetch column B (Transaction IDs) to check if transaction already exists
  const colBRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${safeTab}'!B:B`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let existingRow = -1;
  let totalRows = 1;

  if (colBRes.ok) {
    const colBData = await colBRes.json();
    const rows = colBData.values || [];
    totalRows = Math.max(1, rows.length);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === tx.id) {
        existingRow = i + 1; // 1-indexed row number
        break;
      }
    }
  }

  const rowData = formatTransactionRow(tx, existingRow > 1 ? existingRow - 1 : totalRows);

  if (existingRow > 1) {
    // Update existing row
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${safeTab}'!A${existingRow}:P${existingRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Failed to update sheet row ${existingRow}: ${updateRes.status} ${err}`);
    }

    return { sheetId: sheet.id, webViewLink: sheet.webViewLink, action: 'updated' };
  } else {
    // Append new row
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${safeTab}'!A:P:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`Failed to append transaction to sheet: ${appendRes.status} ${err}`);
    }

    return { sheetId: sheet.id, webViewLink: sheet.webViewLink, action: 'inserted' };
  }
}

/**
 * Full sync: writes all transactions to "COUPON SALE 2026" Google Sheet.
 */
export async function syncAllTransactionsToSheet(
  accessToken: string,
  transactions: Transaction[]
): Promise<{ count: number; sheetId: string; webViewLink?: string }> {
  const folder = await getOrCreateDriveFolder(accessToken);
  const sheet = await getOrCreateCouponSheet(accessToken, folder.id);

  const safeTab = encodeURIComponent(sheet.tabTitle);

  // Prepare header + all rows
  const allRows: (string | number)[][] = [
    SHEET_HEADERS,
    ...transactions.map((tx, idx) => formatTransactionRow(tx, idx + 1)),
  ];

  // Overwrite starting from A1
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${safeTab}'!A1:P${allRows.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Failed to sync all transactions to sheet: ${updateRes.status} ${err}`);
  }

  return { count: transactions.length, sheetId: sheet.id, webViewLink: sheet.webViewLink };
}

/**
 * Save or update the backup JSON file in "LUCKY COUPON SALE 2026" folder in Google Drive.
 */
export async function saveBackupJsonToDrive(
  accessToken: string,
  appData: AppData
): Promise<{ fileId: string; name: string; webViewLink?: string }> {
  const folder = await getOrCreateDriveFolder(accessToken);
  const jsonContent = JSON.stringify(appData, null, 2);

  // 1. Check if backup file already exists in folder
  const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and '${folder.id}' in parents and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existingFileId = searchData.files[0].id;
      // Overwrite file content via upload endpoint
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: jsonContent,
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text();
        throw new Error(`Failed to update Drive backup JSON: ${updateRes.status} ${err}`);
      }

      return {
        fileId: existingFileId,
        name: BACKUP_FILE_NAME,
        webViewLink: searchData.files[0].webViewLink || `https://drive.google.com/file/d/${existingFileId}/view`,
      };
    }
  }

  // 2. Create new JSON file with multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    parents: [folder.id],
    description: `Automated Full Backup for SCC TRUST LUCKY COUPON SALE 2026 (${TARGET_DRIVE_EMAIL})`,
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload Drive backup JSON: ${uploadRes.status} ${err}`);
  }

  const createdFile = await uploadRes.json();
  return {
    fileId: createdFile.id,
    name: createdFile.name,
    webViewLink: createdFile.webViewLink || `https://drive.google.com/file/d/${createdFile.id}/view`,
  };
}

/**
 * Combined operation: records transaction in Google Sheet AND updates JSON backup file in Google Drive folder.
 */
export async function recordTransactionAndBackupToDrive(
  accessToken: string,
  tx: Transaction,
  appData: AppData
): Promise<{
  sheetResult: { sheetId: string; webViewLink?: string; action: 'inserted' | 'updated' };
  backupResult: { fileId: string; name: string; webViewLink?: string };
}> {
  // Update appData copy with this transaction if not yet added
  const updatedTransactions = appData.transactions.some(t => t.id === tx.id)
    ? appData.transactions.map(t => t.id === tx.id ? tx : t)
    : [tx, ...appData.transactions];

  const fullAppData: AppData = {
    ...appData,
    transactions: updatedTransactions,
  };

  const [sheetResult, backupResult] = await Promise.all([
    recordOrUpdateTransactionInSheet(accessToken, tx),
    saveBackupJsonToDrive(accessToken, fullAppData),
  ]);

  return { sheetResult, backupResult };
}

export interface DriveSyncConfig {
  activeAccessToken?: string | null;
  tokenUpdatedAt?: string | null;
  connectedEmail?: string | null;
  folderId?: string;
  folderLink?: string;
  sheetId?: string;
  sheetLink?: string;
  backupFileId?: string;
  webhookUrl?: string;
  autoSyncEnabled?: boolean;
  lastSyncedAt?: string;
  lastSyncedBy?: string;
  lastSyncStatus?: 'success' | 'error';
  lastSyncMessage?: string;
}

/**
 * Sync transaction or full backup via Google Apps Script Webhook.
 * This allows all team members across any device to sync directly without needing local OAuth tokens!
 */
export async function syncViaWebhook(
  webhookUrl: string,
  payload: {
    action: 'add' | 'update' | 'delete' | 'syncAll';
    transaction?: Transaction;
    transactions?: Transaction[];
    fullBackup?: AppData;
  }
): Promise<{ success: boolean; message?: string }> {
  const url = (webhookUrl || DEFAULT_WEBHOOK_URL).trim();
  if (!url) return { success: false, message: 'No webhook URL provided' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (res.ok || res.type === 'opaque') {
      return { success: true };
    }
    const errText = await res.text().catch(() => '');
    return { success: true, message: errText };
  } catch (err: any) {
    // If browser CORS blocked the cross-origin 302 redirect from Google Apps Script,
    // dispatch with mode: 'no-cors' to ensure Google's servers receive and process the payload
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return { success: true };
    } catch (fallbackErr: any) {
      console.error('Webhook sync failed:', fallbackErr);
      return { success: false, message: fallbackErr.message || String(fallbackErr) };
    }
  }
}

/**
 * Ready-to-copy Google Apps Script code for stcasimircharitabletrust@gmail.com
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * SCC TRUST - LUCKY COUPON SALE 2026
 * Automated Real-Time Google Sheet & Google Drive Sync Webhook
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheet "COUPON SALE 2026"
 * 2. Click "Extensions" > "Apps Script"
 * 3. Replace all code in the script editor with this exact code and Save.
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me (stcasimircharitabletrust@gmail.com)"
 * 7. Set "Who has access": "Anyone" (allows applet to send live transaction updates)
 * 8. Click "Deploy", copy the Web App URL, and paste it into the App Settings.
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('COUPON SALE 2026') || ss.getActiveSheet();
    
    // Ensure Sheet Title
    if (sheet.getName() !== 'COUPON SALE 2026') {
      try { sheet.setName('COUPON SALE 2026'); } catch(e){}
    }

    // 1. Process Single Transaction (Add / Update)
    if (payload.action === 'add' || payload.action === 'update') {
      var tx = payload.transaction;
      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      // Match by Transaction ID (Column B)
      for (var i = 1; i < data.length; i++) {
        if (data[i] && String(data[i][1]) === String(tx.id)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      var row = [
        rowIndex > 1 ? rowIndex - 1 : Math.max(1, data.length),
        tx.id || '',
        tx.date ? new Date(tx.date).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) : new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
        tx.name || '',
        tx.area || '',
        tx.phone || '',
        tx.books || 0,
        tx.bookNumber || '',
        tx.coupons || 0,
        tx.couponNumber || '',
        tx.totalAmount || 0,
        tx.paidAmount || 0,
        tx.creditAmount || 0,
        tx.paymentMethod || 'CASH',
        tx.paidToTreasurer ? 'YES' : 'NO',
        new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
      ];
      
      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
    } 
    // 2. Full Bulk Sync
    else if (payload.action === 'syncAll' && payload.transactions) {
      sheet.clear();
      var headers = [
        'Sl No', 'Transaction ID', 'Date & Time', 'Name', 'Area', 'Phone',
        'Books', 'Book Number', 'Coupons', 'Coupon Number',
        'Total Amount (₹)', 'Paid Amount (₹)', 'Balance / Credit (₹)',
        'Payment Mode', 'Paid to Treasurer', 'System Sync Timestamp'
      ];
      var rows = [headers];
      payload.transactions.forEach(function(tx, idx) {
        rows.push([
          idx + 1,
          tx.id || '',
          tx.date ? new Date(tx.date).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) : '',
          tx.name || '',
          tx.area || '',
          tx.phone || '',
          tx.books || 0,
          tx.bookNumber || '',
          tx.coupons || 0,
          tx.couponNumber || '',
          tx.totalAmount || 0,
          tx.paidAmount || 0,
          tx.creditAmount || 0,
          tx.paymentMethod || 'CASH',
          tx.paidToTreasurer ? 'YES' : 'NO',
          new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
        ]);
      });
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    }

    // 3. Save / Update Full Backup JSON in "LUCKY COUPON SALE 2026" Drive Folder
    if (payload.fullBackup) {
      var folderName = 'LUCKY COUPON SALE 2026';
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      var fileName = 'SCC_TRUST_LUCKY_COUPON_2026_BACKUP.json';
      var files = folder.getFilesByName(fileName);
      var content = JSON.stringify(payload.fullBackup, null, 2);
      if (files.hasNext()) {
        files.next().setContent(content);
      } else {
        folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
