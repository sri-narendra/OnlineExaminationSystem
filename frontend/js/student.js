
// Check Auth specifically for student role
if (typeof checkAuth === 'function') {
    checkAuth('student');
}

const enterTestForm = document.getElementById('enter-test-form');
if (enterTestForm) {
    enterTestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const testCodeInput = document.getElementById('test-code');
        if (!testCodeInput) return;
        
        const testCode = testCodeInput.value.trim().toUpperCase();
        if (!testCode) {
            showAlert('Please enter a test code', 'error');
            return;
        }

        const button = e.target.querySelector('button');
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.textContent = 'Verifying...';

            const response = await apiCall('/student/enter-test', 'POST', { test_code: testCode });

            if (response.success) {
                // Store full exam data including test_code in localStorage
                const examData = {
                    ...response.data.test,
                    test_code: testCode  // Attach the test_code so exam.js can resume
                };
                localStorage.setItem('currentExam', JSON.stringify(examData));
                window.location.href = 'exam.html';
            } else {
                showAlert(response.message || 'Error joining test', 'error');
            }
        } catch (error) {
            console.error('Enter Test Error:', error);
            showAlert('An unexpected error occurred', 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}
// Initialize Student Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Set user name from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) {
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = user.name;
    }

    loadDashboardData();
});

async function loadDashboardData() {
    // 1. Load Stats
    const statsResponse = await apiCall('/student/stats');
    if (statsResponse.success) {
        const stats = statsResponse.data;
        const statValues = document.querySelectorAll('section p.text-3xl');
        if (statValues.length >= 3) {
            statValues[0].textContent = stats.exams_taken;
            statValues[1].textContent = stats.avg_score;
            statValues[2].textContent = stats.pending_exams;
        }
    }

    // 2. Load Recent Results Preview
    const resultsResponse = await apiCall('/student/results');
    if (resultsResponse.success) {
        const container = document.getElementById('recent-results-container');
        if (container) {
            if (resultsResponse.data.length === 0) {
                container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No results yet.</p>';
            } else {
                container.innerHTML = resultsResponse.data.slice(0, 5).map(r => `
                    <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors group cursor-pointer" onclick="window.location.href='result.html?id=${r.id}'">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">${r.tests.title}</h4>
                            <span class="text-[10px] font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded uppercase">Completed</span>
                        </div>
                        <div class="flex items-center gap-4">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Score: ${r.score}</p>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${new Date(r.submitted_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                `).join('');
            }
        }
    }
}
