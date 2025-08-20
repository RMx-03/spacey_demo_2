const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { nodeEnv, port, corsOrigins } = require('./utils/config');

const chatRoutes = require('./routes/chatRoutes');
const dynamicLessonsRoutes = require('./routes/dynamicLessons');


const app = express();
app.disable('x-powered-by');

// Middleware
app.use(express.json({ limit: '10mb' })); // Support large payloads like conversation history

// CORS with configurable allowlist
const defaultOrigin = 'http://localhost:5173';
const allowedOrigins = (corsOrigins && corsOrigins.length > 0) ? corsOrigins : [defaultOrigin];
app.use(cors({
    origin: function(origin, callback) {
        // Allow non-browser clients or same-origin
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS not allowed for origin: ' + origin));
    },
    credentials: true
}));

// Handle malformed JSON bodies early
app.use((err, req, res, next) => {
    if (err && err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next(err);
});

// Add some debug logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});


app.get('/', (req, res) => {
  res.send('Hello from the Spacey Tutor server!');
});

// Health endpoints
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
app.get('/api/status', (req, res) => res.status(200).json({ ok: true, env: nodeEnv, time: new Date().toISOString() }));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/dynamic-lessons', dynamicLessonsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🔥 Global error handler caught:', error);
    if (res.headersSent) return next(error);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        stack: nodeEnv === 'development' ? error.stack : undefined
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Spacey Tutor server running on port ${port}`);
    console.log(`📡 Chat API available at http://localhost:${port}/api/chat`);
    console.log(`🎯 Dynamic Lessons API available at http://localhost:${port}/api/dynamic-lessons`);
});