import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommandInput, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try{
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        console.log("Paramters:", parameters)
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const reviewerName = parameters?.reviewerName;


        if (!movieId || !reviewerName){
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ Message: "Missing movie Id or missing reviewer name" }),
            };
        }

        const commandOutput = await ddbDocClient.send(
            new QueryCommand({          
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "MovieId = :m AND ReviewerName = :rN",
                ExpressionAttributeValues: {
                    ":m": movieId,
                    ":rN": reviewerName
                },
            })
        );

        if(!commandOutput.Items || commandOutput.Items.length === 0){       
            return {                                                       
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No reviews found. Verify movie Id and reviewer name and try again." }),
            };
        }

        return{
            statusCode: 200,
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ data: commandOutput.Items }),
        };
    } catch (error: any){
        console.log(JSON.stringify(error));
            return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
      wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
  }