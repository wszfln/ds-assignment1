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
        const minRatingParam = event?.queryStringParameters?.minRating;
        const minRating = minRatingParam ? parseInt(minRatingParam) : undefined; 

        if (!movieId){
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }

        let commandInput: QueryCommandInput ={
            TableName: process.env.TABLE_NAME, 
        }

        if (minRating){
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "MovieId = :m",
                FilterExpression: "Rating >= :r",
                ExpressionAttributeValues: {
                    ":m": movieId,
                    ":r": minRating
                },
            }
        }else{
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "MovieId = :m",
                ExpressionAttributeValues: {
                    ":m": movieId
                },
            }
        }

        const commandOutput = await ddbDocClient.send(      
            new QueryCommand(commandInput)                 
        );

        if(!commandOutput.Items || commandOutput.Items.length === 0){  
            return {                                                        
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No reviews found. Verify movie Id and minimum rating score and try again. Additionally, there may be no reviews for this movie yet" }),
            };
        }

        const body = {
            data: commandOutput.Items
        }

        return{
            statusCode: 200,
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(body),
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

