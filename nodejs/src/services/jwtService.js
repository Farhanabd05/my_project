const jwt = require("jsonwebtoken");

exports.generateToken = (admin) =>{
    return jwt.sign(
        { user_id: admin.user_id, email: admin.email, name:admin.name, role:'ADMIN'},
        process.env.JWT_SECRET_ADMIN,
        { expiresIn: "1h"}
    )
}