const supabase = require("../supabaseClient");

exports.signup = async (req, res) => {
  const { email, password, first_name, middle_name, last_name, birth_date } =
    req.body; // optional: name

  console.log("=== Signup Request ===");
  console.log("Request body:", {
    email,
    first_name,
    middle_name,
    last_name,
    birth_date,
  });

  try {
    let query = supabase
      .from("people")
      .select("id, first_name, middle_name, last_name, birth_date, role")
      .ilike("first_name", first_name)
      .eq("birth_date", birth_date);

    console.log("Query conditions:");
    console.log("  - first_name (ilike):", first_name);
    console.log("  - birth_date (eq):", birth_date);

    // Handle nullable middle_name
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

    // Handle nullable last_name
    if (last_name !== null && last_name !== undefined && last_name !== "") {
      query = query.ilike("last_name", last_name);
      console.log("  - last_name (ilike):", last_name);
    } else {
      query = query.is("last_name", null);
      console.log("  - last_name (is null): true");
    }

    const { data: personData, error: personError } = await query.maybeSingle();

    console.log("Query result:");
    console.log("  - data:", personData);
    console.log("  - error:", personError);

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
      options: {
        data: {
          person_id: personData.id,
          name: `${personData.first_name} ${
            personData.middle_name ? personData.middle_name + " " : ""
          }${personData.last_name ? personData.last_name : ""}`.trim(),
          role: personData.role,
        },
      },
    });

    console.log("Auth signup result:");
    console.log("  - user:", authData?.user?.id);
    console.log("  - error:", authError);

    if (authError) {
      console.error("Auth signup failed:", authError);
      return res.status(400).json({ error: authError.message });
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
        },
      ])
      .select()
      .single();

    console.log("User table insert result:");
    console.log("  - data:", userData);
    console.log("  - error:", userError);

    if (userError) {
      console.error("User table insert failed:", userError);
      return res.status(400).json({ error: userError.message });
    }

    // 3. Return session and role
    console.log("=== Signup Successful ===");
    res.json({
      message: "Signup successful",
      session: authData.session,
      user: { id: userData.id, email: userData.email, role: userData.role },
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
