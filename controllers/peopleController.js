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

    console.log("Updating person ID:", id, "with data:", personData);

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

  console.log("Saved story for person ID:", id, "Result:", data, error);
  console.log("Story content:", story);
  if (birth_date) {
    console.log("Updated birth_date:", birth_date);
  }

  if (error) return res.status(400).json({ error: error.message });

  return res.json(data);
};

// Modified getPersonDetails based on the diagram logic
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

    // --- Helper Methods for Recursion ---

    // Helper: Fetch parents for a list of child IDs
    const getParentsIds = async (childIds) => {
      if (!childIds || childIds.length === 0) return [];
      const { data } = await supabase
        .from("relationships")
        .select("parent_id")
        .in("child_id", childIds);
      // Return unique parent IDs
      return [...new Set((data || []).map((r) => r.parent_id))];
    };

<<<<<<< Updated upstream
    let ancestorIds = [];
    if (familyTreeId) {
      console.log(`Person ID ${id} belongs to Family Tree ID ${familyTreeId}`);
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
=======
    // Helper: Fetch children for a list of parent IDs
    const getChildrenIds = async (parentIds) => {
      if (!parentIds || parentIds.length === 0) return [];
      const { data } = await supabase
>>>>>>> Stashed changes
        .from("relationships")
        .select("child_id")
        .in("parent_id", parentIds);
      return [...new Set((data || []).map((r) => r.child_id))];
    };

    // --- Logic to Implement the Diagram ---

    // Step 1: Get immediate parents of the person (H)
    const hParentIds = await getParentsIds([id]);

    // Step 2: Get siblings of the person (H)
    // (Children of H's parents excluding H)
    let hSiblingIds = [];
    if (hParentIds.length > 0) {
      const allChildren = await getChildrenIds(hParentIds);
      hSiblingIds = allChildren.filter((sid) => sid !== id);
    }

    // Step 3: Recursive Ancestry Loop
    // Structure: We want a list of generations.
    // Generation 1: H's parents + H's parents' siblings
    // Generation 2: H's grandparents + H's grandparents' siblings
    let generations = [];
    let currentChildBatch = [id];
    let loopSafety = 0;
    const MAX_GENERATIONS = 10;

    while (loopSafety < MAX_GENERATIONS) {
      // Find parents of the current batch
      const parentIds = await getParentsIds(currentChildBatch);
      if (parentIds.length === 0) break; // Stop if no parents found

      // Find siblings of these parents
      // To find a parent's siblings, we need the parent's parents (grandparents of current batch)
      const grandParentIds = await getParentsIds(parentIds);

      let parentSiblingIds = [];
      if (grandParentIds.length > 0) {
        const auntsUncles = await getChildrenIds(grandParentIds);
        // Siblings are children of grandparents, excluding the direct parents
        parentSiblingIds = auntsUncles.filter(
          (uid) => !parentIds.includes(uid)
        );
      }

      generations.push({
        level: loopSafety + 1,
        parentIds: parentIds,
        siblingIds: parentSiblingIds,
      });

      // Move up the tree: parents become the children for the next iteration
      currentChildBatch = parentIds;
      loopSafety++;
    }

    // --- Fetch Details for All Collected IDs ---

    // Collect all unique IDs to fetch
    const allRelatedIds = new Set([...hSiblingIds]);
    generations.forEach((gen) => {
      gen.parentIds.forEach((pid) => allRelatedIds.add(pid));
      gen.siblingIds.forEach((sid) => allRelatedIds.add(sid));
    });

    const allIdsArray = Array.from(allRelatedIds);
    const relatedPeopleMap = {};

    if (allIdsArray.length > 0) {
      const { data: relatives } = await supabase
        .from("people")
        .select("id, first_name, middle_name, last_name")
        .in("id", allIdsArray);

      (relatives || []).forEach((p) => {
        relatedPeopleMap[p.id] = formatPersonName(p);
      });
    }

    // --- Construct Response ---

    // H's siblings
    const siblings = hSiblingIds
      .map((sid) => relatedPeopleMap[sid])
      .filter(Boolean);

    // H's direct parents (from Generation 1)
    const parents =
      generations.length > 0
        ? generations[0].parentIds
            .map((pid) => relatedPeopleMap[pid])
            .filter(Boolean)
        : [];

    // Full lineage with siblings at each level
    const ancestral_generations = generations.map((gen) => ({
      level: gen.level,
      parents: gen.parentIds
        .map((pid) => relatedPeopleMap[pid])
        .filter(Boolean),
      siblings: gen.siblingIds
        .map((sid) => relatedPeopleMap[sid])
        .filter(Boolean),
    }));

    // Flattened list of ancestors for backward compatibility or easy access
    const ancestors = [];
    generations.forEach((gen) => {
      gen.parentIds.forEach((pid) => {
        if (relatedPeopleMap[pid]) ancestors.push(relatedPeopleMap[pid]);
      });
    });

    // Render Story HTML
    let storyHTML = "";
    if (person.story) {
      storyHTML = (await renderStoryToHTML(person.story)) || "";
    }

    // Return combined data
    res.json({
      ...formatPersonName(person),
      storyHTML,
      siblings,
      parents,
      ancestors,
      ancestral_generations, // This contains the structured diagram data: [{ parents: [E], siblings: [F,G] }, ...]
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

<<<<<<< Updated upstream
  console.log("rednering story, found person IDs:", ids);
=======
  if (ids.length === 0) return story;
>>>>>>> Stashed changes

  // fetch only those people
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, middle_name, last_name")
    .in("id", ids);

  if (error) {
    console.error("Error parsing story names", error);
    return story;
  }

  const nameMap = {};
  (data || []).forEach((p) => {
    nameMap[p.id] = formatPersonName(p);
  });

  console.log("Fetched person names for story rendering:", nameMap);

  const safe = (s) =>
    typeof s === "string"
      ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "";

  return story.replace(/\[person:(\d+)\]/g, (match, id) => {
    const info = nameMap[id];
    const name = info ? info.name : `Unknown (${id})`;
    return `<a href="/pages/person.html?id=${id}">${safe(name)}</a>`;
  });
}
