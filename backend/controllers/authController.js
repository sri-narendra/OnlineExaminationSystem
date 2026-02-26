const supabase = require('../config/supabaseClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const register = asyncHandler(async (req, res, next) => {
    let { name, email, password, role } = req.body;

    // Email Normalization
    email = email.toLowerCase().trim();
    // Password Trimming
    password = password.trim();

    // Strict Role Enforcement: Never let client choose elevated roles
    // If we want to allow teachers and students, we whitelist them.
    // The user suggested 'user', but in this system we have 'student' and 'teacher'.
    // I will stick to whitelisting 'student' and 'teacher'.
    if (!['student', 'teacher'].includes(role)) {
        role = 'student'; // Default to safest role or reject
    }

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (checkError) return next(checkError);
    if (existingUser) {
        return next(new AppError('User with this email already exists', 400));
    }

    // Hash password safely
    const salt = await bcrypt.genSalt(12); // Slightly higher rounds for better security
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
            { name, email, password: hashedPassword, role }
        ])
        .select()
        .single();

    if (createError) return next(createError);

    return res.status(201).json({ 
        success: true, 
        message: 'User registered successfully', 
        data: { id: newUser.id, name: newUser.name, role: newUser.role } 
    });
});

const login = asyncHandler(async (req, res, next) => {
    let { email, password } = req.body;

    // Normalization
    email = email.toLowerCase().trim();
    password = password.trim();

    // Check user
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (userError) return next(userError);
    if (!user) {
        // Use generic message to prevent user enumeration
        return next(new AppError('Invalid email or password', 401));
    }

    // Check password securely
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return next(new AppError('Invalid email or password', 401));
    }

    // Generate Token
    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
            id: user.id,
            name: user.name,
            role: user.role
        }
    });
});

const getProfile = asyncHandler(async (req, res, next) => {
    const user_id = req.user.id;

    const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('id', user_id)
        .single();

    if (error) return next(error);

    return res.status(200).json({ success: true, data: user });
});

module.exports = { register, login, getProfile };
