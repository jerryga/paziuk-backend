const supabase = require("../supabaseClient");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Invalid token format" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user)
      return res.status(401).json({ error: "Unauthorized" });

    // Fetch user's role from your 'users' table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", data.user.id)
      .single();

    if (userError || !userData)
      return res.status(401).json({ error: "User not found" });

    req.user = userData; // {id, email, role}
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = authMiddleware;
