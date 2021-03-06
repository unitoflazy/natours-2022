const Review = require('../models/reviewModel');
const AppError = require('../utils/appError');
const customizedAsync = require('../utils/customizedAsync');
const Factory = require('./controllerFactory');

exports.getAllReviews = customizedAsync(async (req, res, next) => {
  let filter = {};
  if (req.params.tourId) {
    filter.tour = req.params.tourId;
  }

  const reviews = await Review.find(filter);

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews,
    },
  });
});

exports.createReviewUtil = (req, res, next) => {
  if (!req.body.tour) {
    req.body.tour = req.params.tourId;
  }
  if (!req.body.user) {
    req.body.user = req.user.id;
  }
  next();
};

exports.getReview = Factory.getOne(Review);

exports.createReview = Factory.createOne(Review);

exports.updateReview = Factory.updateOne(Review);

exports.deleteReview = Factory.deleteOne(Review);
