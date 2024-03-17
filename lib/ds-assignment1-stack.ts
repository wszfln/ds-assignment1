import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import {movieReviews} from '../seed/movieReviews';
import * as apig from "aws-cdk-lib/aws-apigateway";


export class DsAssignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const movieReviewsTable = new dynamodb.Table(this, 'MovieReviewsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {name: 'MovieId', type: dynamodb.AttributeType.NUMBER},
      sortKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'MovieReviews',
    });

    // Functions 
    const getMovieReviewsFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviews.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );
    const newReviewFn = new lambdanode.NodejsFunction(this, "addReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addMovieReviews.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });
    const getMovieReviewsByReviewerNameFn = new lambdanode.NodejsFunction(this, "getMovieReviewsByReviewerNameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getMovieReviewsByReviewerName.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    new custom.AwsCustomResource(this, 'reviewsddbInitData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of(
          'reviewsddbInitData',
        ), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    // Permissions 
    movieReviewsTable.grantReadData(getMovieReviewsFn);
    movieReviewsTable.grantWriteData(newReviewFn);
    movieReviewsTable.grantReadData(getMovieReviewsByReviewerNameFn)

    //REST API
    const api = new apig.RestApi(this, 'RestApi', {
      description: 'Movie reviews API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ['Content-Type', 'X-Amz-Date'],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");
    const movieIdEndpoint = moviesEndpoint.addResource("{movieId}");
    const movieReviewsEndpoint = movieIdEndpoint.addResource("reviews");
    movieReviewsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewsFn, { proxy: true })
    );
    const reviewsEndpoint = moviesEndpoint.addResource("reviews")
    reviewsEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newReviewFn, { proxy: true })
    )
    const movieReviewsByReviewerNameEndpoint = movieReviewsEndpoint.addResource("{reviewerName}");
    movieReviewsByReviewerNameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewsByReviewerNameFn, { proxy: true })
    )
     

  }
}
