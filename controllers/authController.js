const supabase = require("../supabaseClient");

exports.signup = async (req, res) => {
  const { email, password, name } = req.body; // optional: name

  try {
    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    // 2. Create user record in your 'users' table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([{ id: authData.user.id, email, name, role: "user" }])
      .select()
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    // 3. Return session and role
    res.json({
      message: "Signup successful",
      session: authData.session,
      user: { id: userData.id, email: userData.email, role: userData.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Login with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (authError) return res.status(400).json({ error: authError.message });

    // 2. Fetch role from 'users' table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", authData.user.id)
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    // 3. Return session and role
    res.json({
      message: "Login successful",
      session: authData.session,
      user: { id: userData.id, email: userData.email, role: userData.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
