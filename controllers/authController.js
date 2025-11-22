const supabase = require("../supabaseClient");

exports.signup = async (req, res) => {
  const {
    email,
    password,
    first_name,
    middle_name,
    last_name,
    birth_date,
    birth_place,
  } = req.body; // optional: name

  console.log("=== Signup Request ===");
  console.log("Request body:", {
    email,
    first_name,
    middle_name,
    last_name,
    birth_date,
    birth_place,
  });

  try {
    let query = supabase
      .from("people")
      .select(
        "id, first_name, middle_name, last_name, birth_date, birth_place, role"
      )
      .ilike("first_name", first_name)
      .eq("birth_date", birth_date);

    if (
      middle_name !== null &&
      middle_name !== undefined &&
      middle_name !== ""
    ) {
      query = query.ilike("middle_name", middle_name);
      console.log("  - middle_name (ilike):", middle_name);
    } else {
      query = query.is("middle_name", null);
      console.log("  - middle_name (is null): true");
    }

    if (last_name !== null && last_name !== undefined && last_name !== "") {
      query = query.ilike("last_name", last_name);
      console.log("  - last_name (ilike):", last_name);
    } else {
      query = query.is("last_name", null);
      console.log("  - last_name (is null): true");
    }

    const { data: personData, error: personError } = await query.maybeSingle();

    if (personError) {
      console.error("Person lookup query error:", personError);
      return res.status(500).json({
        error: "Database query failed",
        details: personError.message,
      });
    }

    if (!personData) {
      console.error("Person not found with criteria");

      // Try to find similar records for debugging
      const { data: similarPeople } = await supabase
        .from("people")
        .select("id, first_name, middle_name, last_name, birth_date")
        .ilike("first_name", first_name)
        .limit(5);

      console.log(
        "Similar people found with matching first name:",
        similarPeople
      );

      return res.status(404).json({
        error: "Person not found",
        details: "No person matches the provided name and birth date",
        searchCriteria: {
          first_name,
          middle_name: middle_name || null,
          last_name: last_name || null,
          birth_date,
        },
        hint: "Check if the person exists in the database with the exact name and birth date",
        similarRecords: similarPeople,
      });
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("Auth signup failed:", authError);
      return res.status(400).json({ error: authError.message });
    }

    //update birth_place if provided
    if (birth_place) {
      console.log("Updating birth_place for person: ", personData);
      const { data, error } = await supabase
        .from("people")
        .update({ birth_place })
        .eq("id", personData.id)
        .select();

      console.log("update result:", { data, error });

      if (error) {
        console.error("Failed to update birth_place:", error);
      } else if (!data || data.length === 0) {
        console.warn(
          "Update succeeded but no rows returned — id may not match or RLS blocked it."
        );
      } else {
        personData.birth_place = birth_place;
        console.log("Updated birth_place for person ID", personData.id);
      }
    }
    // 2. Create user record in your 'users' table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([
        {
          id: authData.user.id,
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
      console.error("User table insert failed:", userError);
      return res.status(400).json({ error: userError.message });
    }

    // 3. Return session and role
    console.log("=== Signup Successful ===", personData);
    console.log("=== User Data ===", userData);

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
        birth_place: userData.birth_place || null,
      },
    });
  } catch (err) {
    console.error("=== Signup Error ===");
    console.error("Error:", err);
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
          (expiry - new Date()) / (1000 * 60 * 60)
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
        "id, email, role, person_id, first_name, middle_name, last_name, birth_date"
      )
      .eq("id", authData.user.id)
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    console.log("=== Login Successful ===", userData);

    // 3. Return session with custom expiration timestamp
    res.json({
      message: "Login successful",
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: Date.now() + 3600000, // 1 hour from now
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
