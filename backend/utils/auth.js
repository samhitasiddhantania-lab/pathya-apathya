const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_EXPIRY = "12h"; // admins re-login roughly once a day/shift

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Server misconfigured: JWT_SECRET not set.");
  }
  return secret;
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret()); // throws if invalid/expired
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken };
