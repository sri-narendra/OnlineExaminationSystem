const supabase = require('../config/supabaseClient');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * Gets overview statistics for the admin dashboard
 */
const getDashboardStats = asyncHandler(async (req, res, next) => {
    const [
        { count: userCount },
        { count: testCount },
        { count: attemptCount },
        { count: violationCount }
    ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('tests').select('*', { count: 'exact', head: true }),
        supabase.from('exam_attempts').select('*', { count: 'exact', head: true }),
        supabase.from('violation_logs').select('*', { count: 'exact', head: true })
    ]);

    return res.status(200).json({
        success: true,
        data: {
            total_users: userCount || 0,
            total_exams: testCount || 0,
            total_attempts: attemptCount || 0,
            total_violations: violationCount || 0
        }
    });
});

const getAllUsers = asyncHandler(async (req, res, next) => {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.status(200).json({ success: true, data: users });
});

const getAllTests = asyncHandler(async (req, res, next) => {
    const { data: tests, error } = await supabase
        .from('tests')
        .select('*, users!teacher_id(name, email)') 
        .order('created_at', { ascending: false });

    if (error) return next(error);

    return res.status(200).json({ success: true, data: tests });
});

const getAllResults = asyncHandler(async (req, res, next) => {
    const { data: results, error } = await supabase
        .from('results')
        .select('*, tests(title), users:student_id(name, email)')
        .order('submitted_at', { ascending: false });

    if (error) return next(error);

    return res.status(200).json({ success: true, data: results });
});

const deleteUser = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    if (id === req.user.id) {
        return next(new AppError('Admins cannot delete themselves', 400));
    }

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (error) return next(error);

    return res.status(200).json({ success: true, message: 'User deleted successfully' });
});

const deleteTest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', id);

    if (error) return next(error);

    return res.status(200).json({ success: true, message: 'Test deleted successfully' });
});

module.exports = { 
    getDashboardStats, 
    getAllUsers, 
    getAllTests, 
    getAllResults, 
    deleteUser, 
    deleteTest 
};
