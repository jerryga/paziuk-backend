const supabase = require("../supabaseClient");
const SESSION_DURATION = 7200000; // 2 hours

function normalizeBirthDateForDb(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

exports.signup = async (req, res) => {
  const {
    email,
    password,
    first_name,
    middle_name,
    last_name,
    birth_date,
    birth_place,
  } = req.body;

  const normalizedBirthDate = normalizeBirthDateForDb(birth_date);

  try {
    // 0. Find existing person row
    let query = supabase
      .from("people")
      .select(
        "id, first_name, middle_name, last_name, birth_date, birth_place, role",
      )
      .ilike("first_name", first_name)
      .eq("birth_date", normalizedBirthDate);

    if (
      middle_name !== null &&
      middle_name !== undefined &&
      middle_name !== ""
    ) {
      query = query.ilike("middle_name", middle_name);
    } else {
      query = query.is("middle_name", null);
    }

    if (last_name !== null && last_name !== undefined && last_name !== "") {
      query = query.ilike("last_name", last_name);
    } else {
      query = query.is("last_name", null);
    }

    const { data: personData, error: personError } = await query.maybeSingle();
    if (personError) {
      return res
        .status(500)
        .json({ error: "Database query failed", details: personError.message });
    }
    if (!personData) {
      return res.status(404).json({ error: "Person not found" });
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const authUserId = authData.user.id;

    // 2. Insert a row in `users` linking the new auth user to the person
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([
        {
          id: authUserId,
          email,
          person_id: personData.id,
          role: personData.role,
          first_name: personData.first_name,
          middle_name: personData.middle_name,
          last_name: personData.last_name,
          birth_date: personData.birth_date,
          birth_place: personData.birth_place || null,
        },
      ])
      .select()
      .single();

    if (userError) {
      // Consider cleaning up the auth user if you don't want orphan auth accounts
      console.error("User table insert failed:", userError);
      return res.status(400).json({ error: userError.message });
    }

    // 3. Now update the people row (this should pass the RLS policy since users row exists)
    if (birth_place) {
      const { data: updatedPeople, error: updateError } = await supabase
        .from("people")
        .update({ birth_place })
        .eq("id", personData.id)
        .select()
        .single();

      if (updateError) {
        // If this fails, it may be an RLS/policy issue or other DB error
        console.error("Failed to update birth_place:", updateError);
        // Decide whether to rollback the users insert or inform the user — here we return an error
        return res.status(500).json({
          error: "Failed to update people row",
          details: updateError.message,
        });
      } else {
        personData.birth_place = updatedPeople.birth_place;
      }
    }

    // 4. Return session and user info
    res.json({
      message: "Signup successful",
      session: authData.session,
      user: {
        id: userData.id,
        email: userData.email,
        person_id: userData.person_id,
        role: userData.role,
        first_name: userData.first_name,
        middle_name: userData.middle_name,
        last_name: userData.last_name,
        birth_date: userData.birth_date,
        birth_place: personData.birth_place || null,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // --- NEW: Check Lockout Status ---
    // Fetch user tracking info by email first (since we don't have the auth ID yet)
    const { data: userCheck, error: checkError } = await supabase
      .from("users")
      .select("id, failed_login_attempts, lockout_until")
      .eq("email", email)
      .maybeSingle();

    if (userCheck) {
      if (
        userCheck.lockout_until &&
        new Date(userCheck.lockout_until) > new Date()
      ) {
        const expiry = new Date(userCheck.lockout_until);
        const timeLeftHours = Math.ceil(
          (expiry - new Date()) / (1000 * 60 * 60),
        );
        return res.status(403).json({
          error: `Account locked due to multiple failed login attempts. Please try again in approximately ${timeLeftHours} hours.`,
        });
      }
    }
    // ---------------------------------

    // 1. Login with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    // --- NEW: Handle Failed Attempt ---
    if (authError) {
      // If the user exists in our public 'users' table, record the failure
      if (userCheck) {
        const currentAttempts = userCheck.failed_login_attempts || 0;
        const newAttempts = currentAttempts + 1;
        const updates = { failed_login_attempts: newAttempts };

        // If attempts reach 5, set lockout time to 24 hours from now
        if (newAttempts >= 5) {
          const lockoutTime = new Date();
          lockoutTime.setHours(lockoutTime.getHours() + 24);
          updates.lockout_until = lockoutTime.toISOString();
        }

        await supabase.from("users").update(updates).eq("id", userCheck.id); // using ID is safer than email here
      }
      return res.status(400).json({ error: authError.message });
    }
    // ----------------------------------

    // --- NEW: Reset Attempts on Success ---
    // If login succeeded, clear any previous failed attempts
    if (
      userCheck &&
      (userCheck.failed_login_attempts > 0 || userCheck.lockout_until)
    ) {
      await supabase
        .from("users")
        .update({ failed_login_attempts: 0, lockout_until: null })
        .eq("id", authData.user.id);
    }
    // --------------------------------------

    // 2. Fetch role from 'users' table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        "id, email, role, person_id, first_name, middle_name, last_name, birth_date",
      )
      .eq("id", authData.user.id)
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    console.log("=== Login Successful ===", userData);

    // 3. Return session with custom expiration timestamp
    const expiresAt = authData.session?.expires_at
      ? authData.session.expires_at * 1000
      : Date.now() + SESSION_DURATION;

    res.json({
      message: "Login successful",
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: expiresAt,
      },
      user: {
        id: userData.id,
        email: userData.email,
        person_id: userData.person_id,
        role: userData.role,
        first_name: userData.first_name,
        middle_name: userData.middle_name,
        last_name: userData.last_name,
        birth_date: userData.birth_date,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.refresh = async (req, res) => {
  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    const { data: authData, error: authError } =
      await supabase.auth.refreshSession({ refresh_token });

    if (authError || !authData?.session) {
      return res
        .status(401)
        .json({ error: authError?.message || "Refresh failed" });
    }

    const expiresAt = authData.session?.expires_at
      ? authData.session.expires_at * 1000
      : Date.now() + SESSION_DURATION;

    return res.json({
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("email, first_name, middle_name, last_name, birth_date")
      .order("first_name", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json({
      users:
        data.filter((user) => user.email !== "chasonjia.dev@gmail.com") || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Request a password reset email via Supabase
exports.resetPassword = async (req, res) => {
  const { email, redirectTo } = req.body || {};

  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const redirect =
      redirectTo ||
      process.env.FRONTEND_URL ||
      "https://paziuk.chasonjia-dev.workers.dev";

    // Support multiple versions of the Supabase client API
    let result;
    if (
      supabase.auth &&
      typeof supabase.auth.resetPasswordForEmail === "function"
    ) {
      result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirect}/pages/reset-password-confirm.html`,
      });
    } else if (
      supabase.auth &&
      supabase.auth.api &&
      typeof supabase.auth.api.resetPasswordForEmail === "function"
    ) {
      result = await supabase.auth.api.resetPasswordForEmail(email, {
        redirectTo: `${redirect}/pages/reset-password-confirm.html`,
      });
    } else {
      return res
        .status(500)
        .json({ error: "Unsupported Supabase client for password reset" });
    }

    if (result?.error) {
      return res
        .status(400)
        .json({ error: result.error.message || result.error });
    }

    return res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ error: err.message });
  }
};
