
// 1. Auth Check
if (typeof checkAuth === 'function') {
    checkAuth('student');
}

// 2. Exam & Attempt Data
// Initial exam metadata from student.js
const examMetadata = JSON.parse(localStorage.getItem('currentExam'));
// Attempt data (start_time, attempt_id, saved_answers) set during resume/start
let attemptId = null;
let startTime = null;
let totalTimeSeconds = 0;
let currentAnswers = [];
let violationCount = 0;

if (!examMetadata) {
    showAlert('No active exam session found.', 'error');
    setTimeout(() => window.location.href = 'student.html', 2000);
} else {
    initExam();
}

async function initExam() {
    // Sync with backend to get attempt state (Resume Logic)
    const response = await apiCall('/student/enter-test', 'POST', { test_code: examMetadata.test_code });
    
    if (!response.success) {
        showAlert(response.message, 'error');
        setTimeout(() => window.location.href = 'student.html', 2000);
        return;
    }

    const { test, attempt } = response.data;
    attemptId = attempt.id;
    // Fallback to now if start_time is null (e.g. old attempts without stored start_time)
    startTime = attempt.start_time ? new Date(attempt.start_time).getTime() : Date.now();
    totalTimeSeconds = test.timer_minutes * 60;
    currentAnswers = attempt.saved_answers || [];
    violationCount = attempt.violation_count || 0;

    renderQuestions(test.questions, currentAnswers);
    startTimer();
    startAutoSave();
}

function renderQuestions(questions, savedAnswers) {
    const container = document.getElementById('questions-list');
    if (!container) return;
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const saved = savedAnswers.find(a => a.question_id === q.id);
        const qDiv = document.createElement('div');
        qDiv.className = 'space-y-6';
        
        qDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-tighter">Question ${index + 1} of ${questions.length}</span>
                </div>
                <button type="button" class="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors text-sm font-medium" onclick="toggleFlag(this, ${index})">
                    <span class="material-symbols-outlined text-lg">flag</span>
                    <span class="flag-text">Flag for Review</span>
                </button>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div class="p-8 space-y-8">
                    <div class="space-y-4">
                        <h3 class="text-2xl font-semibold leading-snug text-slate-900 dark:text-slate-100">${q.question_text}</h3>
                        ${q.image_url ? `
                            <div class="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 flex justify-center">
                                <img src="${q.image_url}" alt="Question Image" class="max-h-64 object-contain rounded-lg shadow-sm">
                            </div>
                        ` : ''}
                    </div>
                    <div class="space-y-4">
                        ${q.shuffled_options.map((opt, optIdx) => {
                            const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                            const optId = `q_${q.id}_opt_${opt.key}`;
                            return `
                                <div class="relative">
                                    <input class="peer sr-only custom-radio" id="${optId}" name="ans_${q.id}" type="radio" value="${opt.key}" ${saved && saved.selected_option === opt.key ? 'checked' : ''} onchange="updateLocalAnswer('${q.id}', '${opt.key}')">
                                    <label class="flex items-center gap-4 p-5 rounded-xl border-2 border-slate-100 dark:border-slate-800 cursor-pointer hover:border-primary/40 transition-all duration-200 group" for="${optId}">
                                        <span class="radio-circle size-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0 transition-all"></span>
                                        <div class="flex-1">
                                            <p class="text-sm text-slate-500 uppercase font-bold mb-0.5">Option ${optLetter}</p>
                                            <p class="text-lg font-medium">${opt.text}</p>
                                        </div>
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(qDiv);
    });
}

function updateLocalAnswer(qId, optKey) {
    const index = currentAnswers.findIndex(a => a.question_id === qId);
    if (index !== -1) {
        currentAnswers[index].selected_option = optKey;
    } else {
        currentAnswers.push({ question_id: qId, selected_option: optKey });
    }
}

// 3. Timer & Auto-Submit
function startTimer() {
    const timerDisplay = document.getElementById('timer-display');
    const progressBar = document.getElementById('progress-bar');
    
    const interval = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const timeLeft = totalTimeSeconds - elapsedSeconds;

        if (timeLeft <= 0) {
            clearInterval(interval);
            submitExam(true); // Forced submission
            return;
        }

        // Warning at 5 minutes
        if (timeLeft === 300) {
            showAlert('5 Minutes remaining!', 'error');
        }

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (progressBar) {
            const percentage = (timeLeft / totalTimeSeconds) * 100;
            progressBar.style.width = `${percentage}%`;
            if (percentage < 20) progressBar.style.background = 'var(--danger)';
        }
    }, 1000);
}

// 4. Auto-Save Answers
function startAutoSave() {
    setInterval(async () => {
        if (!attemptId) return;
        console.log('Auto-saving progress...');
        await apiCall('/student/auto-save', 'POST', {
            attempt_id: attemptId,
            answers: currentAnswers
        });
    }, 30000); // 30 seconds
}

// 5. Submit Logic
const examForm = document.getElementById('exam-form');
if (examForm) {
    examForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (confirm('Submit exam?')) submitExam(false);
    });
}

async function submitExam(auto = false) {
    const button = document.querySelector('button[type="submit"]');
    if (button) {
        button.disabled = true;
        button.textContent = 'Submitting...';
    }

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    const response = await apiCall('/student/submit-test', 'POST', {
        test_id: examMetadata.id,
        attempt_id: attemptId,
        answers: currentAnswers,
        time_taken: Math.min(elapsedSeconds, totalTimeSeconds)
    });

    if (response.success) {
        localStorage.removeItem('currentExam');
        window.location.href = `result.html?id=${response.data.id}`;
    } else {
        showAlert(response.message, 'error');
        setTimeout(() => window.location.href = 'student.html', 2000);
    }
}

// 6. Hardened Proctoring (Tab switches)
// Tab switch detection handled in proctoring.js to prevent duplicate API calls
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Local violation count update if needed for UI
        if (typeof violationCount !== 'undefined') violationCount++;
        showAlert(`Warning: Tab switching detected!`, 'error');
    }
});
function toggleFlag(btn, index) {
    const isFlagged = btn.classList.contains('text-amber-500');
    if (isFlagged) {
        btn.classList.remove('text-amber-500');
        btn.classList.add('text-slate-500');
        btn.querySelector('.flag-text').textContent = 'Flag for Review';
        btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
    } else {
        btn.classList.remove('text-slate-500');
        btn.classList.add('text-amber-500');
        btn.querySelector('.flag-text').textContent = 'Flagged';
        btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
    }
}
