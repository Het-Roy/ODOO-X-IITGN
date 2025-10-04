const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

// Simple in-memory database
let users = [];
let companies = [];
let expenses = [];

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Debug route to see all users (remove this in production)
app.get('/api/debug/users', (req, res) => {
  res.json(users.map(u => ({ email: u.email, name: u.name, password: u.password })));
});

// SIGNUP - Create new company and admin user
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, country } = req.body;
    console.log('Signup attempt:', { email, name });
    
    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create company
    const companyId = Date.now().toString();
    const company = {
      id: companyId,
      name: `${name}'s Company`,
      country: country || 'United States',
      currency: 'USD',
      createdAt: new Date()
    };
    companies.push(company);

    // Create user - FIXED: Added proper error handling for bcrypt
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashError) {
      console.error('Password hashing error:', hashError);
      return res.status(500).json({ message: 'Error creating user' });
    }

    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      role: 'admin',
      companyId,
      isManagerApprover: true,
      createdAt: new Date()
    };
    users.push(user);

    console.log('User created successfully:', user.email);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: company
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// LOGIN - FIXED VERSION
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('User found, comparing passwords...');
    
    // Compare passwords - FIXED: Added better error handling
    let passwordValid;
    try {
      passwordValid = await bcrypt.compare(password, user.password);
    } catch (compareError) {
      console.error('Password comparison error:', compareError);
      return res.status(500).json({ message: 'Authentication error' });
    }

    if (!passwordValid) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('Password valid, generating token...');
    
    const company = companies.find(c => c.id === user.companyId);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('Login successful for:', email);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: company
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// CREATE EMPLOYEE (Admin only)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { email, password, name, role, managerId } = req.body;
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can create users' });
    }

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      role: role || 'employee',
      companyId: req.user.companyId,
      managerId: managerId || null,
      isManagerApprover: role === 'manager',
      createdAt: new Date()
    };
    users.push(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        managerId: user.managerId
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET ALL USERS IN COMPANY
app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const companyUsers = users.filter(u => u.companyId === req.user.companyId)
      .map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        managerId: user.managerId,
        isManagerApprover: user.isManagerApprover
      }));
    
    res.json(companyUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// SUBMIT EXPENSE
app.post('/api/expenses', authenticateToken, (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    const expense = {
      id: Date.now().toString(),
      userId: req.user.userId,
      amount: parseFloat(amount),
      category,
      description,
      date,
      status: 'pending',
      createdAt: new Date(),
      approvals: [],
      rejections: []
    };
    expenses.push(expense);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET USER'S EXPENSES
app.get('/api/expenses', authenticateToken, (req, res) => {
  try {
    const userExpenses = expenses.filter(exp => exp.userId === req.user.userId);
    res.json(userExpenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET EXPENSES FOR APPROVAL (Manager/Admin)
app.get('/api/expenses/approvals', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.userId);
    
    if (user.role === 'employee') {
      return res.status(403).json({ message: 'Only managers and admins can view approvals' });
    }

    // Get all expenses from user's company that are pending
    const companyUsers = users.filter(u => u.companyId === user.companyId);
    const companyUserIds = companyUsers.map(u => u.id);
    
    const pendingExpenses = expenses.filter(exp => 
      companyUserIds.includes(exp.userId) && exp.status === 'pending'
    );

    // Add user info to each expense
    const expensesWithUserInfo = pendingExpenses.map(exp => {
      const expenseUser = users.find(u => u.id === exp.userId);
      return {
        ...exp,
        userName: expenseUser.name,
        userEmail: expenseUser.email
      };
    });

    res.json(expensesWithUserInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// APPROVE/REJECT EXPENSE
app.post('/api/expenses/:id/approve', authenticateToken, (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approve' or 'reject'
    const expenseId = req.params.id;
    
    const expense = expenses.find(exp => exp.id === expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const user = users.find(u => u.id === req.user.userId);
    
    if (action === 'approve') {
      expense.approvals.push({
        userId: user.id,
        userName: user.name,
        timestamp: new Date(),
        comment: comment || ''
      });
      
      // Simple approval: if any manager approves, it's approved
      expense.status = 'approved';
      
    } else if (action === 'reject') {
      expense.rejections.push({
        userId: user.id,
        userName: user.name,
        timestamp: new Date(),
        comment: comment || ''
      });
      expense.status = 'rejected';
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('✅ Expense Management System Backend Ready!');
  console.log('📝 Debug route available: http://localhost:5002/api/debug/users');
});