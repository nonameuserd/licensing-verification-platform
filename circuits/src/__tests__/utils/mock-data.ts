/**
 * Mock data for ZK-SNARK circuit testing
 * Provides realistic test data for various scenarios
 */

export const MOCK_CREDENTIALS = {
  // Valid medical credentials
  validMedical: {
    credentialId: 'MED-2024-001234',
    holderName: 'Dr. John Smith',
    licenseNumber: 'MD123456',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0xabcd1234567890abcdef1234567890abcdef123456',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  validMedical2: {
    credentialId: 'MED-2024-001235',
    holderName: 'Dr. Jane Doe',
    licenseNumber: 'MD789012',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-02-01',
    expiryDate: '2026-02-01',
    issuer: 'Texas Medical Board',
    holderDOB: '1985-03-22',
    proofHash: '0xbcde2345678901bcde2345678901bcde2345678901',
    isActive: true,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
  },

  // Valid legal credentials
  validLegal: {
    credentialId: 'LAW-2024-005678',
    holderName: 'Attorney Sarah Johnson',
    licenseNumber: 'BAR123456',
    examId: 'bar-exam-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-10',
    expiryDate: '2026-01-10',
    issuer: 'California State Bar',
    holderDOB: '1982-07-08',
    proofHash: '0xcdef3456789012cdef3456789012cdef3456789012',
    isActive: true,
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },

  // Valid engineering credentials
  validEngineering: {
    credentialId: 'ENG-2024-009876',
    holderName: 'PE Michael Chen',
    licenseNumber: 'PE345678',
    examId: 'pe-exam-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-20',
    expiryDate: '2026-01-20',
    issuer: 'California Board of Professional Engineers',
    holderDOB: '1978-11-14',
    proofHash: '0xdef4567890123def4567890123def4567890123d',
    isActive: true,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },

  // Invalid credentials
  invalidMedical: {
    credentialId: 'MED-2024-INVALID',
    holderName: 'Dr. Invalid User',
    licenseNumber: 'INVALID123',
    examId: 'medical-license-2024',
    achievementLevel: 'Failed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0x0000000000000000000000000000000000000000',
    isActive: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Expired credentials
  expiredMedical: {
    credentialId: 'MED-2020-999999',
    holderName: 'Dr. Expired User',
    licenseNumber: 'MD999999',
    examId: 'medical-license-2020',
    achievementLevel: 'Passed',
    issuedDate: '2020-01-15',
    expiryDate: '2022-01-15', // Expired
    issuer: 'California Medical Board',
    holderDOB: '1975-12-01',
    proofHash: '0x1111111111111111111111111111111111111111',
    isActive: false,
    createdAt: '2020-01-15T10:00:00Z',
    updatedAt: '2022-01-15T23:59:59Z',
  },

  // Suspended credentials
  passedMedical: {
    credentialId: 'MED-2024-888888',
    holderName: 'Dr. Passed User',
    licenseNumber: 'MD888888',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1983-09-30',
    proofHash: '0x2222222222222222222222222222222222222222',
    isActive: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Revoked credentials
  revokedMedical: {
    credentialId: 'MED-2024-777777',
    holderName: 'Dr. Revoked User',
    licenseNumber: 'MD777777',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1981-04-12',
    proofHash: '0x3333333333333333333333333333333333333333',
    isActive: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Edge cases
  emptyFields: {
    credentialId: '',
    holderName: '',
    licenseNumber: '',
    examId: '',
    achievementLevel: '',
    issuedDate: '',
    expiryDate: '',
    issuer: '',
    holderDOB: '',
    proofHash: '',
    isActive: false,
    createdAt: '',
    updatedAt: '',
  },

  specialCharacters: {
    credentialId: 'MED-2024-SPECIAL',
    holderName: 'Dr. José María García-López',
    licenseNumber: 'MD-123-456',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0x4444444444444444444444444444444444444444',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  longStrings: {
    credentialId: 'MED-2024-LONGSTR',
    holderName: 'Dr. ' + 'A'.repeat(1000),
    licenseNumber: 'MD-' + '1'.repeat(100),
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board - ' + 'B'.repeat(500),
    holderDOB: '1980-05-15',
    proofHash: '0x5555555555555555555555555555555555555555',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  unicodeStrings: {
    credentialId: 'MED-2024-UNICODE',
    holderName: 'Dr. 张医生 (Dr. Zhang)',
    licenseNumber: 'MD中文123',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0x6666666666666666666666666666666666666666',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
};

export const MOCK_NULLIFIERS = [
  '0xabcdef1234567890abcdef1234567890abcdef12',
  '0xfedcba0987654321fedcba0987654321fedcba09',
  '0x1234567890abcdef1234567890abcdef12345678',
  '0x9876543210fedcba9876543210fedcba98765432',
  '0x5555555555555555555555555555555555555555',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '0x1111111111111111111111111111111111111111',
  '0x9999999999999999999999999999999999999999',
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  '0xcafebabe1234567890abcdef1234567890abcdef',
];

export const MOCK_LICENSING_BOARDS = [
  'California Medical Board',
  'Texas Medical Board',
  'New York Medical Board',
  'Florida Medical Board',
  'Illinois Medical Board',
  'California State Bar',
  'New York State Bar',
  'Texas State Bar',
  'California Board of Professional Engineers',
  'Texas Board of Professional Engineers',
  'New York State Board for Engineering',
];

export const MOCK_EXAM_TYPES = [
  'medical-license-2024',
  'bar-exam-2024',
  'pe-exam-2024',
  'nursing-license-2024',
  'pharmacy-license-2024',
  'dental-license-2024',
  'veterinary-license-2024',
  'psychology-license-2024',
  'social-work-license-2024',
  'physical-therapy-license-2024',
];

export const MOCK_ACHIEVEMENT_LEVELS = [
  'Passed',
  'Failed',
  'Pending',
  'Under Review',
  'Conditional',
];

export const MOCK_DATES = {
  valid: [
    '2024-01-15',
    '2024-02-01',
    '2024-03-15',
    '2024-04-01',
    '2024-05-15',
    '2024-06-01',
    '2024-07-15',
    '2024-08-01',
    '2024-09-15',
    '2024-10-01',
  ],
  expired: ['2020-01-15', '2021-02-01', '2022-03-15', '2023-04-01'],
  future: ['2025-01-15', '2026-02-01', '2027-03-15', '2028-04-01'],
  invalid: [
    'invalid-date',
    '2024-13-01', // Invalid month
    '2024-02-30', // Invalid day
    '2024/01/15', // Wrong format
    '01-15-2024', // Wrong format
  ],
};

export const MOCK_NAMES = {
  english: [
    'Dr. John Smith',
    'Dr. Jane Doe',
    'Dr. Michael Johnson',
    'Dr. Sarah Williams',
    'Dr. David Brown',
    'Dr. Lisa Davis',
    'Dr. Robert Wilson',
    'Dr. Jennifer Garcia',
    'Dr. Christopher Martinez',
    'Dr. Amanda Anderson',
  ],
  international: [
    'Dr. José María García-López',
    'Dr. François Dubois',
    'Dr. 张医生 (Dr. Zhang)',
    'Dr. Ahmed Hassan',
    'Dr. Priya Patel',
    'Dr. Vladimir Petrov',
    'Dr. Maria Rodriguez',
    'Dr. Hans Mueller',
    'Dr. Yuki Tanaka',
    'Dr. Giovanni Rossi',
  ],
  special: [
    "Dr. O'Connor-Smith",
    'Dr. Jean-Pierre',
    'Dr. María José',
    'Dr. Van Der Berg',
    'Dr. MacLeod',
    'Dr. St. James',
    'Dr. De La Cruz',
    'Dr. Von Neumann',
    'Dr. Al-Rashid',
    "Dr. O'Malley",
  ],
};

export const MOCK_LICENSE_NUMBERS = {
  medical: ['MD123456', 'MD789012', 'MD345678', 'MD901234', 'MD567890'],
  legal: ['BAR123456', 'BAR789012', 'BAR345678', 'BAR901234', 'BAR567890'],
  engineering: ['PE123456', 'PE789012', 'PE345678', 'PE901234', 'PE567890'],
  nursing: ['RN123456', 'RN789012', 'RN345678', 'RN901234', 'RN567890'],
  pharmacy: ['RPH123456', 'RPH789012', 'RPH345678', 'RPH901234', 'RPH567890'],
};

export const MOCK_TEST_SCENARIOS = {
  validCredentials: [
    MOCK_CREDENTIALS.validMedical,
    MOCK_CREDENTIALS.validMedical2,
    MOCK_CREDENTIALS.validLegal,
    MOCK_CREDENTIALS.validEngineering,
  ],
  invalidCredentials: [
    MOCK_CREDENTIALS.invalidMedical,
    MOCK_CREDENTIALS.expiredMedical,
    MOCK_CREDENTIALS.passedMedical,
    MOCK_CREDENTIALS.revokedMedical,
  ],
  inactiveCredentials: [
    MOCK_CREDENTIALS.expiredMedical,
    MOCK_CREDENTIALS.passedMedical,
    MOCK_CREDENTIALS.revokedMedical,
  ],
  edgeCases: [
    MOCK_CREDENTIALS.emptyFields,
    MOCK_CREDENTIALS.specialCharacters,
    MOCK_CREDENTIALS.longStrings,
    MOCK_CREDENTIALS.unicodeStrings,
  ],
  mixedScenarios: [
    MOCK_CREDENTIALS.validMedical,
    MOCK_CREDENTIALS.invalidMedical,
    MOCK_CREDENTIALS.validLegal,
    MOCK_CREDENTIALS.expiredMedical,
    MOCK_CREDENTIALS.validEngineering,
    MOCK_CREDENTIALS.passedMedical,
  ],
  // New edge case scenarios based on authentication verification system
  credentialIdFormats: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: 'MED-2024-001234',
      examId: 'medical-license-2024',
    },
    {
      ...MOCK_CREDENTIALS.validLegal,
      credentialId: 'LAW-2024-005678',
      examId: 'bar-exam-2024',
    },
    {
      ...MOCK_CREDENTIALS.validEngineering,
      credentialId: 'ENG-2024-009876',
      examId: 'pe-exam-2024',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: 'NUR-2024-003456',
      examId: 'nursing-license-2024',
      licenseNumber: 'RN123456',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: 'PHM-2024-007890',
      examId: 'pharmacy-license-2024',
      licenseNumber: 'RPH123456',
    },
  ],
  personalInfoScenarios: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'Dr. John Smith',
      holderDOB: '1980-05-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'Dr. José María García-López',
      holderDOB: '1985-03-22',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'Dr. Jean-Pierre Dubois',
      holderDOB: '1978-11-14',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'Dr. 张医生 (Dr. Zhang)',
      holderDOB: '1982-07-08',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'Dr. Ahmed Hassan Al-Rashid',
      holderDOB: '1983-09-30',
    },
  ],
  crossBoardScenarios: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuer: 'California Medical Board',
      licenseNumber: 'MD-CA-123456',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuer: 'Texas Medical Board',
      licenseNumber: 'MD-TX-123456',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuer: 'New York Medical Board',
      licenseNumber: 'MD-NY-123456',
    },
    {
      ...MOCK_CREDENTIALS.validLegal,
      issuer: 'California State Bar',
      licenseNumber: 'BAR-CA-123456',
    },
    {
      ...MOCK_CREDENTIALS.validEngineering,
      issuer: 'California Board of Professional Engineers',
      licenseNumber: 'PE-CA-123456',
    },
  ],
  statusScenarios: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Passed',
      isActive: true,
      expiryDate: '2026-01-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Suspended',
      isActive: false,
      expiryDate: '2026-01-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Revoked',
      isActive: false,
      expiryDate: '2026-01-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Passed',
      isActive: false,
      expiryDate: '2020-01-15', // Expired
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Pending',
      isActive: false,
      expiryDate: '2026-01-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      achievementLevel: 'Conditional',
      isActive: true,
      expiryDate: '2026-01-15',
    },
  ],
  dateFormatScenarios: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: '2024-01-15',
      expiryDate: '2026-01-15',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: '2024-02-29', // Leap year
      expiryDate: '2026-02-28',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: '2024-12-31', // Year boundary
      expiryDate: '2026-12-31',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: '2024-01-01', // New year
      expiryDate: '2026-01-01',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: '2024-06-15', // Mid-year
      expiryDate: '2026-06-15',
    },
  ],
  documentVerificationScenarios: [
    {
      ...MOCK_CREDENTIALS.validMedical,
      proofHash: '0xabcd1234567890abcdef1234567890abcdef123456',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      proofHash: '0x0000000000000000000000000000000000000000',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      proofHash: '0xffffffffffffffffffffffffffffffffffffffff',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      proofHash: '0xbcde2345678901bcde2345678901bcde2345678901',
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      proofHash: '0xcdef3456789012cdef3456789012cdef3456789012',
    },
  ],
  malformedDataScenarios: [
    {
      holderName: null,
      licenseNumber: null,
      examId: null,
      achievementLevel: null,
      issuedDate: null,
      expiryDate: null,
      issuer: null,
      holderDOB: null,
    },
    {
      holderName: undefined,
      licenseNumber: undefined,
      examId: undefined,
      achievementLevel: undefined,
      issuedDate: undefined,
      expiryDate: undefined,
      issuer: undefined,
      holderDOB: undefined,
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      issuedDate: 'invalid-date',
      expiryDate: '2024-13-01', // Invalid month
    },
    {
      ...MOCK_CREDENTIALS.validMedical,
      holderName: 'A'.repeat(10000), // Too long
      licenseNumber: 'B'.repeat(1000), // Too long
      issuer: 'C'.repeat(5000), // Too long
    },
  ],
};

export const MOCK_PERFORMANCE_SCENARIOS = {
  smallBatch: Array(10)
    .fill(null)
    .map((_, index) => ({
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: `MED-2024-${index.toString().padStart(6, '0')}`,
      licenseNumber: `MD${index.toString().padStart(6, '0')}`,
      proofHash: `0x${index.toString(16).padStart(40, '0')}`,
    })),
  mediumBatch: Array(100)
    .fill(null)
    .map((_, index) => ({
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: `MED-2024-${index.toString().padStart(6, '0')}`,
      licenseNumber: `MD${index.toString().padStart(6, '0')}`,
      proofHash: `0x${index.toString(16).padStart(40, '0')}`,
    })),
  largeBatch: Array(1000)
    .fill(null)
    .map((_, index) => ({
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: `MED-2024-${index.toString().padStart(6, '0')}`,
      licenseNumber: `MD${index.toString().padStart(6, '0')}`,
      proofHash: `0x${index.toString(16).padStart(40, '0')}`,
    })),
  extremeBatch: Array(10000)
    .fill(null)
    .map((_, index) => ({
      ...MOCK_CREDENTIALS.validMedical,
      credentialId: `MED-2024-${index.toString().padStart(6, '0')}`,
      licenseNumber: `MD${index.toString().padStart(6, '0')}`,
      proofHash: `0x${index.toString(16).padStart(40, '0')}`,
    })),
};
