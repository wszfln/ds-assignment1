import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from '../shared/util';
import { movieReviews } from '../seed/movieReviews';
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from 'constructs';

type AppApiProps = {
    userPoolId: string;
    userPoolClientId: string;
};

export class AppApi extends Construct {
    private userPoolId: string;
    private userPoolClientId: string;

    constructor(scope: Construct, id: string, props: AppApiProps) {
        super(scope, id);

        ({ userPoolId: this.userPoolId, userPoolClientId: this.userPoolClientId } =
            props);

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
        });
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
        const getAllReviewsByReviewerNameFn = new lambdanode.NodejsFunction(this, "getAllReviewsByReviewerNameFn", {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_16_X,
          entry: `${__dirname}/../lambdas/getAllReviewsByReviewerName.ts`,
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

        //authorizer
        const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                USER_POOL_ID: this.userPoolId,
                CLIENT_ID: this.userPoolClientId,
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "eu-west-1",
            },
        });
  
        //request authorizer
        const requestAuthorizer = new apig.RequestAuthorizer(
            this,
            "RequestAuthorizer",
            {
                identitySources: [apig.IdentitySource.header("cookie")],
                handler: authorizerFn,
                resultsCacheTtl: cdk.Duration.minutes(0),
            }
        );

        // Permissions 
        movieReviewsTable.grantReadData(getMovieReviewsFn);
        movieReviewsTable.grantWriteData(newReviewFn);
        movieReviewsTable.grantReadData(getMovieReviewsByReviewerNameFn);
        movieReviewsTable.grantReadData(getAllReviewsByReviewerNameFn);

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
          new apig.LambdaIntegration(newReviewFn, { proxy: true }),
          {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
          }
        );
        const movieReviewsByReviewerNameEndpoint = movieReviewsEndpoint.addResource("{reviewerName}");
        movieReviewsByReviewerNameEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getMovieReviewsByReviewerNameFn, { proxy: true })
        );
        const getAllReviewsByReviewerNameFnEndpoint = reviewsEndpoint.addResource("{reviewerName}")
        getAllReviewsByReviewerNameFnEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllReviewsByReviewerNameFn, { proxy: true })
        )
    }
}