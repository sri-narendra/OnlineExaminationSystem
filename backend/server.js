const dotenv = require('dotenv');
// Load environment variables immediately
dotenv.config();

// Validate environment variables before anything else
require('./config/validateEnv');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const { errorHandler } = require('./middleware/errorMiddleware');

// Global error handlers (Moved to top to catch early issues)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('FATAL ERROR: Uncaught Exception thrown');
    console.error(err.stack || err);
    // Explicitly do NOT exit unless it's a known non-recoverable error
    // process.exit(1); 
});

const app = express();

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));
const PORT = process.env.PORT || 5000;

// Trust proxy if behind a load balancer (e.g. Render, Heroku)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
            connectSrc: ["'self'", "ws:", "wss:", "https://*.supabase.co", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https://*.supabase.co", "https://*"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Request tracking middleware
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    next();
});

// Configurable CORS Allowlist
const DOMAIN_ALLOWLIST = (process.env.CORS_ALLOWLIST 
    ? process.env.CORS_ALLOWLIST.split(',') 
    : ['http://localhost:5000', 'http://localhost:3000', 'http://127.0.0.1:5500']).map(d => d.trim());

console.log('CORS Domain Allowlist:', DOMAIN_ALLOWLIST);

app.use(cors({
    origin: function (origin, callback) {
        // In development, allow all if origins match localhost pattern or are null
        const isLocal = !origin || origin === 'null' || origin.includes('localhost') || origin.includes('127.0.0.1');
        
        if (isLocal || DOMAIN_ALLOWLIST.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
}));


// Utility Middleware
app.use(morgan('dev')); 
app.use(compression()); 
app.use(express.json({ limit: '5mb' })); 
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.use('/api', (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`[API Request] Body size: ${JSON.stringify(req.body).length} bytes`);
    }
    next();
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/teacher', require('./routes/teacherRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', require('./routes/proctorRoutes'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Use Centralized Error Handler
app.use(errorHandler);

// Start Server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // Allow all origins in development or if they match localhost pattern
            const isLocal = !origin || origin === 'null' || origin.includes('localhost') || origin.includes('127.0.0.1');
            if (isLocal || (DOMAIN_ALLOWLIST && DOMAIN_ALLOWLIST.includes(origin))) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

console.log('Socket.io server initialized');

// Socket.io logic for real-time proctoring with robust error handling
io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Students join a room specific to the exam
    socket.on('join-exam', (examId) => {
        try {
            if (!examId) throw new Error('examId is required for join-exam');
            socket.join(`exam-${examId}`);
            // Safely log room occupancy
            const rooms = io.sockets.adapter.rooms;
            const room = rooms ? rooms.get(`exam-${examId}`) : null;
            console.log(`[Socket] Student ${socket.id} joined room: exam-${examId}. Room size: ${room ? room.size : 0}`);
        } catch (err) {
            console.error(`[Socket Error] join-exam fail for ${socket.id}:`, err.message);
        }
    });

    // Proctors (Teachers/Admins) join the same room to receive feeds
    socket.on('proctor-join', (examId) => {
        try {
            if (!examId) throw new Error('examId is required for proctor-join');
            socket.join(`exam-${examId}`);
            console.log(`[Socket] Proctor ${socket.id} joined room: exam-${examId}`);
            
            // Safely log room occupancy for debugging
            const rooms = io.sockets.adapter.rooms;
            const room = rooms ? rooms.get(`exam-${examId}`) : null;
            console.log(`[Socket] Room exam-${examId} now has ${room ? room.size : 0} members`);
        } catch (err) {
            console.error(`[Socket Error] proctor-join fail for ${socket.id}:`, err.message);
        }
    });

    // Relay video frames from student to everyone else in the room (proctors)
    socket.on('video-frame', (data) => {
        try {
            if (!data || !data.examId) return; // Silent fail for bad data
            
            // Only log first frame per student connection to avoid flooding
            if (!socket.hasSentFrame) {
                console.log(`[Socket] First frame received from ${data.studentName || 'Unknown'} for exam ${data.examId}`);
                socket.hasSentFrame = true;
            }

            socket.to(`exam-${data.examId}`).emit('student-frame', {
                studentId: data.studentId,
                studentName: data.studentName,
                frame: data.frame
            });
        } catch (err) {
            console.error(`[Socket Error] video-frame relay fail:`, err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
    });
});

const server = httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
