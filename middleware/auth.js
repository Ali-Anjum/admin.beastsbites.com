const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWTSECRETKEY;

function authenticate(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        req.user = null;
        return next();
    }

    if (!JWT_SECRET) {
        return res.status(500).send("Server configuration error: missing JWT secret.");
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch (err) {
        res.clearCookie("token");
        req.user = null;
        return next();
    }
}

module.exports = authenticate;