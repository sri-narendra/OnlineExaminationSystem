const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const protect = (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user info to request
        req.user = decoded;
        
        // Check for edge case undefined props
        if(!req.user || !req.user.role) {
             return res.status(401).json({ success: false, message: 'Not authorized, invalid token structure' });
        }
        
        return next();
    } catch (error) {
        console.error('JWT Error:', error.message);
        return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role is not authorized to access this route`
            });
        }
        return next();
    };
};

module.exports = { protect, authorize };
