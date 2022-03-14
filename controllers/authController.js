const User = require('../models/userModel');
const customizedAsync = require('../utils/customizedAsync');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const sendMail = require('../utils/email');
const { promisify } = require('util');
const crypto = require('crypto');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRATION,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRATION * 24 * 3600000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = customizedAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    // passwordChangeAt: req.body.passwordChangeAt,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = customizedAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please enter a valid email and password', 400));
  }

  const user = await User.findOne({ email: email }).select('password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  createSendToken(user, 200, res);
});

exports.protect = customizedAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Please login to get access', 401));
  }

  const accessToken = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET
  );

  const user = await User.findOne({ _id: accessToken.id });

  if (!user) {
    return next(new AppError('User not exists. Please login again!', 401));
  }

  if (user.changePasswordAfter(accessToken.iat)) {
    return next(
      new AppError('Password has been changed. Please login again!', 401)
    );
  }

  req.user = user;

  next();
});

exports.restrictTo = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = customizedAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('Invalid email', 404));
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Reset your password at ${resetURL}`;

  try {
    await sendMail({
      email: user.email,
      subject: 'Your password reset token',
      message: message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to user email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError('Error while send reset password token to email', 500)
    );
  }
});

exports.resetPassword = customizedAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    resetTokenExpiration: {
      $gte: Date.now(),
    },
  });

  if (!user) {
    return next(new AppError('Reset password token expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.resetTokenExpiration = undefined;

  await user.save();

  createSendToken(user, 200, res);
});

exports.updatePassword = customizedAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Wrong current password', 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  await user.save();

  createSendToken(user, 200, res);
});
