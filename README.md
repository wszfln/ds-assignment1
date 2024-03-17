## Serverless REST Assignment.

__Name:__ Yingying Lu

__Video demonstration:__ https://youtu.be/tN08eGJZdOg

This repository contains an implementation of a serverless REST API for the AWS platform. The CDK framework is used to provision its infrastructure. The API's domain context is movie reviews.

### API endpoints.

[ Provide a bullet-point list of the app's endpoints ]
e.g.
 
+ POST /movies/reviews - add a movie review.
+ GET /movies/{movieId}/reviews - Get all the reviews for a movie with the specified id.
+ GET /movies/{movieId}/reviews?minRating=n - Get all the reviews for the film with the specified ID whose rating was higher than the minRating.
+ GET /movies/{movieId}/reviews/{reviewerName} - Get the review for the movie with the specified movie ID and written by the named reviewer.
+ PUT /movies/{movieId}/reviews/{reviewerName} - Update the text of a review.
+ GET /movies/{movieId}/reviews/{year} - Get the reviews written in a specific year for a specific movie.
+ GET /reviews/{reviewerName} - Get all the reviews written by a specific reviewer.
+ GET /reviews/{reviewerName}/{movieId}/translation?language=code - Get a translated version of a movie review using the movie ID and reviewer name as the identifier.

![](./images/appapi_1.png)

![](./images/appapi_2.png)

![](./images/authapi_1.png)

![](./images/authapi_2.png)

### Authentication .

![](./images/userpool.png)

### Independent learning (If relevant).

+ Researched AWS Translate functionality
    + Files of evidence:
        + lambdas/translateMovieReview.ts

+ Researched IAM premissions and roles:
    + Files of evidence:
        + lib/app-api.ts