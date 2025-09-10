# Self-Hosted ELK Stack Implementation Guide

## Overview

This guide provides comprehensive instructions for implementing a self-hosted ELK (Elasticsearch, Logstash, Kibana) stack for the Professional Licensing Verification Platform. The ELK stack will provide centralized logging, real-time analysis, and privacy-focused log management for HIPAA compliance.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [ELK Stack Installation](#elk-stack-installation)
5. [Configuration](#configuration)
6. [Privacy and Security Configuration](#privacy-and-security-configuration)
7. [Integration with Privacy Logger](#integration-with-privacy-logger)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │    Logstash     │    │  Elasticsearch  │
│   (Node.js)     │───▶│   (Processing)  │───▶│   (Storage)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Kibana      │    │   Filebeat      │
                       │  (Visualization)│    │  (Log Shipper)  │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

### Components

- **Elasticsearch**: Distributed search and analytics engine for storing and indexing logs
- **Logstash**: Data processing pipeline for parsing, filtering, and transforming logs
- **Kibana**: Web interface for visualizing and analyzing log data
- **Filebeat**: Lightweight log shipper for collecting and forwarding logs

## Prerequisites

### System Requirements

- **CPU**: 4+ cores per node
- **RAM**: 8GB+ per node (16GB+ recommended for production)
- **Storage**: SSD with 100GB+ free space
- **Network**: 1Gbps+ bandwidth between nodes
- **OS**: Ubuntu 20.04+ or CentOS 8+

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Java 11+ (for Elasticsearch)
- Node.js 18+ (for application integration)

### AWS Infrastructure (if using AWS)

- EC2 instances (t3.large or larger)
- EBS volumes (gp3 for better performance)
- Security groups with proper port configurations
- VPC with private subnets for internal communication

## Infrastructure Setup

### 1. AWS CDK Infrastructure

Create the ELK stack infrastructure using AWS CDK:

```typescript
// infrastructure/lib/stacks/elk-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elasticsearch from 'aws-cdk-lib/aws-elasticsearch';
import { Construct } from 'constructs';

export class ElkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for ELK stack
    const vpc = new ec2.Vpc(this, 'ElkVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Security group for ELK cluster
    const elkSecurityGroup = new ec2.SecurityGroup(this, 'ElkSecurityGroup', {
      vpc,
      description: 'Security group for ELK stack',
    });

    // Allow internal communication
    elkSecurityGroup.addIngressRule(elkSecurityGroup, ec2.Port.allTraffic(), 'Internal ELK communication');

    // Allow Kibana access from application
    elkSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(5601), 'Kibana access');

    // Elasticsearch domain
    const elasticsearchDomain = new elasticsearch.Domain(this, 'ElasticsearchDomain', {
      version: elasticsearch.ElasticsearchVersion.V7_10,
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: 't3.small.elasticsearch',
      },
      ebs: {
        volumeSize: 20,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      securityGroups: [elkSecurityGroup],
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      domainEndpointOptions: {
        enforceHttps: true,
      },
      accessPolicies: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          principals: [new cdk.aws_iam.AnyPrincipal()],
          actions: ['es:*'],
          resources: ['*'],
        }),
      ],
    });

    // ECS Cluster for Logstash and Kibana
    const cluster = new ecs.Cluster(this, 'ElkCluster', {
      vpc,
      containerInsights: true,
    });

    // Logstash service
    const logstashService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'LogstashService', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('docker.elastic.co/logstash/logstash:7.17.0'),
        environment: {
          ELASTICSEARCH_HOSTS: elasticsearchDomain.domainEndpoint,
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'logstash',
        }),
      },
      desiredCount: 1,
      cpu: 512,
      memoryLimitMiB: 1024,
      publicLoadBalancer: false,
    });

    // Kibana service
    const kibanaService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'KibanaService', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('docker.elastic.co/kibana/kibana:7.17.0'),
        environment: {
          ELASTICSEARCH_HOSTS: elasticsearchDomain.domainEndpoint,
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'kibana',
        }),
      },
      desiredCount: 1,
      cpu: 512,
      memoryLimitMiB: 1024,
      publicLoadBalancer: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ElasticsearchEndpoint', {
      value: elasticsearchDomain.domainEndpoint,
      description: 'Elasticsearch endpoint',
    });

    new cdk.CfnOutput(this, 'KibanaEndpoint', {
      value: kibanaService.loadBalancer.loadBalancerDnsName,
      description: 'Kibana endpoint',
    });
  }
}
```

### 2. Docker Compose Setup (Alternative)

For local development or smaller deployments:

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms512m -Xmx512m'
      - xpack.security.enabled=true
      - xpack.security.authc.api_key.enabled=true
    ports:
      - '9200:9200'
      - '9300:9300'
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - elk

  logstash:
    image: docker.elastic.co/logstash/logstash:7.17.0
    container_name: logstash
    volumes:
      - ./logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - '5044:5044'
      - '5000:5000/tcp'
      - '5000:5000/udp'
      - '9600:9600'
    environment:
      LS_JAVA_OPTS: '-Xmx256m -Xms256m'
    networks:
      - elk
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    container_name: kibana
    ports:
      - '5601:5601'
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    networks:
      - elk
    depends_on:
      - elasticsearch

  filebeat:
    image: docker.elastic.co/beats/filebeat:7.17.0
    container_name: filebeat
    user: root
    volumes:
      - ./filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - elk
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:

networks:
  elk:
    driver: bridge
```

## ELK Stack Installation

### 1. Elasticsearch Configuration

```yaml
# elasticsearch/config/elasticsearch.yml
cluster.name: 'licensing-verification-logs'
node.name: 'node-1'
path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs
network.host: 0.0.0.0
http.port: 9200
discovery.type: single-node

# Security settings
xpack.security.enabled: true
xpack.security.authc.api_key.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.http.ssl.enabled: true

# Performance settings
indices.memory.index_buffer_size: 20%
indices.queries.cache.size: 10%
indices.fielddata.cache.size: 20%

# Log retention settings
action.auto_create_index: false
```

### 2. Logstash Configuration

```yaml
# logstash/config/logstash.yml
http.host: '0.0.0.0'
xpack.monitoring.elasticsearch.hosts: ['http://elasticsearch:9200']
```

```ruby
# logstash/pipeline/logstash.conf
input {
  beats {
    port => 5044
  }

  tcp {
    port => 5000
    codec => json_lines
  }

  udp {
    port => 5000
    codec => json_lines
  }
}

filter {
  # Parse JSON logs from our application
  if [message] =~ /^{.*}$/ {
    json {
      source => "message"
    }
  }

  # Add timestamp
  date {
    match => [ "timestamp", "ISO8601" ]
  }

  # Redact PII fields
  if [level] == "audit" {
    mutate {
      remove_field => [ "user.pii", "credential.sensitiveData", "proof.privateInputs" ]
    }
  }

  # Add service information
  mutate {
    add_field => { "service" => "licensing-verification-platform" }
  }

  # Parse verification logs
  if [action] {
    mutate {
      add_field => { "log_type" => "verification" }
    }
  }

  # Parse API logs
  if [method] and [url] {
    mutate {
      add_field => { "log_type" => "api" }
    }
  }

  # Parse security logs
  if [eventType] == "security" {
    mutate {
      add_field => { "log_type" => "security" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "licensing-verification-logs-%{+YYYY.MM.dd}"
    template_name => "licensing-verification-logs"
    template => "/usr/share/logstash/templates/licensing-verification-logs.json"
    template_overwrite => true
  }

  # Debug output (remove in production)
  stdout {
    codec => rubydebug
  }
}
```

### 3. Kibana Configuration

```yaml
# kibana/config/kibana.yml
server.name: kibana
server.host: '0.0.0.0'
elasticsearch.hosts: ['http://elasticsearch:9200']
monitoring.ui.container.elasticsearch.enabled: true

# Security settings
xpack.security.enabled: true
xpack.encryptedSavedObjects.encryptionKey: 'your-encryption-key-here'

# Index patterns
kibana.defaultAppId: 'discover'
```

### 4. Filebeat Configuration

```yaml
# filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/lib/docker/containers/*/*.log
    processors:
      - add_docker_metadata:
          host: 'unix:///var/run/docker.sock'
          match_fields: ['container.id']
          match_pids: ['process.pid']

output.logstash:
  hosts: ['logstash:5044']

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
```

## Configuration

### 1. Elasticsearch Index Template

```json
{
  "index_patterns": ["licensing-verification-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "index.lifecycle.name": "licensing-verification-policy",
      "index.lifecycle.rollover_alias": "licensing-verification-logs"
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "message": {
          "type": "text"
        },
        "service": {
          "type": "keyword"
        },
        "requestId": {
          "type": "keyword"
        },
        "organizationId": {
          "type": "keyword"
        },
        "verified": {
          "type": "boolean"
        },
        "duration": {
          "type": "long"
        },
        "log_type": {
          "type": "keyword"
        },
        "eventType": {
          "type": "keyword"
        }
      }
    }
  }
}
```

### 2. Index Lifecycle Management

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "10GB",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "1d",
        "actions": {
          "allocate": {
            "number_of_replicas": 0
          }
        }
      },
      "cold": {
        "min_age": "7d",
        "actions": {
          "allocate": {
            "number_of_replicas": 0
          }
        }
      },
      "delete": {
        "min_age": "30d"
      }
    }
  }
}
```

## Privacy and Security Configuration

### 1. HIPAA Compliance Settings

```yaml
# elasticsearch/config/elasticsearch.yml (additional security settings)
# Encryption at rest
xpack.security.enabled: true
xpack.security.authc.api_key.enabled: true

# Audit logging
xpack.security.audit.enabled: true
xpack.security.audit.logfile.events.include: ['access_granted', 'access_denied', 'anonymous_access_denied']

# Field-level security
xpack.security.authc.realms.native.native1:
  order: 0
  enabled: true

# Data retention
action.auto_create_index: false
```

### 2. Access Control

```bash
# Create roles for different access levels
curl -X POST "localhost:9200/_security/role/verification_admin" -H 'Content-Type: application/json' -d'
{
  "cluster": ["monitor"],
  "indices": [
    {
      "names": ["licensing-verification-logs-*"],
      "privileges": ["read", "write", "create_index", "manage"]
    }
  ]
}'

# Create user
curl -X POST "localhost:9200/_security/user/verification_admin" -H 'Content-Type: application/json' -d'
{
  "password": "secure_password",
  "roles": ["verification_admin"]
}'
```

### 3. PII Redaction in Logstash

```ruby
# Additional Logstash filters for PII redaction
filter {
  # Redact SSN patterns
  if [message] =~ /\b\d{3}-\d{2}-\d{4}\b/ {
    mutate {
      gsub => ["message", "\b\d{3}-\d{2}-\d{4}\b", "[SSN_REDACTED]"]
    }
  }

  # Redact email addresses
  if [message] =~ /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ {
    mutate {
      gsub => ["message", "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL_REDACTED]"]
    }
  }

  # Redact phone numbers
  if [message] =~ /\b\d{3}-\d{3}-\d{4}\b/ {
    mutate {
      gsub => ["message", "\b\d{3}-\d{3}-\d{4}\b", "[PHONE_REDACTED]"]
    }
  }
}
```

## Integration with Privacy Logger

### 1. Application Integration

```typescript
// backend/src/utils/elk-integration.ts
import { createPrivacyLogger } from '@licensing-verification-platform/shared';
import { Client } from '@elastic/elasticsearch';

export class ElkIntegration {
  private logger = createPrivacyLogger({
    level: process.env.LOG_LEVEL || 'info',
    auditMode: true,
    environment: process.env.NODE_ENV || 'development',
  });

  private elasticsearchClient: Client;

  constructor() {
    this.elasticsearchClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
    });
  }

  /**
   * Send logs directly to Elasticsearch (alternative to Logstash)
   */
  async sendLogToElasticsearch(logData: any): Promise<void> {
    try {
      await this.elasticsearchClient.index({
        index: `licensing-verification-logs-${new Date().toISOString().split('T')[0]}`,
        body: {
          '@timestamp': new Date().toISOString(),
          ...logData,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send log to Elasticsearch', error);
    }
  }

  /**
   * Create custom dashboard data
   */
  async createDashboardData(): Promise<void> {
    // Implementation for creating custom dashboards
    // This would typically be done through Kibana API or saved objects
  }
}
```

### 2. Environment Variables

```bash
# .env
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
KIBANA_URL=http://localhost:5601
LOG_LEVEL=info
LOG_RETENTION_DAYS=30
```

## Monitoring and Maintenance

### 1. Health Checks

```bash
#!/bin/bash
# health-check.sh

# Check Elasticsearch health
curl -X GET "localhost:9200/_cluster/health?pretty"

# Check Logstash status
curl -X GET "localhost:9600/_node/stats?pretty"

# Check Kibana status
curl -X GET "localhost:5601/api/status"
```

### 2. Log Rotation and Cleanup

```bash
#!/bin/bash
# cleanup-old-logs.sh

# Delete indices older than 30 days
curl -X DELETE "localhost:9200/licensing-verification-logs-$(date -d '30 days ago' '+%Y.%m.%d')"

# Force merge old indices
curl -X POST "localhost:9200/licensing-verification-logs-*/_forcemerge?max_num_segments=1"
```

### 3. Performance Monitoring

```yaml
# monitoring/grafana-dashboard.yml
apiVersion: 1

dashboards:
  - gnetId: 15141
    revision: 1
    datasource: elasticsearch
    title: 'ELK Stack Monitoring'
```

## Troubleshooting

### Common Issues

1. **Elasticsearch Out of Memory**

   ```bash
   # Increase heap size
   export ES_JAVA_OPTS="-Xms2g -Xmx2g"
   ```

2. **Logstash Pipeline Errors**

   ```bash
   # Check Logstash logs
   docker logs logstash

   # Test configuration
   docker exec logstash logstash --config.test_and_exit --path.config=/usr/share/logstash/pipeline
   ```

3. **Kibana Connection Issues**

   ```bash
   # Check Elasticsearch connectivity
   curl -X GET "localhost:9200/_cluster/health"

   # Restart Kibana
   docker restart kibana
   ```

### Performance Optimization

1. **Elasticsearch Settings**

   ```yaml
   # Increase refresh interval for better performance
   index.refresh_interval: 30s

   # Disable replicas for single-node setup
   index.number_of_replicas: 0
   ```

2. **Logstash Performance**

   ```yaml
   # Increase worker threads
   pipeline.workers: 4

   # Increase batch size
   pipeline.batch.size: 1000
   ```

## Best Practices

### 1. Security

- Enable authentication and authorization
- Use HTTPS for all communications
- Regularly rotate passwords and API keys
- Implement network segmentation
- Monitor access logs

### 2. Performance

- Use SSD storage for Elasticsearch data
- Allocate sufficient memory (50% of available RAM)
- Monitor cluster health and performance
- Implement proper index lifecycle management
- Use appropriate shard and replica settings

### 3. Privacy

- Implement PII redaction at multiple levels
- Use field-level security for sensitive data
- Regular audit of access logs
- Implement data retention policies
- Encrypt data at rest and in transit

### 4. Monitoring

- Set up alerts for cluster health
- Monitor disk usage and performance
- Track log ingestion rates
- Monitor security events
- Regular backup of configurations

### 5. Maintenance

- Regular updates of ELK stack components
- Monitor and clean up old indices
- Regular testing of backup and recovery procedures
- Performance tuning based on usage patterns
- Documentation of custom configurations

## Conclusion

This implementation provides a robust, privacy-focused logging solution for the Professional Licensing Verification Platform. The self-hosted ELK stack ensures complete control over log data while maintaining HIPAA compliance and providing powerful analytics capabilities.

For production deployments, consider:

- Multi-node Elasticsearch clusters for high availability
- Load balancers for Kibana and Logstash
- Automated backup and disaster recovery procedures
- Integration with existing monitoring and alerting systems
- Regular security audits and penetration testing
