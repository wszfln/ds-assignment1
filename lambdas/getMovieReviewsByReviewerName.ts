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
        const reviewerNameOrYear = parameters?.reviewerName;
        let isYear = false                          
        const yearRegex = new RegExp(/^\d{4}$/) 


        if (!movieId || !reviewerNameOrYear){
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }

        if (yearRegex.test(reviewerNameOrYear)){       
            isYear = true                       
        }

        let commandInput: QueryCommandInput={
            TableName: process.env.TABLE_NAME,
        }

        if (isYear){
            commandInput = {   
                ...commandInput,       
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "MovieId = :m",
                FilterExpression: "begins_with(ReviewDate, :year)",
                ExpressionAttributeValues: {
                    ":m": movieId,
                    ":year": reviewerNameOrYear
                },
            }
        }else{
             commandInput = {   
                ...commandInput,               
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "MovieId = :m AND ReviewerName = :rN",
                ExpressionAttributeValues: {
                    ":m": movieId,
                    ":rN": reviewerNameOrYear
                },
            }
        }

        const commandOutput = await ddbDocClient.send(
            new QueryCommand(commandInput)
        )

        if(!commandOutput.Items || commandOutput.Items.length === 0){       
            return {                                                       
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No reviews found. Verify movie Id and reviewer name/review year and try again." }),
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