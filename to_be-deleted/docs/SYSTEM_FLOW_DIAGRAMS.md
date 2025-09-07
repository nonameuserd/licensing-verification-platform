# System Flow Diagrams

## Overview

This document contains comprehensive flow diagrams showing how the licensing verification platform works from credential creation to verification. The diagrams illustrate the complete user journey and system interactions.

## 1. Credential Creation Flow

### **Licensing Board Creates Credential**

```mermaid
graph TD
    A[Licensing Board Admin] -->|Login to Dashboard| B[Admin Dashboard]
    B -->|Submit Credential Data| C[Credential Submission Form]
    C -->|Validate Data| D[Data Validation]
    D -->|Generate ZKP Proof| E[ZKP Proof Generation]
    E -->|Store Credential| F[Credential Database]
    F -->|Generate Credential ID| G[Unique Credential ID]
    G -->|Store Verification Data| H[Verification Registry]
    H -->|Update Database| I[Backend Database]
    I -->|Send Confirmation| J[Admin Dashboard]
    J -->|Display Success| K[Credential Created]

    D -->|Invalid Data| L[Show Error Message]
    L --> C
```

### **Detailed Steps**

1. **Admin Login**: Licensing board admin logs into the web dashboard
2. **Credential Submission**: Admin fills out credential form with:
   - Holder name and personal information
   - License number
   - Exam ID and achievement level
   - Issue and expiry dates
3. **Data Validation**: System validates all required fields
4. **ZKP Generation**: System generates zero-knowledge proof for privacy
5. **Credential Storage**: Credential data is stored in secure database
6. **ID Generation**: Unique credential ID is generated (e.g., MED-2024-001234)
7. **Verification Registry**: Credential is added to verification registry
8. **Database Update**: Backend database is updated with credential info
9. **Confirmation**: Admin receives confirmation of successful creation

## 2. Credential Verification Flow

### **Employer Verifies Credential**

```mermaid
graph TD
    A[Employer/HR System] -->|API Request| B[Verification API]
    B -->|Authenticate| C[API Key Validation]
    C -->|Valid Key| D[Rate Limit Check]
    D -->|Within Limits| E[Parse Request]
    E -->|Check Method| F{Verification Method}

    F -->|Credential ID| G[Lookup by Credential ID]
    F -->|License Number| H[Lookup by License Number]
    F -->|Personal Info| I[Lookup by Personal Info]

    G --> J[Query Blockchain]
    H --> J
    I --> J

    J -->|Find Credential| K[Check Status]
    K -->|Active| L[Generate Response]
    K -->|Suspended| M[Return Suspended Status]
    K -->|Expired| N[Return Expired Status]

    L -->|Log Request| O[Audit Log]
    M --> O
    N --> O

    O -->|Return Response| P[Employer Receives Result]

    C -->|Invalid Key| Q[Return 401 Unauthorized]
    D -->|Rate Limited| R[Return 429 Too Many Requests]
    J -->|Not Found| S[Return 404 Not Found]
```

### **Verification Methods**

#### **Method 1: Credential ID Verification**

```typescript
POST /api/v1/verify/credential
{
  "credentialId": "MED-2024-001234",
  "examId": "medical-license-2024"
}
```

#### **Method 2: License Number Verification**

```typescript
POST /api/v1/verify/credential
{
  "licenseNumber": "MD123456",
  "examId": "medical-license-2024"
}
```

#### **Method 3: Personal Information Verification**

```typescript
POST /api/v1/verify/credential
{
  "firstName": "John",
  "lastName": "Smith",
  "dateOfBirth": "1980-05-15",
  "examId": "medical-license-2024"
}
```

## 3. Batch Verification Flow

### **Multiple Credentials Verification**

```mermaid
graph TD
    A[Employer System] -->|Batch Request| B[Batch Verification API]
    B -->|Authenticate| C[API Key Validation]
    C -->|Valid| D[Parse Batch Request]
    D -->|Split Requests| E[Individual Verifications]

    E --> F[Verification 1]
    E --> G[Verification 2]
    E --> H[Verification N]

    F --> I[Process Verification]
    G --> I
    H --> I

    I -->|All Complete| J[Aggregate Results]
    J -->|Log Batch| K[Audit Log]
    K -->|Return Results| L[Batch Response]

    I -->|Some Failed| M[Partial Results]
    M --> K
```

### **Batch Request Example**

```typescript
POST /api/v1/verify/batch
{
  "verifications": [
    {
      "credentialId": "MED-2024-001234",
      "examId": "medical-license-2024"
    },
    {
      "licenseNumber": "MD123456",
      "examId": "medical-license-2024"
    },
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "examId": "medical-license-2024"
    }
  ]
}
```

## 4. Cross-Board Verification Flow

### **Verify Across Multiple Licensing Boards**

```mermaid
graph TD
    A[Employer] -->|Cross-Board Request| B[Cross-Board API]
    B -->|Authenticate| C[API Key Validation]
    C -->|Valid| D[Parse Request]
    D -->|Extract Credential ID| E[Primary Credential Lookup]

    E -->|Find Credential| F[Get Issuing Board]
    F -->|Check Target Boards| G{Target Boards Specified}

    G -->|Yes| H[Verify Against Target Boards]
    G -->|No| I[Verify Against All Boards]

    H --> J[Board 1 Verification]
    H --> K[Board 2 Verification]
    H --> L[Board N Verification]

    I --> M[Query All Boards]
    M --> N[Check Each Board]

    J --> O[Aggregate Results]
    K --> O
    L --> O
    N --> O

    O -->|Log Request| P[Audit Log]
    P -->|Return Results| Q[Cross-Board Response]
```

## 5. Document Verification Flow

### **Verify Document Authenticity**

```mermaid
graph TD
    A[Employer] -->|Document Upload| B[Document Verification API]
    B -->|Authenticate| C[API Key Validation]
    C -->|Valid| D[Document Processing]

    D -->|Extract Hash| E[Calculate Document Hash]
    E -->|Compare| F[Compare with Stored Hash]
    F -->|Match| G[Document Authentic]
    F -->|No Match| H[Document Tampered]

    G -->|Check Metadata| I[Verify Metadata]
    H -->|Check Metadata| I

    I -->|Valid| J[Generate Authenticity Score]
    I -->|Invalid| K[Lower Authenticity Score]

    J -->|Log Verification| L[Audit Log]
    K --> L
    L -->|Return Result| M[Document Verification Response]
```

## 6. Real-Time Status Check Flow

### **Check Credential Status**

```mermaid
graph TD
    A[Employer] -->|Status Request| B[Status Check API]
    B -->|Authenticate| C[API Key Validation]
    C -->|Valid| D[Parse Request]
    D -->|Extract Credential ID| E[Lookup Credential]

    E -->|Find Credential| F[Check Database Status]
    F -->|Query Credential Registry| G[Verification Database]
    G -->|Get Status| H[Active/Suspended/Expired]

    H -->|Check History| I[Get Status History]
    I -->|Check Violations| J[Get Violations]
    J -->|Check Renewals| K[Get Renewal Info]

    K -->|Aggregate Status| L[Build Status Response]
    L -->|Log Request| M[Audit Log]
    M -->|Return Status| N[Status Response]
```

## 7. Admin Dashboard Flow

### **Licensing Board Management**

```mermaid
graph TD
    A[Admin Login] -->|Credentials| B[Credential Management]
    A -->|Users| C[User Management]
    A -->|Analytics| D[Analytics Dashboard]
    A -->|Settings| E[Organization Settings]

    B -->|Create| F[New Credential Form]
    B -->|View| G[Credential List]
    B -->|Edit| H[Edit Credential]
    B -->|Suspend| I[Suspend Credential]

    F -->|Submit| J[Credential Creation Flow]
    H -->|Update| K[Credential Update Flow]
    I -->|Confirm| L[Credential Suspension Flow]

    C -->|Add User| M[Add User Form]
    C -->|Manage Roles| N[Role Management]
    C -->|View Users| O[User List]

    D -->|View Metrics| P[Usage Analytics]
    D -->|Export Reports| Q[Report Generation]

    E -->|Update Info| R[Organization Update]
    E -->|API Keys| S[API Key Management]
    E -->|Billing| T[Billing Management]
```

## 8. Error Handling Flow

### **System Error Management**

```mermaid
graph TD
    A[API Request] -->|Error Occurs| B[Error Detection]
    B -->|Categorize| C{Error Type}

    C -->|Authentication| D[401 Unauthorized]
    C -->|Rate Limit| E[429 Too Many Requests]
    C -->|Not Found| F[404 Not Found]
    C -->|Validation| G[400 Bad Request]
    C -->|Server Error| H[500 Internal Server Error]

    D -->|Log Error| I[Error Logging]
    E -->|Log Error| I
    F -->|Log Error| I
    G -->|Log Error| I
    H -->|Log Error| I

    I -->|Generate Response| J[Error Response]
    J -->|Return to Client| K[Client Receives Error]

    H -->|Alert Admin| L[Admin Notification]
    L -->|Investigate| M[Error Investigation]
    M -->|Fix Issue| N[Issue Resolution]
```

## 9. Security Flow

### **Security and Compliance**

```mermaid
graph TD
    A[Request] -->|Security Check| B[Rate Limiting]
    B -->|Within Limits| C[Authentication]
    B -->|Exceeded| D[Rate Limit Response]

    C -->|Valid| E[Authorization]
    C -->|Invalid| F[Authentication Error]

    E -->|Authorized| F[Request Processing]
    E -->|Unauthorized| G[Authorization Error]

    F -->|Process| H[Business Logic]
    H -->|Success| I[Response Generation]
    H -->|Error| J[Error Handling]

    I -->|Log Success| K[Audit Log]
    J -->|Log Error| K

    K -->|Compliance Check| L[Data Retention]
    L -->|Return Response| M[Client Response]

    D -->|Log Rate Limit| K
    F -->|Log Auth Error| K
    G -->|Log Auth Error| K
```

## 10. Data Flow Architecture

### **Complete System Data Flow**

```mermaid
graph TD
    A[Licensing Board] -->|Credential Data| B[Admin Dashboard]
    B -->|API Call| C[Backend API]
    C -->|Process| D[Business Logic]
    D -->|Generate ZKP| E[ZKP Service]
    E -->|Store| F[Credential Database]
    F -->|Generate ID| G[Credential Registry]
    G -->|Store| H[Verification Database]
    H -->|Event| I[Event Listener]
    I -->|Update| J[Database]

    K[Employer] -->|Verification Request| L[Verification API]
    L -->|Authenticate| M[Auth Service]
    M -->|Query| N[Database]
    N -->|Check| O[Credential Registry]
    O -->|Verify| P[Verification Service]
    P -->|Response| Q[API Response]
    Q -->|Return| K

    R[Admin] -->|Management| S[Admin API]
    S -->|Update| T[Database]
    T -->|Sync| U[Credential Registry]
    U -->|Update| V[Verification Service]
```

## 11. API Response Examples

### **Successful Verification Response**

```json
{
  "verified": true,
  "credential": {
    "credentialId": "MED-2024-001234",
    "examId": "medical-license-2024",
    "achievementLevel": "Passed",
    "issuedDate": "2024-01-15",
    "expiryDate": "2026-01-15",
    "issuer": "California Medical Board",
    "holderName": "Dr. John Smith",
    "licenseNumber": "MD123456"
  },
  "proofHash": "0xabcd...",
  "verificationTimestamp": "2024-01-15T10:30:00Z"
}
```

### **Error Response**

```json
{
  "verified": false,
  "error": {
    "code": "CREDENTIAL_NOT_FOUND",
    "message": "Credential with ID MED-2024-001234 not found",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### **Batch Verification Response**

```json
{
  "results": [
    {
      "verified": true,
      "credentialId": "MED-2024-001234",
      "credential": {
        /* credential data */
      }
    },
    {
      "verified": false,
      "credentialId": "MED-2024-001235",
      "error": {
        /* error data */
      }
    }
  ],
  "summary": {
    "total": 2,
    "verified": 1,
    "failed": 1
  }
}
```

## 12. Performance Metrics

### **System Performance Flow**

```mermaid
graph TD
    A[Request] -->|Start Timer| B[Performance Monitoring]
    B -->|Process Request| C[Business Logic]
    C -->|Database Query| D[Database Performance]
    C -->|Blockchain Query| E[Blockchain Performance]

    D -->|Query Time| F[Database Metrics]
    E -->|Query Time| G[Blockchain Metrics]

    F -->|Aggregate| H[Performance Metrics]
    G -->|Aggregate| H

    H -->|Log Metrics| I[Metrics Database]
    I -->|Generate Reports| J[Performance Reports]

    H -->|Check Thresholds| K{Performance OK}
    K -->|Yes| L[Continue Processing]
    K -->|No| M[Alert Admin]

    L -->|Complete Request| N[Response]
    M -->|Investigate| O[Performance Investigation]
```

## Conclusion

These flow diagrams provide a comprehensive view of how the licensing verification platform works. They show the complete user journey from credential creation to verification, including error handling, security, and performance monitoring. The diagrams help developers understand the system architecture and implement the various components correctly.
