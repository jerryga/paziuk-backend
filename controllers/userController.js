const supabase = require("../supabaseClient");

exports.getUsers = async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.createUser = async (req, res) => {
  const { name, email } = req.body;
  const { data, error } = await supabase
    .from("users")
    .insert([{ name, email }]);
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const { data, error } = await supabase
    .from("users")
    .update({ name, email })
    .eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("users").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "User deleted", data });
};

exports.getProfile = async (req, res) => {
  // req.user is set by authMiddleware
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    name: req.user.name || null,
  });
};
