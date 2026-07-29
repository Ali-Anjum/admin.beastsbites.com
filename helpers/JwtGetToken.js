const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWTSECRETKEY;

function requireJwtSecret() {
    if (!JWT_SECRET) {
        throw new Error("JWT secret is not configured. Set JWT_SECRET in .env");
    }

    return JWT_SECRET;
}

function generateToken(username, role) {
    return jwt.sign(
        {
            username,
            role
        },
        requireJwtSecret(),
        {
            expiresIn: "24h"
        }
    );
}


module.exports = {
    generateToken,

};