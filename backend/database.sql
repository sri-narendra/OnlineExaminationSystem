
-- Users Table
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('student', 'teacher', 'admin')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Users
CREATE INDEX idx_users_email ON users(email);

-- Tests Table
CREATE TABLE tests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    timer_minutes INTEGER NOT NULL,
    test_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Tests
CREATE INDEX idx_tests_test_code ON tests(test_code);
CREATE INDEX idx_tests_teacher_id ON tests(teacher_id);

-- Questions Table
CREATE TABLE questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT CHECK (correct_option IN ('option_a', 'option_b', 'option_c', 'option_d')) NOT NULL
);

-- Indexes for Questions
CREATE INDEX idx_questions_test_id ON questions(test_id);

-- Results Table
CREATE TABLE results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    selected_answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    time_taken INTEGER NOT NULL, -- in seconds or minutes
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Results
CREATE INDEX idx_results_test_id ON results(test_id);
CREATE INDEX idx_results_student_id ON results(student_id);

-- Exam Attempts Table
CREATE TABLE exam_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    selected_answers JSONB DEFAULT '[]', -- Current saved progress
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
    violation_count INTEGER DEFAULT 0,
    question_order JSONB, -- Stored shuffled question IDs
    total_score INTEGER DEFAULT 0,
    time_taken INTEGER DEFAULT 0,
    metadata JSONB -- For extra info
);

CREATE INDEX idx_exam_attempts_student_test ON exam_attempts(student_id, test_id);

-- Violation Logs Table
CREATE TABLE violation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_violation_logs_attempt ON violation_logs(attempt_id);
