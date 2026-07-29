const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWTSECRETKEY;
function MustAuth (req,res,next) {
    const token = req.cookies?.token
    if(!token){
        return res.redirect(302,'/login')
    }

    if (!JWT_SECRET) {
        return res.status(500).send("Server configuration error: missing JWT secret.");
    }

    try{
        req.user =jwt.verify(token,JWT_SECRET)
        if(!(req.user)){
            return res.redirect(302,'/login')
        }
        else{
            return next()
        }
    }
    catch(err){
        res.clearCookie("token");
        return res.redirect(302,'/login')
    }
}

module.exports= MustAuth;