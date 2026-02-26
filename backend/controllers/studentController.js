const supabase = require('../config/supabaseClient');
const { randomizeExam, calculateScore } = require('../utils/examUtils');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * Enters a test by code. 
 * If an attempt exists, resumes it.
 * If not, creates a new randomized attempt.
 */
const enterTest = asyncHandler(async (req, res, next) => {
    const { test_code } = req.body;
    const student_id = req.user.id;

    // 1. Find Test
    const { data: test, error: testError } = await supabase
        .from('tests')
        .select('*, questions(*)')
        .eq('test_code', test_code)
        .maybeSingle();

    if (testError) return next(testError);
    if (!test) {
        return next(new AppError('Invalid test code', 404));
    }

    // 2. Check for existing attempt
    let { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('test_id', test.id)
        .eq('student_id', student_id)
        .maybeSingle();

    if (attemptError) return next(attemptError);

    if (attempt && attempt.status === 'completed') {
        return next(new AppError('You have already completed this test.', 400));
    }

    let randomizedQuestions;

    if (!attempt) {
        // New Attempt: Randomize questions
        randomizedQuestions = randomizeExam(test.questions);
        
        const { data: newAttempt, error: createError } = await supabase
            .from('exam_attempts')
            .insert([{
                student_id,
                test_id: test.id,
                start_time: new Date().toISOString(),
                question_order: randomizedQuestions.map(q => ({
                    id: q.id,
                    shuffled_options: q.shuffled_options
                })),
                status: 'in_progress'
            }])
            .select()
            .single();

        if (createError) return next(createError);
        attempt = newAttempt;
    } else {
        // Resume Attempt: Reconstruct randomized view from stored order
        const orderMap = new Map();
        attempt.question_order.forEach(o => orderMap.set(o.id, o.shuffled_options));
        
        randomizedQuestions = test.questions
            .filter(q => orderMap.has(q.id))
            .map(q => ({
                ...q,
                shuffled_options: orderMap.get(q.id)
            }));
        
        // Maintain original shuffle order
        const sortedIds = attempt.question_order.map(o => o.id);
        randomizedQuestions.sort((a, b) => sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id));
    }

    // 3. Sanitize Questions (Remove correct_option before sending to client)
    const sanitizedQuestions = randomizedQuestions.map(q => {
        const { correct_option, ...rest } = q;
        return rest;
    });

    return res.status(200).json({
        success: true,
        data: {
            test: {
                id: test.id,
                title: test.title,
                description: test.description,
                timer_minutes: test.timer_minutes,
                questions: sanitizedQuestions
            },
            attempt: {
                id: attempt.id,
                start_time: attempt.start_time,
                saved_answers: attempt.selected_answers,
                violation_count: attempt.violation_count
            }
        }
    });
});

/**
 * Periodic auto-save of student answers
 */
const autoSave = asyncHandler(async (req, res, next) => {
    const { attempt_id, answers } = req.body;
    const student_id = req.user.id;

    const { error } = await supabase
        .from('exam_attempts')
        .update({ selected_answers: answers })
        .eq('id', attempt_id)
        .eq('student_id', student_id)
        .eq('status', 'in_progress');

    if (error) return next(error);

    return res.status(200).json({ success: true, message: 'Progress saved' });
});

/**
 * Final submission of the test
 */
const submitTest = asyncHandler(async (req, res, next) => {
    const { test_id, attempt_id, answers, time_taken } = req.body;
    const student_id = req.user.id;

    // 1. Validate Attempt
    const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attempt_id)
        .eq('student_id', student_id)
        .maybeSingle();

    if (attemptError) return next(attemptError);
    if (!attempt || attempt.status === 'completed') {
        return next(new AppError('Invalid or already completed attempt.', 400));
    }

    // 2. Fetch Questions for Scoring
    const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id, correct_option')
        .eq('test_id', test_id);

    if (qError) return next(qError);
    if (!questions) return next(new AppError('Questions not found', 404));

    // 3. Calculate Score using Utility
    const result = calculateScore(questions, answers);

    // 4. Finalize Attempt
    const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({
            selected_answers: answers,
            status: 'completed',
            total_score: result.score,
            time_taken: time_taken
        })
        .eq('id', attempt_id);

    if (updateError) return next(updateError);

    // 5. Create Result Record - store pre-computed scoring details
    // result.details = [{question_id, selected_option, correct_option, is_correct}]
    const { data: resultRecord, error: saveError } = await supabase
        .from('results')
        .insert([{
            test_id,
            student_id,
            selected_answers: result.details,  // Store pre-computed details with is_correct
            score: result.score,
            time_taken: time_taken
        }])
        .select()
        .single();

    if (saveError) return next(saveError);

    return res.status(201).json({
        success: true,
        message: 'Test submitted successfully',
        data: {
            id: resultRecord.id,
            ...result
        }
    });
});

/**
 * Gets result details
 */
const getStudentResult = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const student_id = req.user.id;

    const { data: result, error } = await supabase
        .from('results')
        .select('*, tests(title, description, questions(*))')
        .eq('id', id)
        .eq('student_id', student_id) 
        .maybeSingle();

    if (error) return next(error);
    if (!result) {
        return next(new AppError('Result not found', 404));
    }

    const enrichedQuestions = result.tests.questions.map(q => {
        // Use pre-computed details stored at submission time for 100% accurate is_correct
        const detail = (result.selected_answers || []).find(a => a.question_id === q.id);
        return {
            ...q,
            your_answer: detail ? detail.selected_option : null,
            is_correct: detail ? detail.is_correct : false
        };
    });

    return res.status(200).json({
        success: true,
        data: {
            test_title: result.tests.title,
            score: result.score,
            time_taken: result.time_taken,
            questions: enrichedQuestions
        }
    });
});

/**
 * List all results for a student
 */
const listResults = asyncHandler(async (req, res, next) => {
    const student_id = req.user.id;

    const { data: results, error } = await supabase
        .from('results')
        .select('*, tests(title, timer_minutes)')
        .eq('student_id', student_id)
        .order('submitted_at', { ascending: false });

    if (error) return next(error);

    return res.status(200).json({ success: true, data: results });
});

const getStudentStats = asyncHandler(async (req, res, next) => {
    const student_id = req.user.id;

    const [
        { data: results, error: resultsError },
        { count: pendingCount, error: pendingError }
    ] = await Promise.all([
        supabase.from('results').select('score').eq('student_id', student_id),
        supabase.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('student_id', student_id).eq('status', 'in_progress')
    ]);

    if (resultsError) return next(resultsError);
    if (pendingError) return next(pendingError);

    const examsTaken = results.length;
    const totalScore = results.reduce((acc, r) => acc + r.score, 0);
    const avgScore = examsTaken > 0 ? (totalScore / examsTaken).toFixed(1) : 0;

    return res.status(200).json({
        success: true,
        data: {
            exams_taken: examsTaken,
            avg_score: `${avgScore}%`,
            pending_exams: pendingCount || 0
        }
    });
});

module.exports = { enterTest, autoSave, submitTest, getStudentResult, listResults, getStudentStats };
