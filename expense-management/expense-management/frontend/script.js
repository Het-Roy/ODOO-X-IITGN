const API_BASE = 'http://localhost:5002/api';

// DOM Elements
const authPage = document.getElementById('auth-page');
const dashboardPage = document.getElementById('dashboard-page');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const authSwitch = document.getElementById('auth-switch');
const switchMode = document.getElementById('switch-mode');
const nameField = document.getElementById('name-field');
const countryField = document.getElementById('country-field');
const expenseForm = document.getElementById('expense-form');
const expensesList = document.getElementById('expenses-list');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const adminSections = document.getElementById('admin-sections');
const userForm = document.getElementById('user-form');
const usersList = document.getElementById('users-list');
const approvalQueue = document.getElementById('approval-queue');

let isSignup = false;
let currentUser = null;

// Switch between login and signup
switchMode.addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    
    if (isSignup) {
        authTitle.textContent = 'Create Your Account';
        authButton.textContent = 'Sign Up';
        authSwitch.innerHTML = 'Already have an account? <a href="#" id="switch-mode">Login</a>';
        nameField.style.display = 'block';
        countryField.style.display = 'block';
    } else {
        authTitle.textContent = 'Login to ExpenseTracker';
        authButton.textContent = 'Login';
        authSwitch.innerHTML = 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';
        nameField.style.display = 'none';
        countryField.style.display = 'none';
    }
});

// Handle authentication
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    const country = document.getElementById('country').value;

    try {
        const endpoint = isSignup ? '/auth/signup' : '/auth/login';
        const body = isSignup ? { email, password, name, country } : { email, password };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showDashboard(data.user);
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('An error occurred. Please try again.');
    }
});

// Show dashboard
function showDashboard(user) {
    currentUser = user;
    authPage.classList.remove('active');
    dashboardPage.classList.add('active');
    
    userName.textContent = user.name;
    userRole.textContent = user.role;
    
    // Show admin sections if user is admin or manager
    if (user.role === 'admin' || user.role === 'manager') {
        adminSections.style.display = 'block';
        loadUsers();
        loadApprovalQueue();
    }
    
    loadExpenses();
}

// Load expenses
async function loadExpenses() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/expenses`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const expenses = await response.json();

        if (expenses.length === 0) {
            expensesList.innerHTML = '<p>No expenses submitted yet.</p>';
            return;
        }

        expensesList.innerHTML = expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-header">
                    <span class="expense-amount">$${expense.amount}</span>
                    <span class="expense-category">${expense.category}</span>
                </div>
                <div class="expense-description">${expense.description}</div>
                <div class="expense-meta">
                    <span class="expense-date">${new Date(expense.date).toLocaleDateString()}</span>
                    <span class="status-${expense.status}">${expense.status}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

// Submit expense
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const amount = document.getElementById('expense-amount').value;
    const category = document.getElementById('expense-category').value;
    const description = document.getElementById('expense-description').value;
    const date = document.getElementById('expense-date').value;

    try {
        const response = await fetch(`${API_BASE}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                category,
                description,
                date
            }),
        });

        const expense = await response.json();

        if (response.ok) {
            // Clear form
            expenseForm.reset();
            // Reload expenses
            loadExpenses();
            alert('Expense submitted successfully!');
        } else {
            alert('Error submitting expense');
        }
    } catch (error) {
        alert('An error occurred. Please try again.');
    }
});

// Load users (for admin)
async function loadUsers() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const users = await response.json();

        if (users.length === 0) {
            usersList.innerHTML = '<p>No users found.</p>';
            return;
        }

        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <span class="user-name">${user.name}</span>
                    <span class="user-email">${user.email}</span>
                </div>
                <span class="user-role role-${user.role}">${user.role}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Add new user (admin only)
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const name = document.getElementById('user-name-input').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role-select').value;

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                name,
                email,
                password,
                role
            }),
        });

        const data = await response.json();

        if (response.ok) {
            // Clear form
            userForm.reset();
            // Reload users
            loadUsers();
            alert('User created successfully!');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('An error occurred. Please try again.');
    }
});

// Load approval queue (for managers/admins)
async function loadApprovalQueue() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/expenses/approvals`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const expenses = await response.json();

        if (expenses.length === 0) {
            approvalQueue.innerHTML = '<p>No expenses pending approval.</p>';
            return;
        }

        approvalQueue.innerHTML = expenses.map(expense => `
            <div class="approval-item">
                <div class="approval-header">
                    <span class="approval-user">${expense.userName} (${expense.userEmail})</span>
                    <span class="expense-amount">$${expense.amount}</span>
                </div>
                <div class="expense-description">${expense.description}</div>
                <div class="expense-meta">
                    <span class="expense-category">${expense.category}</span>
                    <span class="expense-date">${new Date(expense.date).toLocaleDateString()}</span>
                </div>
                <div class="approval-actions">
                    <button class="btn-approve" onclick="approveExpense('${expense.id}', 'approve')">Approve</button>
                    <button class="btn-reject" onclick="approveExpense('${expense.id}', 'reject')">Reject</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading approval queue:', error);
    }
}

// Approve/Reject expense
async function approveExpense(expenseId, action) {
    const token = localStorage.getItem('token');
    const comment = prompt(`Enter comment for ${action}:`) || '';
    
    try {
        const response = await fetch(`${API_BASE}/expenses/${expenseId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                action,
                comment
            }),
        });

        const expense = await response.json();

        if (response.ok) {
            loadApprovalQueue();
            alert(`Expense ${action}d successfully!`);
        } else {
            alert('Error processing approval');
        }
    } catch (error) {
        alert('An error occurred. Please try again.');
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dashboardPage.classList.remove('active');
    authPage.classList.add('active');
    authForm.reset();
    isSignup = false;
    authTitle.textContent = 'Login to ExpenseTracker';
    authButton.textContent = 'Login';
    nameField.style.display = 'none';
    countryField.style.display = 'none';
    currentUser = null;
}

// Check if user is already logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        showDashboard(JSON.parse(user));
    }
    
    // Set today's date as default for expense date
    document.getElementById('expense-date').valueAsDate = new Date();
});