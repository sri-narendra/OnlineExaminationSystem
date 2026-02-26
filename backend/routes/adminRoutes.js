const express = require('express');
const { 
    getDashboardStats,
    getAllUsers, 
    getAllTests, 
    getAllResults, 
    deleteUser,
    deleteTest 
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const Joi = require('joi');
const router = express.Router();

const idSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required()
    })
};

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/tests', getAllTests);
router.get('/results', getAllResults);
router.delete('/user/:id', validate(idSchema), deleteUser);
router.delete('/delete-test/:id', validate(idSchema), deleteTest);

module.exports = router;
