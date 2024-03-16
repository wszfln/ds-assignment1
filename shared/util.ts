import {marshall} from '@aws-sdk/util-dynamodb';
import {MovieReviews} from './types';

export const generateMovieReviewsItem = (review: MovieReviews) => {
    return {
      PutRequest: {
        Item: marshall(review),
      },
    };
  };
  
  export const generateBatch = (data: MovieReviews[]) => {
    return data.map((e) => {
      return generateMovieReviewsItem(e);
    });
  };