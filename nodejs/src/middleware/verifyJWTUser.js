const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    // 1. Ambil header Authorization
    const authHeader = req.headers['authorization'];
    // 2. Cek apakah ada header dan formatnya "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'access denied. missing token or wrong format.' 
        });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 
        next();
    } catch(e){
        console.error("JWT Error:", e.message); 
        return res.status(401).json({message:'invalid or expired token'});
    }
};