
checkAuth('admin');

function switchTab(tabId, event = null) {
    if (event) event.preventDefault();
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
    });
    
    // Reset all tabs styling
    document.querySelectorAll('.nav-tab').forEach(el => {
        el.classList.remove('text-primary', 'font-semibold', 'border-b-2', 'border-primary', 'pb-5', 'mt-5');
        el.classList.add('text-slate-500', 'dark:text-slate-400', 'font-medium');
    });

    // Show target tab
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');
    
    // Style active tab
    if (event && event.target) {
        event.target.classList.remove('text-slate-500', 'dark:text-slate-400', 'font-medium');
        event.target.classList.add('text-primary', 'font-semibold', 'border-b-2', 'border-primary', 'pb-5', 'mt-5');
    }

    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'manage-users') loadUsers();
    if (tabId === 'manage-tests') loadTests();
    if (tabId === 'all-results') loadResults();
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    const response = await apiCall('/admin/stats');
    if (response.success) {
        const stats = response.data;
        statsContainer.innerHTML = `
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Users</p>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">${stats.total_users}</h2>
            </div>
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exams Created</p>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">${stats.total_exams}</h2>
            </div>
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Attempts</p>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">${stats.total_attempts}</h2>
            </div>
            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-red-500">
                <p class="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Violations</p>
                <h2 class="text-2xl font-bold text-red-600">${stats.total_violations}</h2>
            </div>
        `;
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center">Loading users...</td></tr>';

    const response = await apiCall('/admin/users');

    if (response.success) {
        tbody.innerHTML = response.data.map(u => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${u.name}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${u.email}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        ${u.role}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${new Date(u.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 text-right">
                    ${u.role !== 'admin' ? `
                        <button class="p-1.5 text-slate-400 hover:text-red-500 transition-colors" onclick="deleteUser('${u.id}')">
                            <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }
}

async function deleteUser(id) {
    if (confirm('Delete this user? All their data will be lost.')) {
        const response = await apiCall(`/admin/user/${id}`, 'DELETE');
        if (response.success) {
            showAlert('User deleted successfully');
            loadUsers();
            loadDashboard();
        }
    }
}

async function loadTests() {
    const tbody = document.querySelector('#tests-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-10 text-center">Loading exams...</td></tr>';

    const response = await apiCall('/admin/tests');

    if (response.success) {
        tbody.innerHTML = response.data.map(t => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${t.title}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${t.users ? t.users.name : 'Unknown'}</td>
                <td class="px-6 py-4">
                    <code class="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-bold text-primary">${t.test_code}</code>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="p-1.5 text-slate-400 hover:text-red-500 transition-colors" onclick="deleteTest('${t.id}')">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

async function deleteTest(id) {
    if (confirm('Delete this test?')) {
        const response = await apiCall(`/admin/delete-test/${id}`, 'DELETE');
        if (response.success) {
            showAlert('Test deleted successfully');
            loadTests();
            loadDashboard();
        }
    }
}

async function loadResults() {
    const tbody = document.querySelector('#results-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-10 text-center">Loading results...</td></tr>';

    const response = await apiCall('/admin/results');

    if (response.success) {
        tbody.innerHTML = response.data.map(r => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${r.users ? r.users.name : 'Unknown'}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${r.tests ? r.tests.title : 'Unknown'}</td>
                <td class="px-6 py-4 text-center">
                    <span class="font-bold text-primary">${r.score}</span>
                </td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${new Date(r.submitted_at).toLocaleString()}</td>
            </tr>
        `).join('');
    }
}

// Live Proctoring Logic
let proctorSocket;
function startLiveMonitoring(examId) {
    console.log('Admin: startLiveMonitoring selected examId/Code:', examId);
    const grid = document.getElementById('proctoring-grid');
    if (!examId) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <span class="material-symbols-outlined text-5xl mb-4 text-slate-300">videocam</span>
                <p>Select an exam session to view live feeds.</p>
            </div>
        `;
        if (proctorSocket) proctorSocket.disconnect();
        return;
    }

    grid.innerHTML = `
        <div id="no-students-msg" class="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <span class="material-symbols-outlined text-5xl mb-4 text-emerald-300 animate-pulse">sensors</span>
            <p class="font-bold">Monitoring Room: <span class="text-emerald-500">${examId}</span></p>
            <p class="text-sm mt-2">Waiting for student activity in this specific examination...</p>
        </div>
    `;

    if (!proctorSocket) {
        const socketUrl = (typeof config !== 'undefined' && config.SOCKET_URL) ? config.SOCKET_URL : window.location.origin;
        console.log('Admin: Initializing socket at:', socketUrl);
        proctorSocket = io(socketUrl);

        proctorSocket.on('student-frame', (data) => {
            const msg = document.getElementById('no-students-msg');
            if (msg) msg.remove();

            let studentCard = document.getElementById(`student-card-${data.studentId}`);
            if (!studentCard) {
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
                        <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SID: ${data.studentId.substring(0, 8)}</p>
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
        console.log('Admin: Joining room:', examId);
        proctorSocket.emit('proctor-join', examId);
        showAlert(`Admin Monitoring initiated: ${examId}`, 'success');
    };

    if (proctorSocket.connected) {
        joinRoom();
    } else {
        proctorSocket.once('connect', joinRoom);
    }
}

async function populateProctorExamSelect() {
    const select = document.getElementById('proctor-exam-select');
    if (!select) return;

    const response = await apiCall('/admin/tests');
    if (response.success) {
        select.innerHTML = '<option value="">Select Exam to Monitor...</option>' + 
            response.data.map(test => `<option value="${test.test_code}">${test.title} (${test.test_code})</option>`).join('');
    }
}

// Update switchTab for Admin
const originalSwitchTab = switchTab;
switchTab = function(tabId, event) {
    originalSwitchTab(tabId, event);
    if (tabId === 'live-proctoring') {
        populateProctorExamSelect();
    } else {
        if (proctorSocket) {
            proctorSocket.disconnect();
            proctorSocket = null;
        }
    }
}
