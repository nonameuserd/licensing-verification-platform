# Copilot Coding Standards - Professional Licensing Platform

## General Principles

### 1. Code Quality First

- **TypeScript Strict Mode**: Always use strict TypeScript with no `any` types
- **Test-Driven Development**: Write tests before implementing features
- **Documentation**: Every public function must have JSDoc comments
- **Error Handling**: Comprehensive error handling with proper logging
- **Security**: Security-first approach to all code

### 2. Architecture Patterns

- **Service Layer**: Business logic in service classes
- **Repository Pattern**: Data access through repositories
- **Middleware**: Cross-cutting concerns in middleware
- **Event-Driven**: Use events for loose coupling
- **Dependency Injection**: Use DI for testability

### 3. Performance & Scalability

- **Async/Await**: Use async/await instead of callbacks
- **Caching**: Implement caching at appropriate levels
- **Database Optimization**: Optimize queries and use indexes
- **Rate Limiting**: Implement rate limiting for all endpoints
- **Monitoring**: Add monitoring and alerting

## TypeScript Standards

### 1. Type Definitions

```typescript
// ✅ Good: Explicit types
interface CredentialVerificationRequest {
  credentialId: string;
  proof: string;
  publicSignals: string[];
  organizationId: string;
}

// ❌ Bad: Using any
function verifyCredential(data: any): any {
  // ...
}

// ✅ Good: Generic types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
```

### 2. Function Signatures

```typescript
// ✅ Good: Clear function signature
async function verifyCredential(
  request: CredentialVerificationRequest,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  // Implementation
}

// ❌ Bad: Unclear parameters
function verify(data: any, opts?: any): any {
  // ...
}
```

### 3. Error Handling

```typescript
// ✅ Good: Custom error classes
class VerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

// ✅ Good: Proper error handling
async function verifyCredential(request: CredentialVerificationRequest) {
  try {
    const result = await zkpService.verify(
      request.proof,
      request.publicSignals
    );
    return result;
  } catch (error) {
    if (error instanceof VerificationError) {
      throw error;
    }
    throw new VerificationError(
      'Failed to verify credential',
      'VERIFICATION_FAILED',
      500
    );
  }
}
```

## API Design Standards

### 1. RESTful Endpoints

```typescript
// ✅ Good: RESTful design
// GET /api/v1/credentials/:id
// POST /api/v1/credentials
// PUT /api/v1/credentials/:id
// DELETE /api/v1/credentials/:id

// ❌ Bad: Non-RESTful
// GET /api/v1/getCredentialById
// POST /api/v1/createCredential
```

### 2. Request/Response Format

```typescript
// ✅ Good: Consistent response format
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// ✅ Good: Validation
import { z } from 'zod';

const CredentialSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['medical', 'legal', 'engineering']),
  issuer: z.string().min(1),
  holder: z.string().min(1),
  issuedAt: z.date(),
  expiresAt: z.date().optional(),
});
```

### 3. Middleware Pattern

```typescript
// ✅ Good: Middleware composition
export const verificationMiddleware = [
  authMiddleware,
  quotaMiddleware,
  validationMiddleware(CredentialSchema),
  rateLimitMiddleware,
  auditMiddleware,
];

// ✅ Good: Middleware implementation
export const quotaMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const organizationId = req.user.organizationId;
  const quota = await quotaService.getQuota(organizationId);

  if (quota.exceeded) {
    throw new QuotaExceededError('Organization quota exceeded');
  }

  next();
};
```

## Database Standards

### 1. Repository Pattern

```typescript
// ✅ Good: Repository interface
interface CredentialRepository {
  findById(id: string): Promise<Credential | null>;
  findByHolder(holderId: string): Promise<Credential[]>;
  create(credential: CreateCredentialRequest): Promise<Credential>;
  update(id: string, updates: Partial<Credential>): Promise<Credential>;
  delete(id: string): Promise<void>;
}

// ✅ Good: Repository implementation
export class DynamoDBCredentialRepository implements CredentialRepository {
  constructor(private dynamodb: DynamoDBClient) {}

  async findById(id: string): Promise<Credential | null> {
    const result = await this.dynamodb
      .get({
        TableName: 'credentials',
        Key: { id },
      })
      .promise();

    return result.Item ? this.mapToCredential(result.Item) : null;
  }

  private mapToCredential(item: any): Credential {
    return {
      id: item.id,
      type: item.type,
      issuer: item.issuer,
      holder: item.holder,
      issuedAt: new Date(item.issuedAt),
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
    };
  }
}
```

### 2. Database Migrations

```typescript
// ✅ Good: Migration structure
export class CreateCredentialsTable implements Migration {
  async up(): Promise<void> {
    await this.dynamodb
      .createTable({
        TableName: 'credentials',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'holderId', AttributeType: 'S' },
          { AttributeName: 'issuerId', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'holder-index',
            KeySchema: [{ AttributeName: 'holderId', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
      .promise();
  }

  async down(): Promise<void> {
    await this.dynamodb
      .deleteTable({
        TableName: 'credentials',
      })
      .promise();
  }
}
```

## Service Layer Standards

### 1. Service Structure

```typescript
// ✅ Good: Service class structure
export class CredentialVerificationService {
  constructor(
    private zkpService: ZKPService,
    private credentialRepository: CredentialRepository,
    private fraudDetectionService: FraudDetectionService,
    private auditService: AuditService
  ) {}

  async verifyCredential(
    request: CredentialVerificationRequest
  ): Promise<VerificationResult> {
    // 1. Validate input
    await this.validateRequest(request);

    // 2. Check fraud detection
    const fraudRisk = await this.fraudDetectionService.assessRisk(request);
    if (fraudRisk.score > 0.8) {
      throw new HighFraudRiskError('High fraud risk detected');
    }

    // 3. Verify ZKP proof
    const verificationResult = await this.zkpService.verify(
      request.proof,
      request.publicSignals
    );

    // 4. Audit the verification
    await this.auditService.logVerification(request, verificationResult);

    // 5. Return result
    return verificationResult;
  }

  private async validateRequest(
    request: CredentialVerificationRequest
  ): Promise<void> {
    if (!request.credentialId || !request.proof) {
      throw new ValidationError('Missing required fields');
    }

    const credential = await this.credentialRepository.findById(
      request.credentialId
    );
    if (!credential) {
      throw new CredentialNotFoundError('Credential not found');
    }
  }
}
```

### 2. Error Handling in Services

```typescript
// ✅ Good: Service error handling
export class ZKPService {
  async verify(
    proof: string,
    publicSignals: string[]
  ): Promise<VerificationResult> {
    try {
      const result = await this.circuit.verify(proof, publicSignals);
      return {
        verified: result.verified,
        nullifier: result.nullifier,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('ZKP verification failed', { error, proof, publicSignals });
      throw new ZKPVerificationError('Proof verification failed');
    }
  }
}
```

## Testing Standards

### 1. Unit Tests

```typescript
// ✅ Good: Unit test structure
describe('CredentialVerificationService', () => {
  let service: CredentialVerificationService;
  let mockZkpService: jest.Mocked<ZKPService>;
  let mockCredentialRepository: jest.Mocked<CredentialRepository>;

  beforeEach(() => {
    mockZkpService = createMockZKPService();
    mockCredentialRepository = createMockCredentialRepository();
    service = new CredentialVerificationService(
      mockZkpService,
      mockCredentialRepository,
      mockFraudDetectionService,
      mockAuditService
    );
  });

  describe('verifyCredential', () => {
    it('should verify credential successfully', async () => {
      // Arrange
      const request = createValidVerificationRequest();
      mockCredentialRepository.findById.mockResolvedValue(
        createMockCredential()
      );
      mockZkpService.verify.mockResolvedValue(createMockVerificationResult());

      // Act
      const result = await service.verifyCredential(request);

      // Assert
      expect(result.verified).toBe(true);
      expect(mockZkpService.verify).toHaveBeenCalledWith(
        request.proof,
        request.publicSignals
      );
    });

    it('should throw error when credential not found', async () => {
      // Arrange
      const request = createValidVerificationRequest();
      mockCredentialRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyCredential(request)).rejects.toThrow(
        CredentialNotFoundError
      );
    });
  });
});
```

### 2. Integration Tests

```typescript
// ✅ Good: Integration test
describe('Credential Verification API', () => {
  let app: Express;
  let testDb: DynamoDBClient;

  beforeAll(async () => {
    app = createTestApp();
    testDb = createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  it('should verify credential end-to-end', async () => {
    // Arrange
    const credential = await createTestCredential();
    const verificationRequest = createTestVerificationRequest(credential.id);

    // Act
    const response = await request(app)
      .post('/api/v1/verify/credential')
      .send(verificationRequest)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.verified).toBe(true);
  });
});
```

## Security Standards

### 1. Input Validation

```typescript
// ✅ Good: Input validation
import { z } from 'zod';

const VerificationRequestSchema = z.object({
  credentialId: z.string().uuid(),
  proof: z.string().min(1),
  publicSignals: z.array(z.string()),
  organizationId: z.string().uuid(),
});

export const validationMiddleware = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid request data', error.errors);
      }
      throw error;
    }
  };
};
```

### 2. Authentication & Authorization

```typescript
// ✅ Good: JWT authentication
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = payload;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
};

// ✅ Good: Role-based authorization
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user.roles.some((role) => roles.includes(role))) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
};
```

### 3. Rate Limiting

```typescript
// ✅ Good: Rate limiting
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Good: Per-organization rate limiting
export const organizationRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const organizationId = req.user.organizationId;
  const key = `rate_limit:${organizationId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 3600); // 1 hour
  }

  if (current > 1000) {
    // 1000 requests per hour
    throw new RateLimitError('Organization rate limit exceeded');
  }

  next();
};
```

## Logging Standards

### 1. Structured Logging

```typescript
// ✅ Good: Structured logging
import { logger } from '../utils/logger';

export class CredentialVerificationService {
  async verifyCredential(
    request: CredentialVerificationRequest
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    logger.info('Starting credential verification', {
      credentialId: request.credentialId,
      organizationId: request.organizationId,
      requestId: request.requestId,
    });

    try {
      const result = await this.performVerification(request);

      logger.info('Credential verification completed', {
        credentialId: request.credentialId,
        verified: result.verified,
        duration: Date.now() - startTime,
        requestId: request.requestId,
      });

      return result;
    } catch (error) {
      logger.error('Credential verification failed', {
        credentialId: request.credentialId,
        error: error.message,
        duration: Date.now() - startTime,
        requestId: request.requestId,
      });

      throw error;
    }
  }
}
```

### 2. Audit Logging

```typescript
// ✅ Good: Audit logging
export class AuditService {
  async logVerification(
    request: CredentialVerificationRequest,
    result: VerificationResult
  ): Promise<void> {
    const auditEvent = {
      eventType: 'credential_verification',
      timestamp: new Date().toISOString(),
      userId: request.userId,
      organizationId: request.organizationId,
      credentialId: request.credentialId,
      verified: result.verified,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      requestId: request.requestId,
    };

    await this.auditRepository.create(auditEvent);
  }
}
```

## Performance Standards

### 1. Caching

```typescript
// ✅ Good: Caching implementation
export class CachedCredentialService {
  constructor(
    private credentialRepository: CredentialRepository,
    private redis: Redis
  ) {}

  async findById(id: string): Promise<Credential | null> {
    const cacheKey = `credential:${id}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const credential = await this.credentialRepository.findById(id);
    if (credential) {
      await this.redis.setex(cacheKey, 3600, JSON.stringify(credential));
    }

    return credential;
  }
}
```

### 2. Database Optimization

```typescript
// ✅ Good: Optimized database queries
export class OptimizedCredentialRepository {
  async findByHolder(
    holderId: string,
    limit: number = 100
  ): Promise<Credential[]> {
    const params = {
      TableName: 'credentials',
      IndexName: 'holder-index',
      KeyConditionExpression: 'holderId = :holderId',
      ExpressionAttributeValues: {
        ':holderId': holderId,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    const result = await this.dynamodb.query(params).promise();
    return result.Items?.map((item) => this.mapToCredential(item)) || [];
  }
}
```

## Documentation Standards

### 1. JSDoc Comments

````typescript
/**
 * Verifies a credential using zero-knowledge proofs
 *
 * @param request - The credential verification request
 * @param options - Optional verification options
 * @returns Promise resolving to verification result
 * @throws {ValidationError} When request data is invalid
 * @throws {CredentialNotFoundError} When credential doesn't exist
 * @throws {ZKPVerificationError} When proof verification fails
 *
 * @example
 * ```typescript
 * const result = await service.verifyCredential({
 *   credentialId: 'uuid',
 *   proof: 'zkp-proof',
 *   publicSignals: ['signal1', 'signal2']
 * });
 * ```
 */
async verifyCredential(
  request: CredentialVerificationRequest,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  // Implementation
}
````

### 2. API Documentation

```typescript
/**
 * @swagger
 * /api/v1/verify/credential:
 *   post:
 *     summary: Verify a credential
 *     description: Verifies a credential using zero-knowledge proofs
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credentialId
 *               - proof
 *               - publicSignals
 *             properties:
 *               credentialId:
 *                 type: string
 *                 format: uuid
 *                 description: The credential ID to verify
 *               proof:
 *                 type: string
 *                 description: The ZKP proof
 *               publicSignals:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Public signals for verification
 *     responses:
 *       200:
 *         description: Verification successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                     nullifier:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
```

## Code Review Checklist

### Before Submitting PR

- [ ] All tests pass
- [ ] Code coverage maintained
- [ ] No TypeScript errors
- [ ] ESLint warnings resolved
- [ ] JSDoc comments added
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Error handling implemented
- [ ] Logging added where appropriate
- [ ] Documentation updated

### During Code Review

- [ ] Code follows established patterns
- [ ] Business logic is correct
- [ ] Edge cases are handled
- [ ] Security vulnerabilities addressed
- [ ] Performance is acceptable
- [ ] Tests are comprehensive
- [ ] Documentation is clear
- [ ] Error messages are helpful
- [ ] Logging is appropriate
- [ ] Code is maintainable

This coding standards document ensures consistent, high-quality code across the professional licensing verification platform. Follow these standards to create maintainable, secure, and performant code.
