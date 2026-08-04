// Protects the routes used to register/manage your 10 merchant sites.
// Only you should hold ADMIN_API_KEY — never share it with the merchant sites themselves.
function adminAuth(req, res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ status: false, message: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
