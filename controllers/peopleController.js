const supabase = require("../supabaseClient");

// Helper function to format person name
function formatPersonName(person) {
  if (!person) return null;
  const parts = [
    person.first_name,
    person.middle_name,
    person.last_name,
  ].filter(Boolean);
  return {
    ...person,
    name: parts.join(" ") || "Unknown",
  };
}

// Get all people
exports.getAllPeople = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("people")
      .select("id, first_name, middle_name, last_name, role, story, extra_info")
      .order("first_name", { ascending: true });

    if (error) throw error;

    const formattedPeople = data.map(formatPersonName);
    res.json(formattedPeople);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get person by ID
exports.getPersonById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    res.json(formatPersonName(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Create a new person
exports.createPerson = async (req, res) => {
  try {
    const personData = req.body;

    const { data, error } = await supabase
      .from("people")
      .insert([personData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatPersonName(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update a person
exports.updatePerson = async (req, res) => {
  try {
    const { id } = req.params;
    const personData = req.body;

    const { data, error } = await supabase
      .from("people")
      .update(personData)
      .eq("id", id)
      .select()
      .maybeSingle(); // safer than .single()

    if (error) throw error;

    res.json(formatPersonName(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a person
exports.deletePerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("people").delete().eq("id", id);

    if (error) throw error;
    res.json({ message: "Person deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Search people by name
exports.searchPeople = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const { data, error } = await supabase
      .from("people")
      .select("*")
      .or(
        `first_name.ilike.%${q}%,middle_name.ilike.%${q}%,last_name.ilike.%${q}%`
      )
      .order("first_name", { ascending: true });

    if (error) throw error;

    const formattedPeople = data.map(formatPersonName);
    res.json(formattedPeople);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Story
exports.savePersonStory = async (req, res) => {
  const id = Number(req.params.id);
  const { story, birth_date } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: "Invalid person ID" });

  const updateData = { story };
  if (birth_date) {
    updateData.birth_date = birth_date;
  }

  const { data, error } = await supabase
    .from("people")
    .update(updateData)
    .eq("id", id)
    .select()
    .maybeSingle();
  console.log("Save story update result:", data, error);
  if (error) return res.status(400).json({ error: error.message });

  return res.json(data);
};

exports.getPersonDetails = async (req, res) => {
  const id = Number(req.params.id);

  try {
    // 1. Fetch current person
    const { data: person, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    // 2. Fetch Parents (find relationships where this person is the child)
    const { data: parentRels } = await supabase
      .from("relationships")
      .select("parent_id, family_tree_id")
      .eq("child_id", id);

    const familyTreeId =
      parentRels.length > 0 ? parentRels[0].family_tree_id : null;

    let ancestorIds = [];
    if (familyTreeId) {
      const { data: tree } = await supabase
        .from("family_tree")
        .select("ancestor")
        .eq("id", familyTreeId)
        .maybeSingle();
      if (tree && tree.ancestor && tree.ancestor !== id) {
        ancestorIds.push(tree.ancestor);
      }
    }

    const parentIds = (parentRels || []).map((r) => r.parent_id);
    // Ensure ancestorIds are not included in parentIds
    const filteredParentIds = parentIds.filter(
      (pid) => !ancestorIds.includes(pid)
    );

    let siblingIds = [];
    if (filteredParentIds.length > 0) {
      const { data: siblingRels } = await supabase
        .from("relationships")
        .select("child_id")
        .in("parent_id", filteredParentIds)
        .neq("child_id", id);

      // Unique set of sibling IDs
      siblingIds = [...new Set((siblingRels || []).map((r) => r.child_id))];
    }

    // 4. Fetch details for all related people (parents + siblings)
    const relatedIds = [
      ...new Set([...ancestorIds, ...filteredParentIds, ...siblingIds]),
    ];
    const relatedMap = {};

    if (relatedIds.length > 0) {
      const { data: relatives } = await supabase
        .from("people")
        .select("id, first_name, middle_name, last_name")
        .in("id", relatedIds);

      (relatives || []).forEach((p) => {
        relatedMap[p.id] = formatPersonName(p);
      });
    }

    // 5. Prepare response arrays
    const ancestors = ancestorIds.map((aid) => relatedMap[aid]).filter(Boolean);
    const parents = filteredParentIds
      .map((pid) => relatedMap[pid])
      .filter(Boolean);
    const siblings = siblingIds.map((sid) => relatedMap[sid]).filter(Boolean);

    // 6. Render Story HTML
    let storyHTML = "";
    if (person.story) {
      storyHTML = (await renderStoryToHTML(person.story)) || "";
    }

    // 7. Return combined data
    res.json({
      ...formatPersonName(person),
      storyHTML,
      ancestors,
      parents,
      siblings,
    });
  } catch (error) {
    console.error("Error fetching person details:", error);
    res.status(400).json({ error: error.message });
  }
};

async function renderStoryToHTML(story) {
  // get all unique IDs mentioned in the story
  const ids = Array.from(
    new Set(
      Array.from(story.matchAll(/\[person:(\d+)\]/g)).map((m) => Number(m[1]))
    )
  );

  // fetch only those people
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, middle_name, last_name")
    .in("id", ids);

  const nameMap = {};
  (data || []).forEach((p) => {
    nameMap[p.id] = formatPersonName(p);
  });

  const safe = (s) =>
    typeof s === "string"
      ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "";

  return story.replace(/\[person:(\d+)\]/g, (match, id) => {
    const name = nameMap[id]["name"] ?? `Unknown (${id})`;
    return `<a href="/pages/person.html?id=${id}">${safe(name)}</a>`;
  });
}
