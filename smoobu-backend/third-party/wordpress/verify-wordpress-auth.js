export const verifyWordPressAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== process.env.WP_API_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  next();
};
