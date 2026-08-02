
const express = require('express')
const router = express.Router();
const path = require('node:path');
const bcrypt = require('bcrypt');
const user = require('../Models/UserSchema')
const { generateToken } = require('../helpers/JwtGetToken')
const MiddlwareVerfiesLogin = require('../middleware/auth')
const { getPostLoginRedirect } = require('../helpers/businessRules')
router.get('/', (req, res) => {
    res.clearCookie("token", { path: "/" });
    res.sendFile(path.join(__dirname, "../public", "login.html"));
});

router.post('/logout', (req, res) => {
    res.clearCookie("token", { path: "/" });
    return res.redirect("/login");
});

router.post('/', MiddlwareVerfiesLogin, async (req, res) => {
    const UserSuplliedUsername = req.body.username
    const UserSuppliedPassword = req.body.password
    const response = await user.findOne({ username: UserSuplliedUsername });
try {
    if (req.user) {
        return res.redirect(getPostLoginRedirect(response?.role));
    }

    if (!response) {
        return res.redirect('/login?error=invalid-password');
    }

    let isPasswordValid = false;

    if (typeof response.password === "string" && response.password.startsWith("$2")) {
        isPasswordValid = await bcrypt.compare(UserSuppliedPassword, response.password);
    } else {
        isPasswordValid = response.password === UserSuppliedPassword;

        // One-time migration for legacy plain-text passwords after successful login.
        if (isPasswordValid) {
            const hashedPassword = await bcrypt.hash(UserSuppliedPassword, 10);
            await user.updateOne({ _id: response._id }, { password: hashedPassword });
        }
    }

    if (!isPasswordValid) {
        return res.redirect('/login?error=invalid-password');
    }

    const token = generateToken(response.username, response.role);

    await user.updateOne({ _id: response._id }, { last_login: new Date() });

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.redirect(getPostLoginRedirect(response.role));

} catch (err) {
    console.error(err);
    return res.sendStatus(500);
}

})
module.exports = router;
