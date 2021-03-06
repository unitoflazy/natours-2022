const router = require('express').Router();

const {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  protect, 
  restrictTo
} = require('../controllers/authController');

const { 
  getAllUsers, 
  updateMe, 
  deleteMe,
  getMe, 
  deleteUser, 
  updateUser,
  getUser,
  uploadUserPhoto,
  resizeUserPhoto
} = require('../controllers/userController');


router.post('/signup', signup);
router.post('/login', login);
router.get('/logout', logout);
router.post('/forgotPassword', forgotPassword);
router.patch('/resetPassword/:token', resetPassword);

router.use(protect);

router.patch('/updateMyPassword', updatePassword);
router.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);
router.delete('/deleteMe', deleteMe);

router.get('/me', getMe, getUser);

router.route('/')
  .get(restrictTo(['admin']), getAllUsers);
  // .post(createUser);

router.route('/:id')
  .get(restrictTo(['admin']), getUser)
  .patch(restrictTo(['admin']), updateUser)
  .delete(restrictTo(['admin']), deleteUser);


module.exports = router