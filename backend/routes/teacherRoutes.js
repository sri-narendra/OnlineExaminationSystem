const express = require('express');
const { 
    createTest, 
    updateTest, 
    deleteTest, 
    getTests,
    getTestById,
    getTestResults,
    getTeacherStats
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const Joi = require('joi');
const router = express.Router();

const testSchema = {
    body: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().allow('', null),
        timer_minutes: Joi.number().integer().min(1).required(),
        questions: Joi.array().items(
            Joi.object({
                question_text: Joi.string().required(),
                option_a: Joi.string().required(),
                option_b: Joi.string().required(),
                option_c: Joi.string().required(),
                option_d: Joi.string().required(),
                correct_option: Joi.string().valid('option_a', 'option_b', 'option_c', 'option_d').required(),
                image_data: Joi.string().allow('', null),
                image_url: Joi.string().allow('', null)
            })
        ).min(1).required()
    })
};

const testIdSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required()
    })
};

const resultsSchema = {
    params: Joi.object({
        testId: Joi.string().uuid().required()
    })
};

router.use(protect);
router.use(authorize('teacher'));

router.post('/create-test', validate(testSchema), createTest);
router.put('/test/:id', validate(Object.assign({}, testIdSchema, testSchema)), updateTest);
router.delete('/test/:id', validate(testIdSchema), deleteTest);
router.get('/stats', getTeacherStats);
router.get('/tests', getTests);
router.get('/test/:id', validate(testIdSchema), getTestById);
router.get('/results/:testId', validate(resultsSchema), getTestResults);

module.exports = router;
