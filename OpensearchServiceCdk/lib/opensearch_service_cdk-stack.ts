import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ops from 'aws-cdk-lib/aws-opensearchserverless';

export class OpensearchServiceCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const collectionConfig = {
      name: 'employee',
      type: 'SEARCH',
      description: 'Search collection',
      host: '',
      arn: '',
      id: ''
    };

    const collection = new ops.CfnCollection(this, 'EmployeeCollection', {
      name: collectionConfig.name,
      type: collectionConfig.type,
    });

    collectionConfig.host = `${collection.ref}.us-east-1.aoss.amazonaws.com`;
    collectionConfig.arn = `arn:aws:aoss:${this.region}:${this.account}:collection/${collection.ref}`;
    collectionConfig.id = collection.ref;

    // Encryption policy is needed in order to collection creation
    const encPolicy = new ops.CfnSecurityPolicy(this, 'SecurityPolicy', {
      name: `encryption-${collectionConfig.name}`,
      policy: `{"Rules":[{"ResourceType":"collection","Resource":["collection/${collectionConfig.name}"]}],"AWSOwnedKey":true}`,
      type: 'encryption'
    });
    collection.addDependency(encPolicy);

    // Network policy is required so that the dashboard can be viewed!
    const netPolicy = new ops.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `network-${collectionConfig.name}`,
      policy: `[{"Rules":[{"ResourceType":"collection","Resource":["collection/${collectionConfig.name}"]}, {"ResourceType":"dashboard","Resource":["collection/${collectionConfig.name}"]}],"AllowFromPublic":true}]`,
      type: 'network'
    });
    collection.addDependency(netPolicy);

    const searchDataFunction = new lambda.Function(this, 'searchDataFunctionLambda', {
      code: lambda.Code.fromAsset('../OpensearchServiceLambda/target/OpensearchServiceLambda-1.0-SNAPSHOT.jar'),
      handler: 'com.wazo.services.empopensearch.handler.LambdaMainHandler::handleRequest',
      runtime: lambda.Runtime.JAVA_11,
      memorySize: 2048,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      timeout: cdk.Duration.minutes(15),
      environment: {
        COLLECTION_NAME: collectionConfig.name,
        COLLECTION_HOST: collectionConfig.host,
      },
    });

    searchDataFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['es:ESHttpGet'],
      resources: ['*']
    }));

    // Need access to the data for the role
    new ops.CfnAccessPolicy(this, 'SearchDataPolicy', {
      name: 'search-data-policy',
      policy: `[{"Description": "Access from lambda role to get", "Rules":[{"ResourceType":"index","Resource":["index/${collectionConfig.name}/*"],"Permission":["aoss:*"]}, {"ResourceType":"collection","Resource":["collection/${collectionConfig.name}"],"Permission":["aoss:*"]}], "Principal":["${searchDataFunction.role?.roleArn}"]}]`,
      type: 'data'
    });

    const ingestDataFunction = new lambda.Function(this, 'ingestDataFunctionLambda', {
      code: lambda.Code.fromAsset('../OpensearchServiceLambda/target/OpensearchServiceLambda-1.0-SNAPSHOT.jar'),
      handler: 'com.wazo.services.empopensearch.handler.LambdaIngestHandler::handleRequest',
      runtime: lambda.Runtime.JAVA_11,
      memorySize: 2048,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      timeout: cdk.Duration.minutes(15),
      environment: {
        COLLECTION_NAME: collectionConfig.name,
        COLLECTION_HOST: collectionConfig.host,
      },
    });

    ingestDataFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['es:ESHttpPost', 'es:ESHttpPut'],
      resources: ['*']
    }));

    // Need access to the data for the role
    new ops.CfnAccessPolicy(this, 'IngestDataPolicy', {
      name: 'ingest-data-policy',
      policy: `[{"Description": "Access from lambda role to push", "Rules":[{"ResourceType":"index","Resource":["index/${collectionConfig.name}/*"],"Permission":["aoss:*"]}, {"ResourceType":"collection","Resource":["collection/${collectionConfig.name}"],"Permission":["aoss:*"]}], "Principal":["${ingestDataFunction.role?.roleArn}"]}]`,
      type: 'data'
    });

    const api = new apigateway.RestApi(this, 'EmpOpenSearchAPI', {
      restApiName: 'Emp OpenSearch Service',
      description: 'This service serves Emp Search requests.'
    });

    const searchIntegration = new apigateway.LambdaIntegration(searchDataFunction);
    const ingestIntegration = new apigateway.LambdaIntegration(ingestDataFunction);

    const rootapi = api.root.addResource('employee');
    const ingest = rootapi.addResource('ingest');
    ingest.addMethod('POST', ingestIntegration);

    const search = rootapi.addResource('search');
    search.addMethod('GET', searchIntegration);

    new cdk.CfnOutput(this, 'collectionName', {
      value: collectionConfig.name
    });
    new cdk.CfnOutput(this, 'CollectionId', {
      value: collectionConfig.id
    });
    new cdk.CfnOutput(this, 'collectionHost', {
      value: collectionConfig.host
    });
    new cdk.CfnOutput(this, 'collectionArn', {
      value: collectionConfig.arn
    });
  }
}