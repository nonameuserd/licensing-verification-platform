import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class LicensingVerificationPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for credential storage
    const credentialsTable = new dynamodb.TableV2(this, 'CredentialsTable', {
      tableName: 'licensing-verification-credentials',
      partitionKey: {
        name: 'credentialId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Add GSI for organization-based queries
    credentialsTable.addGlobalSecondaryIndex({
      indexName: 'OrganizationIndex',
      partitionKey: {
        name: 'organizationId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Lambda function for the backend API
    const backendLambda = new lambda.Function(this, 'BackendLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset('../../../backend/dist'),
      environment: {
        CREDENTIALS_TABLE_NAME: credentialsTable.tableName,
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Grant DynamoDB permissions to Lambda
    credentialsTable.grantReadWriteData(backendLambda);

    // API Gateway for the backend
    const api = new apigateway.RestApi(this, 'LicensingVerificationApi', {
      restApiName: 'Licensing Verification Platform API',
      description: 'API for professional licensing verification platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(backendLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Gateway routes
    const verificationResource = api.root.addResource('verification');
    verificationResource.addMethod('POST', lambdaIntegration);
    verificationResource.addMethod('GET', lambdaIntegration);

    const credentialsResource = api.root.addResource('credentials');
    credentialsResource.addMethod('GET', lambdaIntegration);
    credentialsResource.addMethod('POST', lambdaIntegration);
    credentialsResource.addMethod('PUT', lambdaIntegration);
    credentialsResource.addMethod('DELETE', lambdaIntegration);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL for the licensing verification platform',
    });

    // Output the DynamoDB table name
    new cdk.CfnOutput(this, 'CredentialsTableName', {
      value: credentialsTable.tableName,
      description: 'DynamoDB table name for credentials storage',
    });
  }
}
