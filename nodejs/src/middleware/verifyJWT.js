const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const auth = req.headers['authorization'];
    if(!auth) return res.status(401).json({message:'missing token'});

    const token = auth.split(" ")[1];

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET_ADMIN);
        req.admin = decoded;
        next();
    } catch(e){
        return res.status(401).json({message:'invalid or expired token'});
    }
}