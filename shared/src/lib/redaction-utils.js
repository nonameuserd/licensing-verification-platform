"use strict";
/**
 * PII Redaction Utilities
 * @fileoverview Utility functions for detecting and redacting personally identifiable information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REDACTION_CONFIG = exports.DEFAULT_PII_PATTERNS = void 0;
exports.redactString = redactString;
exports.redactObject = redactObject;
exports.isPIIField = isPIIField;
exports.createSafeLogObject = createSafeLogObject;
/**
 * Default PII field patterns for common sensitive data
 */
exports.DEFAULT_PII_PATTERNS = [
    // Personal identifiers
    {
        pattern: /^(ssn|socialSecurityNumber)$/i,
        method: 'mask',
        replacement: '***-**-****',
    },
    {
        pattern: /^(licenseNumber|license_number)$/i,
        method: 'mask',
        replacement: '****-****',
    },
    {
        pattern: /driverLicense|driver_license/i,
        method: 'mask',
        replacement: '****-****',
    },
    // Personal information (from authentication system)
    {
        pattern: /^(dateOfBirth|holderDOB|dob|date_of_birth)$/i,
        method: 'mask',
        replacement: '****-**-**',
    },
    {
        pattern: /^(firstName|first_name|givenName)$/i,
        method: 'mask',
        replacement: '***',
    },
    {
        pattern: /^(lastName|last_name|surname|familyName)$/i,
        method: 'mask',
        replacement: '***',
    },
    {
        pattern: /^(holderName|fullName|completeName)$/i,
        method: 'mask',
        replacement: '*** ***',
    },
    // Contact information
    {
        pattern: /^(email|emailAddress)$/i,
        method: 'mask',
        replacement: '***@***.***',
    },
    {
        pattern: /^(phone|phoneNumber|telephone)$/i,
        method: 'mask',
        replacement: '(***) ***-****',
    },
    // Address information
    {
        pattern: /^(address|streetAddress)$/i,
        method: 'replace',
        replacement: '[ADDRESS_REDACTED]',
    },
    { pattern: /^(zipCode|postalCode)$/i, method: 'mask', replacement: '*****' },
    // Financial information
    {
        pattern: /^(creditCard|cardNumber)$/i,
        method: 'mask',
        replacement: '****-****-****-****',
    },
    {
        pattern: /^(bankAccount|accountNumber)$/i,
        method: 'mask',
        replacement: '****-****',
    },
    // Medical information
    {
        pattern: /^(medicalRecord|patientId)$/i,
        method: 'replace',
        replacement: '[MEDICAL_ID_REDACTED]',
    },
    {
        pattern: /^(diagnosis|medicalHistory)$/i,
        method: 'replace',
        replacement: '[MEDICAL_INFO_REDACTED]',
    },
    // Credential-specific fields
    {
        pattern: /^(credentialId|credential_id)$/i,
        method: 'mask',
        replacement: '***-****-******',
    },
    {
        pattern: /^(proofHash|proof_hash|zkpProof)$/i,
        method: 'mask',
        replacement: '0x****...****',
    },
    // Authentication
    { pattern: /^(password|passwd)$/i, method: 'remove' },
    { pattern: /^(token|apiKey|secret)$/i, method: 'remove' },
    { pattern: /^(authorization|auth)$/i, method: 'remove' },
    // Generic PII markers
    {
        pattern: /^(pii|personalData|sensitiveData)$/i,
        method: 'replace',
        replacement: '[PII_REDACTED]',
    },
];
/**
 * Default redaction configuration
 */
exports.DEFAULT_REDACTION_CONFIG = {
    defaultMethod: 'replace',
    defaultReplacement: '[REDACTED]',
    customFields: exports.DEFAULT_PII_PATTERNS,
    removeFields: false,
};
/**
 * Redacts PII from a string value
 */
function redactString(value, fieldName, config) {
    if (!value || typeof value !== 'string') {
        return value;
    }
    // Find matching PII pattern
    const matchingField = config.customFields.find((field) => {
        if (typeof field.pattern === 'string') {
            return fieldName.toLowerCase().includes(field.pattern.toLowerCase());
        }
        return field.pattern.test(fieldName);
    });
    if (matchingField) {
        return applyRedactionMethod(value, matchingField.method, matchingField.replacement);
    }
    // Apply default redaction if no specific pattern matches
    return applyRedactionMethod(value, config.defaultMethod, config.defaultReplacement);
}
/**
 * Applies the specified redaction method to a value
 */
function applyRedactionMethod(value, method, replacement) {
    switch (method) {
        case 'remove':
            return '[REMOVED]';
        case 'hash':
            return `[HASHED_${hashString(value)}]`;
        case 'mask':
            return maskString(value, replacement);
        case 'replace':
        default:
            return replacement || '[REDACTED]';
    }
}
/**
 * Masks a string value while preserving some structure
 */
function maskString(value, mask) {
    if (!mask) {
        return '*'.repeat(Math.min(value.length, 8));
    }
    // For email masking, use a specific pattern
    if (mask === '***@***.***') {
        return '***@***.***';
    }
    // For SSN masking
    if (mask === '***-**-****') {
        return '***-**-****';
    }
    // For phone masking
    if (mask === '(***) ***-****') {
        return '(***) ***-****';
    }
    // For license number masking
    if (mask === '****-****') {
        return '****-****';
    }
    // For date of birth masking
    if (mask === '****-**-**') {
        return '****-**-**';
    }
    // For name masking (first/last name)
    if (mask === '***') {
        return '***';
    }
    // For full name masking
    if (mask === '*** ***') {
        return '*** ***';
    }
    // For credential ID masking
    if (mask === '***-****-******') {
        return '***-****-******';
    }
    // For proof hash masking
    if (mask === '0x****...****') {
        return '0x****...****';
    }
    // Default masking - return the mask pattern as-is
    return mask;
}
/**
 * Creates a simple hash of a string for logging purposes
 */
function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
}
/**
 * Recursively redacts PII from an object
 */
function redactObject(obj, config = exports.DEFAULT_REDACTION_CONFIG, visited = new WeakSet()) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        return obj; // String redaction handled at field level
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => {
            if (typeof item === 'string') {
                // Don't redact strings in arrays unless they're clearly PII
                return item;
            }
            return redactObject(item, config, visited);
        });
    }
    if (typeof obj === 'object') {
        // Check for circular references
        if (visited.has(obj)) {
            return '[CIRCULAR_REFERENCE]';
        }
        visited.add(obj);
        const redacted = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Only redact if it's a PII field
                if (isPIIField(key, config.customFields)) {
                    redacted[key] = redactString(value, key, config);
                }
                else {
                    redacted[key] = value;
                }
            }
            else {
                redacted[key] = redactObject(value, config, visited);
            }
        }
        return redacted;
    }
    return obj;
}
/**
 * Checks if a field name matches PII patterns
 */
function isPIIField(fieldName, patterns = exports.DEFAULT_PII_PATTERNS) {
    return patterns.some((field) => {
        if (typeof field.pattern === 'string') {
            return fieldName.toLowerCase().includes(field.pattern.toLowerCase());
        }
        return field.pattern.test(fieldName);
    });
}
/**
 * Creates a safe version of an object for logging
 */
function createSafeLogObject(obj, config = exports.DEFAULT_REDACTION_CONFIG) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    const safe = {};
    for (const [key, value] of Object.entries(obj)) {
        if (isPIIField(key, config.customFields)) {
            if (config.removeFields) {
                // Skip PII fields entirely
                continue;
            }
            else {
                safe[key] =
                    typeof value === 'string'
                        ? redactString(value, key, config)
                        : '[PII_REDACTED]';
            }
        }
        else {
            safe[key] = redactObject(value, config);
        }
    }
    return safe;
}
