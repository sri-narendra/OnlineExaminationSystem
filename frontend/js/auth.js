
// Helper for API calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (token && token !== 'undefined') {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const options = { 
            method, 
            headers,
            mode: 'cors'
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${config.API_BASE_URL}${endpoint}`, options);
        
        // Handle unauthorized or expired tokens
        if (response.status === 401) {
            const isAuthPage = window.location.pathname.includes('index.html') || 
                              window.location.pathname.includes('register.html') ||
                              window.location.pathname === '/' ||
                              window.location.pathname === '';
            
            if (!isAuthPage) {
                console.warn('Unauthorized access detected. Logging out...');
                logout(); 
                return { success: false, message: 'Session expired' };
            }
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        if (typeof showAlert === 'function') {
            showAlert('Connection error. Please check your internet.', 'error');
        }
        return { success: false, message: 'Network or server error' };
    }
}

// Auth Functions
function login(email, password) {
    return apiCall('/auth/login', 'POST', { email, password });
}

function register(name, email, password, role) {
    return apiCall('/auth/register', 'POST', { name, email, password, role });
}

function logout() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Clear any other session data if exists
        sessionStorage.clear();
    } catch (e) {
        console.error('Logout error:', e);
    } finally {
        window.location.href = 'index.html';
    }
}

function isTokenExpired(token) {
    if (!token || token === 'undefined') return true;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return true;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const { exp } = JSON.parse(jsonPayload);
        if (!exp) return false; // If no exp claim, assume valid until server rejects
        
        const bufferTime = 60; // 1 minute buffer
        return (Date.now() / 1000) > (exp - bufferTime);
    } catch (e) {
        return true;
    }
}

function checkAuth(requiredRole = null) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // 1. Check existence
    if (!token || token === 'undefined' || !userStr || userStr === 'undefined') {
        window.location.href = 'index.html';
        return;
    }

    // 2. Validate token structure and expiration
    if (isTokenExpired(token)) {
        logout();
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        logout();
        return;
    }

    // 3. Check Role
    if (requiredRole && user.role !== requiredRole) {
        if (typeof showAlert === 'function') showAlert('Unauthorized access', 'error');
        setTimeout(() => {
            if (user.role === 'student') window.location.href = 'student.html';
            else if (user.role === 'teacher') window.location.href = 'teacher.html';
            else if (user.role === 'admin') window.location.href = 'admin.html';
            else logout();
        }, 1000);
        return;
    }

    // Set Theme
    document.body.classList.add(`${user.role}-theme`);

    // Update UI User Name if element exists
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = user.name;
}

// UI Utilities
function showAlert(message, type = 'success') {
    // Remove any existing alert
    const existing = document.getElementById('alert-box');
    if (existing) existing.remove();

    const colors = {
        success: { bg: '#10b981', icon: '✓' },
        error:   { bg: '#ef4444', icon: '✕' },
        info:    { bg: '#3b82f6', icon: 'ℹ' },
        warning: { bg: '#f59e0b', icon: '⚠' },
    };
    const { bg, icon } = colors[type] || colors.info;

    const alertBox = document.createElement('div');
    alertBox.id = 'alert-box';
    alertBox.innerHTML = `<span style="font-size:1.1rem;font-weight:700;">${icon}</span> ${message}`;

    Object.assign(alertBox.style, {
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: '99999',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.85rem 1.4rem',
        borderRadius: '0.75rem',
        background: bg,
        color: '#fff',
        fontSize: '0.9rem',
        fontWeight: '600',
        fontFamily: 'Lexend, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        opacity: '0',
        transform: 'translateY(-12px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        maxWidth: '380px',
        pointerEvents: 'none',
    });

    document.body.appendChild(alertBox);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            alertBox.style.opacity = '1';
            alertBox.style.transform = 'translateY(0)';
        });
    });

    // Animate out after 3s
    setTimeout(() => {
        alertBox.style.opacity = '0';
        alertBox.style.transform = 'translateY(-12px)';
        setTimeout(() => alertBox.remove(), 300);
    }, 3000);
}
