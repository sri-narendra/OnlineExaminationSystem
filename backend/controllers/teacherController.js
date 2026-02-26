const supabase = require('../config/supabaseClient');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const generateTestCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
};

const uploadImageToStorage = async (base64Data, filename) => {
    try {
        // Strip the data:image/...;base64, part
        const base64String = base64Data.split(';base64,').pop();
        const buffer = Buffer.from(base64String, 'base64');
        
        // Determine content type
        let contentType = 'image/png';
        if (base64Data.startsWith('data:image/jpeg')) contentType = 'image/jpeg';
        else if (base64Data.startsWith('data:image/jpg')) contentType = 'image/jpg';
        else if (base64Data.startsWith('data:image/gif')) contentType = 'image/gif';
        else if (base64Data.startsWith('data:image/webp')) contentType = 'image/webp';

        const { data, error } = await supabase.storage
            .from('question-images')
            .upload(filename, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (error) {
            console.error('Supabase storage upload error:', error);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from('question-images')
            .getPublicUrl(filename);
            
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Image upload failed:', err);
        return null;
    }
};

/**
 * Creates a new test
 */
const createTest = asyncHandler(async (req, res, next) => {
    const { title, description, timer_minutes, questions } = req.body;
    console.log(`[CreateTest] Questions count: ${questions ? questions.length : 0}`);
    console.log(`[CreateTest] First question has image_data: ${questions && questions[0] ? !!questions[0].image_data : 'N/A'}`);
    const teacher_id = req.user.id;
    const test_code = generateTestCode();

    // 1. Create Test
    const { data: test, error: testError } = await supabase
        .from('tests')
        .insert([{ teacher_id, title, description, timer_minutes, test_code }])
        .select()
        .single();

    if (testError) return next(testError);

    // 2. Prepare Questions with Images
    const questionsData = [];
    for (let i = 0; i < questions.length; i++) {
        let q = questions[i];
        let imageUrl = q.image_url || null;

        // If new image data is provided, upload it
        if (q.image_data) {
            console.log(`[CreateTest] Uploading image for question ${i}...`);
            const filename = `${test.id}_q${i}_${Date.now()}`;
            const uploadedUrl = await uploadImageToStorage(q.image_data, filename);
            if (uploadedUrl) {
                console.log(`[CreateTest] Uploaded image URL: ${uploadedUrl}`);
                imageUrl = uploadedUrl;
            } else {
                console.error(`[CreateTest] Failed to upload image for question ${i}`);
            }
        }

        questionsData.push({
            test_id: test.id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
            image_url: imageUrl
        });
    }

    // 3. Insert Questions
    const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData);

    if (questionsError) {
        // Rollback test creation if questions fail
        await supabase.from('tests').delete().eq('id', test.id);
        return next(questionsError);
    }

    return res.status(201).json({ 
        success: true, 
        message: 'Test created successfully', 
        data: { test_id: test.id, test_code } 
    });
});

/**
 * Updates an existing test (Ownership validated)
 */
const updateTest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { title, description, timer_minutes, questions } = req.body;
    const teacher_id = req.user.id;

    // 1. Validate ownership
    const { data: test, error: ownerError } = await supabase
        .from('tests')
        .select('id')
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .maybeSingle();

    if (ownerError) return next(ownerError);
    if (!test) {
        return next(new AppError('Test not found or access denied', 404));
    }

    // 2. Update Test metadata
    const { error: updateError } = await supabase
        .from('tests')
        .update({ title, description, timer_minutes })
        .eq('id', id);

    if (updateError) return next(updateError);

    // 3. Update Questions (Simple approach: delete old and insert new)
    // Note: For production, a more complex sync might be better
    const { error: deleteError } = await supabase.from('questions').delete().eq('test_id', id);
    if (deleteError) return next(deleteError);
    
    // Prepare Questions with Images
    const questionsData = [];
    for (let i = 0; i < questions.length; i++) {
        let q = questions[i];
        let imageUrl = q.image_url || null;

        // If new image data is provided, upload it
        if (q.image_data) {
            const filename = `${id}_q${i}_${Date.now()}`;
            const uploadedUrl = await uploadImageToStorage(q.image_data, filename);
            if (uploadedUrl) {
                imageUrl = uploadedUrl;
            }
        }

        questionsData.push({
            test_id: id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
            image_url: imageUrl
        });
    }

    const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData);

    if (questionsError) return next(questionsError);

    return res.status(200).json({ success: true, message: 'Test updated successfully' });
});

/**
 * Deletes a test (Ownership validated)
 */
const deleteTest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const teacher_id = req.user.id;

    const { data: test, error: ownerError } = await supabase
        .from('tests')
        .select('id')
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .maybeSingle();

    if (ownerError) return next(ownerError);
    if (!test) {
        return next(new AppError('Test not found or access denied', 404));
    }

    const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', id);

    if (error) return next(error);

    return res.status(200).json({ success: true, message: 'Test deleted successfully' });
});

const getTests = asyncHandler(async (req, res, next) => {
    const teacher_id = req.user.id;

    const { data: tests, error } = await supabase
        .from('tests')
        .select('*')
        .eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.status(200).json({ success: true, data: tests });
});

const getTestById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const teacher_id = req.user.id;

    const { data: test, error } = await supabase
        .from('tests')
        .select('*, questions(*)')
        .eq('id', id)
        .eq('teacher_id', teacher_id)
        .maybeSingle();

    if (error) return next(error);
    if (!test) return next(new AppError('Test not found or access denied', 404));

    return res.status(200).json({ success: true, data: test });
});

const getTestResults = asyncHandler(async (req, res, next) => {
    const { testId } = req.params;
    const teacher_id = req.user.id;

    const { data: test, error: ownerError } = await supabase
        .from('tests')
        .select('id')
        .eq('id', testId)
        .eq('teacher_id', teacher_id)
        .maybeSingle();

    if (ownerError) return next(ownerError);
    if (!test) {
        return next(new AppError('Test not found or access denied', 404));
    }

    const { data: results, error } = await supabase
        .from('results')
        .select(`
            *,
            users:student_id (name, email)
        `)
        .eq('test_id', testId);

    if (error) return next(error);

    return res.status(200).json({ success: true, data: results });
});

const getTeacherStats = asyncHandler(async (req, res, next) => {
    const teacher_id = req.user.id;

    // 1. Get total exams
    const { count: totalExams } = await supabase
        .from('tests')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacher_id);

    // 2. Get all tests by this teacher to find associated results
    const { data: teacherTests, error: fetchError } = await supabase
        .from('tests')
        .select('id')
        .eq('teacher_id', teacher_id);

    if (fetchError) return next(fetchError);

    const testIds = (teacherTests || []).map(t => t.id);

    if (testIds.length === 0) {
        return res.status(200).json({
            success: true,
            data: {
                total_exams: 0,
                total_students: 0,
                to_grade: 0,
                avg_score: 0
            }
        });
    }

    // 3. Get results for these tests
    const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('score, student_id')
        .in('test_id', testIds);

    if (resultsError) return next(resultsError);

    const totalStudentsSet = new Set(results.map(r => r.student_id));
    const totalScore = results.reduce((acc, r) => acc + r.score, 0);
    const avgScore = results.length > 0 ? (totalScore / results.length).toFixed(1) : 0;

    return res.status(200).json({
        success: true,
        data: {
            total_exams: totalExams || 0,
            total_students: totalStudentsSet.size,
            to_grade: results.length, // In this simple system, every submission is "to grade" or viewed
            avg_score: `${avgScore}%`
        }
    });
});

module.exports = { createTest, updateTest, deleteTest, getTests, getTestById, getTestResults, getTeacherStats };
