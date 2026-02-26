
// Check Auth specific for teacher role
if (typeof checkAuth === 'function') {
    checkAuth('teacher');
}

let editingTestId = null;

// Tabs Logic
function switchTab(tabId, event = null) {
    if (event) event.preventDefault();
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    
    const resultsView = document.getElementById('test-results-view');
    if (resultsView) resultsView.classList.add('hidden');

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');
    
    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (tabId === 'view-tests') loadTests();
    if (tabId === 'view-results-list') loadTestsForResults();
    if (tabId === 'create-test') {
        editingTestId = null; // Reset edit state
        const titleEl = document.querySelector('#create-test-tab h2');
        if (titleEl) titleEl.textContent = 'Create New Test';
        document.getElementById('create-test-form').reset();
        document.getElementById('questions-container').innerHTML = '';
        questionCount = 0;
        addQuestionUI();
    }
}

// Question UI Logic
let questionCount = 0;

function addQuestionUI(data = null) {
    questionCount++;
    const container = document.getElementById('questions-container');
    if (!container) return;
    
    const qDiv = document.createElement('div');
    qDiv.className = 'bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 question-box';
    qDiv.innerHTML = `
        <div class="flex justify-between items-center group">
            <label class="text-sm font-bold text-primary uppercase tracking-wider">Question ${questionCount}</label>
            <button type="button" class="text-slate-400 hover:text-red-500 transition-colors" onclick="this.closest('.question-box').remove()">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
        <div class="space-y-2">
            <textarea class="q-text w-full px-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows="3" required placeholder="Enter your question here...">${data ? data.question_text : ''}</textarea>
        </div>
        <div class="space-y-2">
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">Optional Image</label>
            <input type="file" accept="image/*" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" onchange="handleImagePreview(this)">
            <input type="hidden" class="q-image-data" value="">
            <input type="hidden" class="q-image-url" value="${data && data.image_url ? data.image_url : ''}">
            <div class="q-image-preview mt-2 max-h-48 overflow-hidden rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${data && data.image_url ? '' : 'hidden'}">
                ${data && data.image_url ? `<img src="${data.image_url}" class="max-h-48 object-contain">` : ''}
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">A</span>
                <input type="text" class="opt-a w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" required placeholder="Option A" value="${data ? data.option_a : ''}">
            </div>
            <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">B</span>
                <input type="text" class="opt-b w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" required placeholder="Option B" value="${data ? data.option_b : ''}">
            </div>
            <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">C</span>
                <input type="text" class="opt-c w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" required placeholder="Option C" value="${data ? data.option_c : ''}">
            </div>
            <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">D</span>
                <input type="text" class="opt-d w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" required placeholder="Option D" value="${data ? data.option_d : ''}">
            </div>
        </div>
        <div class="flex items-center gap-4 pt-2">
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Correct Answer:</label>
            <select class="correct-opt flex-1 px-4 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium" required>
                <option value="option_a" ${data && data.correct_option === 'option_a' ? 'selected' : ''}>Option A</option>
                <option value="option_b" ${data && data.correct_option === 'option_b' ? 'selected' : ''}>Option B</option>
                <option value="option_c" ${data && data.correct_option === 'option_c' ? 'selected' : ''}>Option C</option>
                <option value="option_d" ${data && data.correct_option === 'option_d' ? 'selected' : ''}>Option D</option>
            </select>
        </div>
    `;
    container.appendChild(qDiv);
}

function handleImagePreview(input) {
    const file = input.files[0];
    const previewContainer = input.parentElement.querySelector('.q-image-preview');
    const dataInput = input.parentElement.querySelector('.q-image-data');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            previewContainer.innerHTML = `<img src="${result}" class="max-h-48 object-contain">`;
            previewContainer.classList.remove('hidden');
            dataInput.value = result; // Base64 data
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
        dataInput.value = '';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer && questionsContainer.children.length === 0) {
        addQuestionUI();
    }
    
    // Set user name from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) {
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = user.name;
    }

    loadTests();
    loadStats();
});

// Load Dashboard Stats
async function loadStats() {
    const response = await apiCall('/teacher/stats');
    if (response.success) {
        const s = response.data;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; };
        set('stat-total-exams', s.total_exams);
        set('stat-total-students', s.total_students);
        set('stat-to-grade', s.to_grade);
        set('stat-avg-score', s.avg_score);
    } else {
        ['stat-total-exams','stat-total-students','stat-to-grade','stat-avg-score']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'N/A'; });
    }
}

// Create/Update Test
const createTestForm = document.getElementById('create-test-form');
if (createTestForm) {
    createTestForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('test-title').value.trim();
        const description = document.getElementById('test-desc').value.trim();
        const timer_minutes = parseInt(document.getElementById('test-timer').value);

        const qElements = document.querySelectorAll('.question-box');
        const questions = Array.from(qElements).map(el => ({
            question_text: el.querySelector('.q-text').value.trim(),
            option_a: el.querySelector('.opt-a').value.trim(),
            option_b: el.querySelector('.opt-b').value.trim(),
            option_c: el.querySelector('.opt-c').value.trim(),
            option_d: el.querySelector('.opt-d').value.trim(),
            correct_option: el.querySelector('.correct-opt').value,
            image_data: el.querySelector('.q-image-data') ? el.querySelector('.q-image-data').value : null,
            image_url: el.querySelector('.q-image-url') ? el.querySelector('.q-image-url').value : null
        }));

        const button = e.target.querySelector('button[type="submit"]');
        if (button) button.disabled = true;



        let response;
        if (editingTestId) {
            response = await apiCall(`/teacher/test/${editingTestId}`, 'PUT', {
                title, description, timer_minutes, questions
            });
        } else {
            response = await apiCall('/teacher/create-test', 'POST', {
                title, description, timer_minutes, questions
            });
        }

        if (button) button.disabled = false;

        if (response.success) {
            showAlert(editingTestId ? 'Test Updated!' : `Test Created! Share Code: ${response.data.test_code}`);
            createTestForm.reset();
            const container = document.getElementById('questions-container');
            if (container) container.innerHTML = '';
            questionCount = 0;
            editingTestId = null;
            addQuestionUI();
            switchTab('view-tests');
        } else {
            showAlert(response.message || 'Error saving test', 'error');
        }
    });
}

// Load Tests
async function loadTests() {
    const list = document.getElementById('tests-list');
    if (!list) return;
    list.innerHTML = '<p>Loading tests...</p>';

    const response = await apiCall('/teacher/tests');

    if (response.success) {
        if (!response.data || response.data.length === 0) {
            list.innerHTML = '<p>No tests created yet.</p>';
            return;
        }

        list.innerHTML = response.data.map(test => `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group relative">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <span class="material-symbols-outlined text-xl">analytics</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors" onclick="editTest('${test.id}')"><span class="material-symbols-outlined text-lg">edit</span></button>
                        <button class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors" onclick="deleteTest('${test.id}')"><span class="material-symbols-outlined text-lg">delete</span></button>
                    </div>
                </div>
                <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${test.title}</h4>
                <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6">${test.description || 'No description provided for this examination.'}</p>
                <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-slate-400 text-sm">schedule</span>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">${test.timer_minutes} Mins</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-slate-400 text-sm">event</span>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest underline decoration-primary decoration-2 underline-offset-4">Code: ${test.test_code}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

async function editTest(id) {
    // Fetch full test + questions from teacher-specific endpoint
    const response = await apiCall(`/teacher/test/${id}`);
    if (!response.success) {
        showAlert(response.message || 'Could not load test for editing', 'error');
        return;
    }

    const test = response.data;
    editingTestId = id;

    // Switch to create tab view
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const createTab = document.getElementById('create-test');
    if (createTab) createTab.classList.remove('hidden');

    // Update form title
    const titleEl = document.getElementById('create-test-title');
    if (titleEl) titleEl.textContent = 'Edit Exam';

    // Prefill exam metadata
    document.getElementById('test-title').value = test.title;
    document.getElementById('test-desc').value = test.description || '';
    document.getElementById('test-timer').value = test.timer_minutes;

    // Prefill questions
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    questionCount = 0;
    (test.questions || []).forEach(q => addQuestionUI(q));

    // If no questions, add one blank
    if (!test.questions || test.questions.length === 0) addQuestionUI();
}

async function deleteTest(id) {
    if (confirm('Permanently delete this test and all results?')) {
        const response = await apiCall(`/teacher/test/${id}`, 'DELETE');
        if (response.success) {
            showAlert('Test deleted');
            loadTests();
        } else {
            showAlert(response.message, 'error');
        }
    }
}

// Results View implementation matches previous, ensuring robust error handling
async function loadTestsForResults() {
    const list = document.getElementById('results-test-list');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500">Loading...</p>';

    const response = await apiCall('/teacher/tests');

    if (response.success) {
        if (!response.data || response.data.length === 0) {
            list.innerHTML = '<p class="text-slate-500 col-span-3">No exams created yet.</p>';
        } else {
            list.innerHTML = response.data.map(test => `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                     onclick="viewTestResults('${test.id}', '${test.title.replace(/'/g, "\\'")}')">
                    <div class="flex items-start justify-between mb-4">
                        <div class="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                            <span class="material-symbols-outlined text-xl">analytics</span>
                        </div>
                        <code class="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-bold text-primary">${test.test_code}</code>
                    </div>
                    <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">${test.title}</h4>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${test.description || 'No description.'}</p>
                    <div class="flex items-center gap-2 text-primary font-bold text-sm">
                        <span class="material-symbols-outlined text-lg">bar_chart</span> View Results
                    </div>
                </div>
            `).join('');
        }
    } else {
        list.innerHTML = `<p class="text-red-500 col-span-3">${response.message || 'Error loading exams.'}</p>`;
    }
}

async function viewTestResults(testId, title) {
    const list = document.getElementById('view-results-list');
    const view = document.getElementById('test-results-view');
    if (list) list.classList.add('hidden');
    if (view) view.classList.remove('hidden');
    document.getElementById('result-test-title').textContent = `Results: ${title}`;

    const tbody = document.querySelector('#results-table tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">Loading...</td></tr>';

    const response = await apiCall(`/teacher/results/${testId}`);

    if (response.success) {
        if (!response.data || response.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500">No submissions yet.</td></tr>';
        } else {
            tbody.innerHTML = response.data.map(r => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${r.users ? r.users.name : 'Unknown'}</td>
                    <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${r.users ? r.users.email : 'N/A'}</td>
                    <td class="px-6 py-4 text-center font-bold text-primary">${r.score}</td>
                    <td class="px-6 py-4 text-center text-slate-500 dark:text-slate-400">${r.time_taken ? `${Math.floor(r.time_taken / 60)}m ${r.time_taken % 60}s` : 'N/A'}</td>
                    <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${new Date(r.submitted_at).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-500">${response.message || 'Error loading results'}</td></tr>`;
    }
}
function downloadResults() {
    showAlert('Downloading CSV...', 'success');
    // Basic CSV generation logic for proof of concept
    const rows = Array.from(document.querySelectorAll('#results-table tr'));
    const csvContent = rows.map(row => Array.from(row.cells).map(cell => `"${cell.textContent}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'results.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// Live Proctoring Logic
let proctorSocket;
function startLiveMonitoring(examId) {
    console.log('Teacher: startLiveMonitoring selected examId:', examId);
    const grid = document.getElementById('proctoring-grid');
    if (!examId) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <span class="material-symbols-outlined text-5xl mb-4 text-slate-300">visibility</span>
                <p>Select an active exam to start the live video feed from students.</p>
            </div>
        `;
        if (proctorSocket) {
            console.log('Teacher: Disconnecting socket...');
            proctorSocket.disconnect();
        }
        return;
    }

    grid.innerHTML = `
        <div id="no-students-msg" class="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <span class="material-symbols-outlined text-5xl mb-4 text-emerald-300 animate-pulse">sensors</span>
            <p class="font-bold">Monitoring Room: <span class="text-emerald-500">${examId}</span></p>
            <p class="text-sm mt-2">Waiting for students to join this specific room...</p>
        </div>
    `; 

    if (!proctorSocket) {
        console.log('Teacher: Initializing proctor socket...');
        const socketUrl = (typeof config !== 'undefined' && config.SOCKET_URL) ? config.SOCKET_URL : window.location.origin;
        console.log('Teacher: Connecting to socket at:', socketUrl);
        proctorSocket = io(socketUrl);
        
        proctorSocket.on('connect', () => {
            console.log('Teacher: Socket connected. ID:', proctorSocket.id);
        });

        proctorSocket.on('student-frame', (data) => {
            // Only log first frame per student to avoid flooding the console
            if (!window[`logged_${data.studentId}`]) {
                console.log('Teacher: Received first frame from student:', data.studentName, '(' + data.studentId + ')');
                window[`logged_${data.studentId}`] = true;
            }
            
            // data: { studentId, studentName, frame }
            let studentCard = document.getElementById(`student-card-${data.studentId}`);
            if (!studentCard) {
                // Remove the "Waiting for students" message on first student
                const msg = document.getElementById('no-students-msg');
                if (msg) msg.remove();

                console.log('Teacher: Creating new card for student:', data.studentName);
                studentCard = document.createElement('div');
                studentCard.id = `student-card-${data.studentId}`;
                studentCard.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col items-center gap-3 animate-fade-in';
                studentCard.innerHTML = `
                    <div class="relative w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                        <img id="student-video-${data.studentId}" class="w-full h-full object-cover">
                        <div class="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-emerald-500 rounded-full">
                            <span class="size-2 bg-white rounded-full animate-pulse"></span>
                            <span class="text-[8px] font-bold text-white uppercase tracking-wider">Live</span>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-sm font-bold text-slate-900 dark:text-white">${data.studentName}</p>
                        <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">ID: ${data.studentId.substring(0, 8)}...</p>
                    </div>
                `;
                grid.appendChild(studentCard);
            }

            const img = document.getElementById(`student-video-${data.studentId}`);
            if (img) img.src = data.frame;
        });
    }

    const joinRoom = () => {
        if (!proctorSocket || !proctorSocket.connected) return;
        console.log('Teacher: Emitting proctor-join for room:', examId);
        proctorSocket.emit('proctor-join', examId);
        showAlert(`Monitoring initiated for exam: ${examId}`, 'success');
    };

    if (proctorSocket.connected) {
        joinRoom();
    } else {
        proctorSocket.once('connect', joinRoom);
    }
}

// Function to populate exam selector in Live Proctoring tab
async function populateProctorExamSelect() {
    console.log('Teacher: Populating proctor exam select...');
    const select = document.getElementById('proctor-exam-select');
    if (!select) {
        console.warn('Teacher: #proctor-exam-select not found');
        return;
    }

    const response = await apiCall('/teacher/tests');
    console.log('Teacher: Fetching tests response:', response);
    
    if (response.success) {
        if (response.data.length === 0) {
            console.log('Teacher: No exams found for this teacher.');
        }
        select.innerHTML = '<option value="">Select Exam to Monitor...</option>' + 
            response.data.map(test => `<option value="${test.test_code}">${test.title} (${test.test_code})</option>`).join('');
    } else {
        console.error('Teacher: Failed to fetch tests for proctoring.');
    }
}

// Update switchTab to include live proctoring population
const originalSwitchTab = switchTab;
switchTab = function(tabId, event) {
    originalSwitchTab(tabId, event);
    if (tabId === 'live-proctoring') {
        populateProctorExamSelect();
    } else {
        // Disconnect socket if leaving live proctoring
        if (proctorSocket) {
            proctorSocket.disconnect();
            proctorSocket = null;
        }
    }
}
