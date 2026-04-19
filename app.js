// --- State Management ---
let state = {
    workouts: [],
    streak: 0,
    lastWorkoutDate: null
};

// API Base URL (adjust if hosted elsewhere)
// const API_BASE = 'http://localhost:8080/api';
const API_BASE = '/api';

// Authentication
function getToken() {
    return localStorage.getItem('aura_token');
}

function setToken(token) {
    localStorage.setItem('aura_token', token);
}

function removeToken() {
    localStorage.removeItem('aura_token');
    localStorage.removeItem('aura_username');
}

// --- Initialization and DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    updateDateDisplay();
    setupAuthForms();
    setupForm();
    updateIntensityLabel();
    setupModal();
    setupEditForm();
    updateEditIntensityLabel();

    checkAuth();
});

async function checkAuth() {
    const token = getToken();
    const authView = document.getElementById('auth-view');
    const mainNav = document.getElementById('main-nav-links');

    if (!token) {
        // Not logged in
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        authView.classList.add('active');
        mainNav.style.display = 'none';
        document.getElementById('greeting-title').textContent = 'Welcome to Aura';
    } else {
        // Logged in
        authView.classList.remove('active');
        mainNav.style.display = 'flex';
        const username = localStorage.getItem('aura_username') || '';
        document.getElementById('greeting-title').textContent = `Ready to crush it today, ${username}?`;

        // Show dashboard
        document.querySelector('[data-tab="dashboard"]').click();
        await initApp();
    }
}

// --- Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-links li:not(#logout-btn)');
    const views = document.querySelectorAll('.view');
    const logoutBtn = document.getElementById('logout-btn');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update active view
            const targetViewId = item.getAttribute('data-tab') + '-view';
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetViewId) {
                    view.classList.add('active');
                }
            });
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            removeToken();
            checkAuth();
        });
    }
}

// --- Auth UI Logic ---
function setupAuthForms() {
    const authForm = document.getElementById('auth-form');
    const toggleLink = document.getElementById('auth-toggle-link');
    const authTitle = document.getElementById('auth-title');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authError = document.getElementById('auth-error');

    let isLogin = true;

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        authTitle.textContent = isLogin ? 'Login to Aura' : 'Register for Aura';
        authToggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        toggleLink.textContent = isLogin ? 'Register' : 'Login';
        authError.style.display = 'none';
        authForm.reset();
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.style.display = 'none';

        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (isLogin) {
                setToken(data.token);
                localStorage.setItem('aura_username', data.username);
                checkAuth();
            } else {
                // Auto-login after registration
                const loginRes = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const loginData = await loginRes.json();
                if (loginRes.ok) {
                    setToken(loginData.token);
                    localStorage.setItem('aura_username', loginData.username);
                    checkAuth();
                }
            }
        } catch (err) {
            authError.textContent = err.message;
            authError.style.display = 'block';
        }
    });
}

function updateDateDisplay() {
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

// --- API Calls & Core Logic ---
async function fetchWorkouts() {
    try {
        const res = await fetch(`${API_BASE}/workouts`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) {
            removeToken();
            checkAuth();
            return [];
        }
        if (!res.ok) throw new Error('Failed to fetch workouts');
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

function calculateStreak(workouts) {
    if (!workouts || workouts.length === 0) return 0;

    // Sort workouts by date ascending
    const sorted = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStreak = 1;
    let lastDate = new Date(sorted[0].date).toDateString();

    for (let i = 1; i < sorted.length; i++) {
        const d = new Date(sorted[i].date);
        const expected = new Date(lastDate);
        expected.setDate(expected.getDate() + 1);

        if (d.toDateString() === expected.toDateString()) {
            currentStreak++;
            lastDate = d.toDateString();
        } else if (d.toDateString() !== lastDate) {
            // Gap larger than 1 day, reset streak
            currentStreak = 1;
            lastDate = d.toDateString();
        }
    }

    // Check if the streak is still active today or yesterday
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastDate !== today && lastDate !== yesterday.toDateString()) {
        return 0; // Streak broken
    }

    return currentStreak;
}

async function initApp() {
    const workouts = await fetchWorkouts();
    state.workouts = workouts;
    state.streak = calculateStreak(workouts);

    renderStreak(state.streak);
    renderRecentActivity(workouts);
    renderFullHistory(workouts);
    renderProfile(workouts);
    generateSuggestion(workouts);
    generateQuote();
}

function renderProfile(workouts) {
    const username = localStorage.getItem('aura_username') || 'User';
    document.getElementById('profile-username').textContent = username;

    const totalWorkouts = workouts.length;
    const totalMinutes = workouts.reduce((sum, w) => sum + w.duration, 0);
    const avgIntensity = totalWorkouts > 0
        ? (workouts.reduce((sum, w) => sum + w.intensity, 0) / totalWorkouts).toFixed(1)
        : 0;

    document.getElementById('total-workouts-stat').textContent = totalWorkouts;
    document.getElementById('total-minutes-stat').textContent = totalMinutes;
    document.getElementById('avg-intensity-stat').textContent = avgIntensity;
}

function setupForm() {
    const form = document.getElementById('log-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('workout-type').value;
        const duration = parseInt(document.getElementById('workout-duration').value);
        const intensity = parseInt(document.getElementById('workout-intensity').value);

        const workoutData = { type, duration, intensity };

        try {
            const res = await fetch(`${API_BASE}/workouts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(workoutData)
            });

            if (res.status === 401) {
                removeToken();
                checkAuth();
                return;
            }
            if (!res.ok) throw new Error("Failed to log workout");

            // Reset form
            form.reset();
            document.getElementById('intensity-value').textContent = "5";

            // Switch to dashboard
            document.querySelector('[data-tab="dashboard"]').click();
            await initApp(); // Refresh data from server

        } catch (err) {
            console.error(err);
            alert("Error logging workout: " + err.message);
        }
    });
}

function updateIntensityLabel() {
    const input = document.getElementById('workout-intensity');
    const label = document.getElementById('intensity-value');
    input.addEventListener('input', (e) => {
        label.textContent = e.target.value;
    });
}

// --- Rendering Functions ---

function renderStreak(streakDays) {
    document.getElementById('streak-days').textContent = streakDays;

    // Progress circle (Max visual at 30 days)
    const maxDays = 30;
    const progress = Math.min(streakDays / maxDays, 1);
    const circle = document.getElementById('streak-progress');
    // Circumference = 2 * pi * r = 2 * 3.14 * 45 ≈ 283
    const offset = 283 - (283 * progress);

    // Slight delay for animation effect
    setTimeout(() => {
        circle.style.strokeDashoffset = offset || 283;
    }, 100);
}

function renderRecentActivity(workouts) {
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';

    const recent = workouts.slice(0, 3);
    if (recent.length === 0) {
        list.innerHTML = '<li><span style="color:var(--text-muted)">No workouts logged yet.</span></li>';
        return;
    }

    recent.forEach(w => {
        const date = new Date(w.date).toLocaleDateString();
        const li = document.createElement('li');

        // Dynamic icon based on type
        let icon = "fa-dumbbell";
        let color = "var(--accent-cyan)";
        if (w.type === 'Cardio') { icon = "fa-person-running"; color = "#f5576c"; }
        if (w.type === 'Flexibility') { icon = "fa-seedling"; color = "#43e97b"; }
        if (w.type === 'Rest') { icon = "fa-bed"; color = "#8892b0"; }

        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="background:rgba(255,255,255,0.1); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:10px; color:${color}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div>
                    <strong style="color:#fff">${w.type}</strong>
                    <div style="font-size:12px;color:var(--text-muted)">${date}</div>
                </div>
            </div>
            <div>
                <span style="color:#fff; font-weight:600;">${w.duration} <small style="color:var(--text-muted); font-weight:400">min</small></span>
            </div>
        `;
        list.appendChild(li);
    });
}

function renderFullHistory(workouts) {
    const tbody = document.getElementById('full-history-list');
    tbody.innerHTML = '';

    if (workouts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted)">No history available.</td></tr>';
        return;
    }

    workouts.forEach(w => {
        const date = new Date(w.date).toLocaleDateString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td style="color:#fff">${w.type}</td>
            <td>${w.duration} min</td>
            <td><div style="display:inline-block; width:100%; max-width:100px; background:var(--panel-border); border-radius:10px; height:6px;"><div style="width:${w.intensity * 10}%; height:100%; background:var(--gradient-primary); border-radius:10px;"></div></div></td>
            <td>
                <button class="btn-icon btn-edit" onclick="openEditModal('${w._id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-icon btn-delete" onclick="deleteWorkout('${w._id}', this)"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Edit/Delete Logic ---

async function deleteWorkout(id, btn) {
    if (!confirm("Are you sure you want to delete this workout?")) return;

    try {
        const res = await fetch(`${API_BASE}/workouts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!res.ok) throw new Error("Failed to delete workout");

        // Animation
        const row = btn.closest('tr');
        row.classList.add('deleting');

        setTimeout(async () => {
            await initApp(); // Refresh all data
        }, 400);

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function openEditModal(id) {
    const workout = state.workouts.find(w => w._id === id);
    if (!workout) return;

    document.getElementById('edit-workout-id').value = workout._id;
    document.getElementById('edit-type').value = workout.type;
    document.getElementById('edit-duration').value = workout.duration;
    document.getElementById('edit-intensity').value = workout.intensity;
    document.getElementById('edit-intensity-value').textContent = workout.intensity;

    // Format date for input[type="date"]
    const date = new Date(workout.date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    document.getElementById('edit-date').value = `${year}-${month}-${day}`;

    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

function setupModal() {
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('close-modal');

    closeBtn.onclick = closeEditModal;

    window.onclick = (e) => {
        if (e.target === modal) closeEditModal();
    };
}

function setupEditForm() {
    const form = document.getElementById('edit-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const id = document.getElementById('edit-workout-id').value;
        const type = document.getElementById('edit-type').value;
        const duration = parseInt(document.getElementById('edit-duration').value);
        const intensity = parseInt(document.getElementById('edit-intensity').value);
        const date = document.getElementById('edit-date').value;

        try {
            const res = await fetch(`${API_BASE}/workouts/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ type, duration, intensity, date })
            });

            if (!res.ok) throw new Error("Failed to update workout");

            closeEditModal();
            await initApp();

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };
}

function updateEditIntensityLabel() {
    const input = document.getElementById('edit-intensity');
    const label = document.getElementById('edit-intensity-value');
    input.addEventListener('input', (e) => {
        label.textContent = e.target.value;
    });
}

const quotes = [
    "Consistency is what transforms average into excellence.",
    "Small daily improvements are the key to staggering long-term results.",
    "Don't stop when you're tired. Stop when you're done.",
    "Discipline is doing what you hate to do, but doing it like you love it.",
    "The hardest lift of all is lifting your butt off the couch.",
    "Motivation gets you going, but discipline keeps you growing.",
    "Success starts with self-discipline."
];

function generateQuote() {
    const quoteEl = document.getElementById('daily-quote');
    const dayOfYear = Math.floor((Date.now() / 86400000) % quotes.length);
    quoteEl.textContent = `"${quotes[dayOfYear]}"`;
}

function generateSuggestion(workouts) {
    const titleEl = document.getElementById('suggestion-title');
    const descEl = document.getElementById('suggestion-desc');
    const iconEl = document.getElementById('suggestion-icon');
    const iconContainer = iconEl.parentElement;

    if (workouts.length === 0) {
        titleEl.textContent = "Start moving!";
        descEl.textContent = "Log your first workout to get personalized suggestions.";
        iconEl.className = "fa-solid fa-person-running";
        iconContainer.style.background = "var(--gradient-primary)";
        return;
    }

    // Adaptive Logic Based on Last 3 Workouts
    const recent = workouts.slice(0, 3);
    const avgIntensity = recent.reduce((sum, w) => sum + w.intensity, 0) / (recent.length);

    if (recent.length >= 3 && avgIntensity >= 8) {
        titleEl.textContent = "Take an Active Rest";
        descEl.textContent = "You've been pushing hard! Consider yoga, stretching or a light walk today to recover.";
        iconEl.className = "fa-solid fa-bed";
        iconContainer.style.background = "linear-gradient(135deg, #43e97b, #38f9d7)";
    } else if (recent.some(w => w.type === 'Rest')) {
        titleEl.textContent = "Time to Push!";
        descEl.textContent = "You should be well rested. Let's hit a tougher Strength or Cardio session.";
        iconEl.className = "fa-solid fa-fire";
        iconContainer.style.background = "linear-gradient(135deg, #f093fb, #f5576c)";
    } else {
        const hasCardio = recent.some(w => w.type === 'Cardio');
        const hasStrength = recent.some(w => w.type === 'Strength');

        if (!hasCardio && recent.length >= 2) {
            titleEl.textContent = "Boost Your Heart Rate";
            descEl.textContent = "It looks like you haven't done cardio recently. Try a 20min run or HIIT.";
            iconEl.className = "fa-solid fa-heart-pulse";
            iconContainer.style.background = "linear-gradient(135deg, #fa709a, #fee140)";
        } else if (!hasStrength && recent.length >= 2) {
            titleEl.textContent = "Build Some Muscle";
            descEl.textContent = "Mix it up with a strength training session to maintain balance and get stronger.";
            iconEl.className = "fa-solid fa-dumbbell";
            iconContainer.style.background = "var(--gradient-primary)";
        } else {
            titleEl.textContent = "Stay the Course!";
            descEl.textContent = "You have a great balance. Keep up the momentum whatever you do today!";
            iconEl.className = "fa-solid fa-bolt";
            iconContainer.style.background = "var(--gradient-primary)";
        }
    }
}
