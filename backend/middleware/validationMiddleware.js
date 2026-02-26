const Joi = require('joi');
const AppError = require('../utils/AppError');

/**
 * Validates request payload against a Joi schema.
 * @param {Object} schema - Joi schema objects for body, query, and params.
 */
const validate = (schema) => {
    return (req, res, next) => {
        const validations = ['body', 'query', 'params'];
        
        for (let key of validations) {
            if (schema[key]) {
                const { error, value } = schema[key].validate(req[key], { 
                    abortEarly: false, 
                    stripUnknown: true,
                    errors: { wrap: { label: '' } } 
                });
                
                if (error) {
                    const errorMessages = error.details.map(detail => detail.message).join(', ');
                    return next(new AppError(errorMessages, 400));
                }
                
                // Reassign validated/sanitized value back to request
                req[key] = value;
            }
        }
        
        next();
    };
};

module.exports = { validate };
