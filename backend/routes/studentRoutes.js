const express = require('express');
const { 
    enterTest, 
    autoSave, 
    submitTest, 
    getStudentResult, 
    listResults,
    getStudentStats
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const Joi = require('joi');
const router = express.Router();

const enterTestSchema = {
    body: Joi.object({
        test_code: Joi.string().required()
    })
};

const autoSaveSchema = {
    body: Joi.object({
        attempt_id: Joi.string().uuid().required(),
        answers: Joi.array().items(
            Joi.object({
                question_id: Joi.string().uuid().required(),
                selected_option: Joi.string().valid('option_a', 'option_b', 'option_c', 'option_d').required()
            })
        ).required()
    })
};

const submitTestSchema = {
    body: Joi.object({
        test_id: Joi.string().uuid().required(),
        attempt_id: Joi.string().uuid().required(),
        answers: Joi.array().items(
            Joi.object({
                question_id: Joi.string().uuid().required(),
                selected_option: Joi.string().valid('option_a', 'option_b', 'option_c', 'option_d').required()
            })
        ).min(1).required(),
        time_taken: Joi.number().min(0).required()
    })
};

const getResultSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required()
    })
};

router.use(protect);
router.use(authorize('student'));

router.get('/results', listResults);
router.get('/stats', getStudentStats);
router.post('/enter-test', validate(enterTestSchema), enterTest);
router.post('/auto-save', validate(autoSaveSchema), autoSave);
router.post('/submit-test', validate(submitTestSchema), submitTest);
router.get('/result/:id', validate(getResultSchema), getStudentResult);

module.exports = router;
