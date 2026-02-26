
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Randomizes questions and their options.
 * @param {Array} questions - List of question objects.
 */
function randomizeExam(questions) {
    if (!questions || !Array.isArray(questions)) return [];

    // Shuffle question order
    const shuffledQuestions = shuffle(questions);

    // Shuffle options for each question
    return shuffledQuestions.map(q => {
        const options = [
            { key: 'option_a', text: q.option_a },
            { key: 'option_b', text: q.option_b },
            { key: 'option_c', text: q.option_c },
            { key: 'option_d', text: q.option_d }
        ];
        
        const shuffledOptions = shuffle(options);
        
        // Map the shuffled options back to a structure the frontend can use easily
        // We'll return them as an array of objects to keep it simple
        return {
            ...q,
            shuffled_options: shuffledOptions
        };
    });
}

/**
 * Calculates score based on student answers and correct keys.
 * @param {Array} questions - Questions with correct_option.
 * @param {Array} studentAnswers - [{ question_id, selected_option }]
 */
function calculateScore(questions, studentAnswers) {
    let score = 0;
    const total = questions.length;
    const details = [];

    const questionMap = new Map();
    questions.forEach(q => questionMap.set(q.id, q.correct_option));

    studentAnswers.forEach(ans => {
        if (questionMap.has(ans.question_id)) {
            const correctOption = questionMap.get(ans.question_id);
            const isCorrect = correctOption === ans.selected_option;
            if (isCorrect) score++;
            
            details.push({
                question_id: ans.question_id,
                selected_option: ans.selected_option,
                correct_option: correctOption,
                is_correct: isCorrect
            });
        }
    });

    const percentage = total > 0 ? ((score / total) * 100).toFixed(2) : 0;

    return {
        score,
        total,
        percentage: parseFloat(percentage),
        pass: percentage >= 40, // Assuming 40% is pass mark
        details
    };
}

module.exports = { randomizeExam, calculateScore };
