# Firestore Security Specification

This document defines the zero-trust security architecture, data invariants, and negative payloads designed to test our safety rules for the SCC TRUST LUCKY COUPON SALE 2026 application.

## 1. Data Invariants
- **Identity Integrity**: Standard users should only be able to write transactions with their own inputs, and an admin concept can override or manage them. Since any user (under authentication) can record sales, writing transactions require a signed-in user.
- **Financial Validation**: A purchase cannot have a negative coupon count or a negative totalAmount.
- **Audit Consistency**: Timestamp validations require `createdAt` or `updatedAt` to be set strictly on the server time where applicable.
- **Terminal State Guarding**: Once transactions are paid to the treasurer, their primary details should not be tampered with by unauthorized roles.

## 2. The "Dirty Dozen" Negative Payloads (Attack Vectors)

### Payload 1: Transaction Creation with Negative Books
An attacker tries to create a transaction with a negative book size to manipulate totals.
```json
{
  "id": "exploit_negative_books",
  "name": "Attacker",
  "area": "Downtown",
  "books": -5,
  "coupons": -125,
  "totalAmount": -500,
  "paidAmount": 0,
  "creditAmount": -500,
  "paymentMethod": "CASH",
  "paidToTreasurer": false,
  "date": "2026-06-15T00:00:00.000Z"
}
```

### Payload 2: Spoofed Transaction Identity
An attacker attempts to set `totalAmount` to an extremely high value while maintaining `paidAmount` to exploit calculations.
```json
{
  "id": "exploit_spoof_totals",
  "name": "Attacker",
  "area": "Downtown",
  "books": 1,
  "coupons": 25,
  "totalAmount": 9999999,
  "paidAmount": -100,
  "creditAmount": 10000099,
  "paymentMethod": "CASH",
  "paidToTreasurer": false,
  "date": "2026-06-15T00:00:00.000Z"
}
```

### Payload 3: Injecting Ghost Fields into Transaction
Attempting to create a transaction with random un-whitelisted properties (Ghost Fields) to disrupt parsing models.
```json
{
  "id": "shadow_field_tx",
  "name": "Vandal",
  "area": "Uptown",
  "books": 2,
  "coupons": 50,
  "totalAmount": 200,
  "paidAmount": 200,
  "creditAmount": 0,
  "paymentMethod": "CASH",
  "paidToTreasurer": false,
  "date": "2026-06-15T00:00:00.000Z",
  "isVerifiedFakeField": true
}
```

### Payload 4: Sponsor Creation with FLAGGED Status by Standard User
A regular user tries to inject a flagged status sponsor with negative promised amounts.
```json
{
  "id": "exploit_sponsor",
  "name": "Bad Sponsor",
  "area": "Nowhere",
  "prizeDescription": "Fake Prize",
  "amount": -10000,
  "collectedAmount": 0,
  "status": "FLAGGED"
}
```

### Payload 5: IncomeExpense with Extravagant Negative Amounts
Manipulating current balance totals by injecting a negative income.
```json
{
  "id": "negative_income",
  "date": "2026-06-15T00:00:00.000Z",
  "description": "Ghost Income",
  "amount": -500000,
  "type": "INCOME"
}
```

### Payload 6: Changing Immutable `createdAt`
Trying to overwrite or rewrite transaction history creation markers.
```json
{
  "date": "2020-01-01T00:00:00.000Z"
}
```

### Payload 7: Attacking Secretary Handover with Massive Amount
Adding handovers with a negative or extreme value limit.
```json
{
  "id": "handover_excess",
  "date": "2026-06-15T00:00:00.000Z",
  "name": "Corrupt Sec",
  "description": "Zero cash",
  "amount": -200000
}
```

### Payload 8: Settings Overwrite by Anonymous Connection
Modifying overall configuration from an unauthenticated client.
```json
{
  "id": "appSettings",
  "logo": "exploit.png",
  "notificationsEnabled": true
}
```

### Payload 9: Unauthorized Reads to Settings
Eavesdropping or modifying custom payment labels to trigger UI issues.

### Payload 10: ID Poisoning (Junk Character Strings)
Attempting to create a document with an ID consisting of dangerous 1.5KB script injections or forbidden chars.

### Payload 11: Transaction Deletion by Non-Admin Users
Trying to erase audit sales histories.

### Payload 12: Bypassing Email Verification
Trying to mutate system data without a verified admin identity.
