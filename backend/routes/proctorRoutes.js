const express = require("express");
const supabase = require("../config/supabaseClient");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validationMiddleware");
const Joi = require("joi");
const router = express.Router();

const violationSchema = {
  body: Joi.object({
    attempt_id: Joi.string().uuid().required(),
    test_id: Joi.string().uuid().required(),
    type: Joi.string().required(),
    timestamp: Joi.number().required()
  })
};

const asyncHandler = require("../utils/asyncHandler");

/**
 * Report a violation.
 * If violations reach 3, the attempt is marked as completed (auto-submit).
 */
router.post("/violation", protect, authorize('student'), validate(violationSchema), asyncHandler(async (req, res, next) => {
  const { attempt_id, test_id, type, timestamp } = req.body;
  const student_id = req.user.id;

  console.log(`[Violation API] Received report from Student ${student_id}:`, { attempt_id, test_id, type, timestamp });
  
  // 1. Log the violation
  const { error: logError } = await supabase
    .from('violation_logs')
    .insert([{
      student_id,
      test_id,
      attempt_id,
      type
    }]);

  if (logError) return next(logError);

  // 2. Increment violation count and check for auto-submit
  const { data: updatedAttempt, error: updateError } = await supabase.rpc('increment_violation_and_check_limit', {
     target_attempt_id: attempt_id,
     max_limit: 3
  });

  // Fallback if RPC isn't set up yet: Manual update
  if (updateError) {
      // Fetch current
      const { data: attempt, error: fetchError } = await supabase
          .from('exam_attempts')
          .select('violation_count')
          .eq('id', attempt_id)
          .single();
      
      if (fetchError) return next(fetchError);
      
      const nextCount = (attempt.violation_count || 0) + 1;
      const updates = { violation_count: nextCount };
      
      if (nextCount > 3) {
          updates.status = 'completed';
          updates.metadata = { force_submit_reason: 'exceeded_violation_limit' };
      }

      const { error: finalUpdateError } = await supabase
          .from('exam_attempts')
          .update(updates)
          .eq('id', attempt_id);
      
      if (finalUpdateError) return next(finalUpdateError);
  }

  return res.status(200).json({ 
      success: true, 
      message: 'Violation recorded',
      force_submit: (updatedAttempt && updatedAttempt.status === 'completed')
  });
}));

module.exports = router;
