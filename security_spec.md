# Security Specification & Threat Modeling (TDD)

## 1. Data Invariants
- **ArchiveItem Structure**: Every item must contain unique, non-null identifiers, valid enum-constrained asset types (`link | image | video | pdf | document | html | note`), non-empty strings, bounded arrays for tags and collections, and valid numerical timestamps.
- **SharedConfig Structure**: Contains synchronized categories, coordinate mapping configurations, and structured dimensions of frames.
- **Size Bounds**: String character counts must be strictly capped (e.g., titles under 200 chars, ids under 128 chars) to prevent recursive memory overflow and denial-of-wallet payload attacks.

---

## 2. The "Dirty Dozen" Threat Payloads

### Payload 1: Large ID Poisoning Attack
Attempting to create or target a card document using a malformed, ultra-long generated key string containing junk characters.
```json
{
  "id": "item_id_99999999999999999999999999999999999999999999999999999999999999999999999999999999998888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888",
  "type": "link",
  "url": "https://example.com",
  "title": "Poison ID Test",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 2: Invalid Asset Type Enumeration
Writing an asset utilizing a typed category not recognized by the specification.
```json
{
  "id": "item_123",
  "type": "unsupported_malicious_type",
  "url": "https://example.com/item",
  "title": "Bad Type",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 3: Missing Required Properties on Creation
Creating a card that is missing required properties like `url` and `title`.
```json
{
  "id": "item_124",
  "type": "link",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 4: Overly Massive Title Injection (Resource Exhaustion)
Injecting a title string exceeding 200 characters to overwhelm frontend memory lists.
```json
{
  "id": "item_125",
  "type": "link",
  "url": "https://example.com/massive",
  "title": "UltraLongTitleStringSaturatingFirestoreAndExhaustingWalletBalanceUltraLongTitleStringSaturatingFirestoreAndExhaustingWalletBalanceUltraLongTitleStringSaturatingFirestoreAndExhaustingWalletBalanceUltraLongTitleStringSaturating",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 5: Invalid Data Type on Field (Type Poisoning)
Supplying an integer value in place of a string URL parameter to exploit dynamic decoding scripts.
```json
{
  "id": "item_126",
  "type": "link",
  "url": 1234567,
  "title": "Dynamic Crash Test",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 6: Malformed Non-List Array Fields
Injecting standard strings inside array parameters like `tags` or `collections` triggers typing faults.
```json
{
  "id": "item_127",
  "type": "image",
  "url": "https://example.com/asset.jpg",
  "title": "Bad Array Structure",
  "tags": "not-an-array",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 7: Negative Counter Forcing (Integer Underflow Attempt)
Writing an item with a negative open count to cause underflow or negative views.
```json
{
  "id": "item_128",
  "type": "image",
  "url": "https://example.com/asset.jpg",
  "title": "Negative count",
  "openCount": -10,
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "favorite": false
}
```

### Payload 8: Immutable Field Amendment (createdAt)
Altering historical creation timestamps of existing visual board cards.
```json
{
  "id": "existing-item-55",
  "type": "link",
  "url": "https://example.com/test",
  "title": "Altered CreatedAt",
  "createdAt": 10000000,
  "updatedAt": 1720000000000,
  "openCount": 5,
  "favorite": false
}
```

### Payload 9: Shadow Field Injection (Ghost Field Protection)
Writing custom state properties like `isVerified` on items to attempt privilege escalation.
```json
{
  "id": "item_129",
  "type": "link",
  "url": "https://example.com",
  "title": "Ghost Field Attack",
  "isAdminVerified": true,
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 10: Invalid Config Schema (Malformed Categories Array)
Attempting to save global synchronization categories using a single flat string value instead of a string list.
```json
{
  "collections": "invalid-non-array",
  "canvasPositions": {}
}
```

### Payload 11: Out-of-Bound Tags List (Memory Bloat Protection)
Assigning more than 20 tags to a single item to inflate memory consumption.
```json
{
  "id": "item_130",
  "type": "link",
  "url": "https://example.com",
  "title": "Too Many Tags",
  "tags": ["t1","t2","t3","t4","t5","t6","t7","t8","t9","t10","t11","t12","t13","t14","t15","t16","t17","t18","t19","t20","t21","t22"],
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "openCount": 0,
  "favorite": false
}
```

### Payload 12: Invalid Timestamp Range (Future Date Poisoning)
Altering update timestamps with artificial parameters representing long distant future years.
```json
{
  "id": "item_131",
  "type": "link",
  "url": "https://example.com",
  "title": "Future Epoch",
  "createdAt": 1720000000000,
  "updatedAt": 999999999999999,
  "openCount": 1,
  "favorite": false
}
```

---

## 3. Test Assertions
All of the "Dirty Dozen" malformed structural payloads above must be strictly rejected with a `PERMISSION_DENIED` status by the Firestore rules processing layer, preserving absolute system state validity.
