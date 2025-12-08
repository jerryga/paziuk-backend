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

// ... [Existing methods: getAllPeople, getPersonById, createPerson, updatePerson, deletePerson, searchPeople, savePersonStory] ...

exports.getAllPeople = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("people")
      .select("id, first_name, middle_name, last_name, role, story, birth_date")
      .order("first_name", { ascending: true });

    if (error) throw error;

    const formattedPeople = data.map(formatPersonName);
    res.json(formattedPeople);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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

exports.addSibling = async (req, res) => {
  const basePersonId = Number(req.params.id);
  if (Number.isNaN(basePersonId)) {
    return res.status(400).json({ error: "Invalid person ID" });
  }

  const { first_name, middle_name, last_name, birth_date, story } =
    req.body || {};
  if (!first_name && !last_name) {
    return res
      .status(400)
      .json({ error: "Please provide at least a first or last name." });
  }

  try {
    const { data: personExists, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", basePersonId)
      .single();

    if (personError) throw personError;
    if (!personExists) {
      return res.status(404).json({ error: "Base person not found" });
    }

    const { data: parentLinks, error: parentError } = await supabase
      .from("relationships")
      .select("parent_id, relation_type, notes, family_tree_id")
      .eq("child_id", basePersonId);

    if (parentError) throw parentError;
    if (!parentLinks || parentLinks.length === 0) {
      return res.status(400).json({
        error:
          "Cannot add a sibling because the selected person has no recorded parents.",
      });
    }

    const siblingPayload = {
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      birth_date: birth_date || null,
      story: story || null,
    };

    const { data: newPerson, error: createError } = await supabase
      .from("people")
      .insert([siblingPayload])
      .select()
      .single();

    if (createError) throw createError;

    const relationshipPayload = parentLinks.map((link) => ({
      parent_id: link.parent_id,
      child_id: newPerson.id,
      relation_type: link.relation_type || null,
      notes: link.notes || null,
      family_tree_id: link.family_tree_id || null,
    }));

    if (relationshipPayload.length > 0) {
      const { error: relInsertError } = await supabase
        .from("relationships")
        .insert(relationshipPayload);

      if (relInsertError) {
        await supabase.from("people").delete().eq("id", newPerson.id);
        throw relInsertError;
      }
    }

    return res.status(201).json({
      person: formatPersonName(newPerson),
      linkedParents: relationshipPayload.map((rel) => rel.parent_id),
    });
  } catch (error) {
    console.error("Error adding sibling:", error);
    res.status(400).json({ error: error.message });
  }
};

exports.addChild = async (req, res) => {
  const parentId = Number(req.params.id);
  if (Number.isNaN(parentId)) {
    return res.status(400).json({ error: "Invalid person ID" });
  }

  const {
    first_name,
    middle_name,
    last_name,
    birth_date,
    story,
    relation_type,
    notes,
    family_tree_id,
  } = req.body || {};

  if (!first_name && !last_name) {
    return res
      .status(400)
      .json({ error: "Please provide at least a first or last name." });
  }

  try {
    const { data: parentExists, error: parentError } = await supabase
      .from("people")
      .select("id")
      .eq("id", parentId)
      .single();

    if (parentError) throw parentError;
    if (!parentExists) {
      return res.status(404).json({ error: "Parent not found" });
    }

    const childPayload = {
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      birth_date: birth_date || null,
      story: story || null,
    };

    const { data: newChild, error: createError } = await supabase
      .from("people")
      .insert([childPayload])
      .select()
      .single();

    if (createError) throw createError;

    const relationshipPayload = {
      parent_id: parentId,
      child_id: newChild.id,
      relation_type: relation_type || null,
      notes: notes || null,
      family_tree_id: family_tree_id || null,
    };

    const { error: relInsertError } = await supabase
      .from("relationships")
      .insert([relationshipPayload]);

    if (relInsertError) {
      await supabase.from("people").delete().eq("id", newChild.id);
      throw relInsertError;
    }

    return res.status(201).json({
      person: formatPersonName(newChild),
      linkedParent: parentId,
    });
  } catch (error) {
    console.error("Error adding child:", error);
    res.status(400).json({ error: error.message });
  }
};

exports.updatePerson = async (req, res) => {
  try {
    const { id } = req.params;
    const personData = req.body;
    const { data, error } = await supabase
      .from("people")
      .update(personData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.json(formatPersonName(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deletePerson = async (req, res) => {
  try {
    const personId = Number(req.params.id);
    if (Number.isNaN(personId)) {
      return res.status(400).json({ error: "Invalid person ID" });
    }
    // Remove relationships referencing this person before deleting the record
    const { error: relError } = await supabase
      .from("relationships")
      .delete()
      .or(`parent_id.eq.${personId},child_id.eq.${personId}`);

    if (relError) throw relError;

    const { error } = await supabase.from("people").delete().eq("id", personId);

    if (error) throw error;
    res.json({ message: "Person deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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

exports.savePerson = async (req, res) => {
  const { id, story, birth_date, first_name, middle_name, last_name } =
    req.body;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid person ID" });
  const updateData = { story };
  if (birth_date) {
    updateData.birth_date = birth_date;
  }
  updateData.first_name = first_name;
  updateData.middle_name = middle_name;
  updateData.last_name = last_name;
  const { data, error } = await supabase
    .from("people")
    .update(updateData)
    .eq("id", id)
    .select()
    .maybeSingle();
  console.log("Save story update result:", data, error);
  if (data == null)
    return res.status(404).json({ error: "Person not found! Try again." });
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
};

// Modified getPersonDetails
exports.getPersonDetails = async (req, res) => {
  const id = Number(req.params.id);
  const mode = req.query.mode;

  try {
    // 1. Fetch current person
    const { data: person, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    let current_generation = [];
    let ancestral_generations = [];
    if (mode || mode !== "edit") {
      const getParentsIds = async (childIds) => {
        if (!childIds || childIds.length === 0) return [];
        const { data } = await supabase
          .from("relationships")
          .select("parent_id")
          .in("child_id", childIds);
        return [...new Set((data || []).map((r) => r.parent_id))];
      };

      const getChildrenIds = async (parentIds) => {
        if (!parentIds || parentIds.length === 0) return [];
        const { data } = await supabase
          .from("relationships")
          .select("child_id")
          .in("parent_id", parentIds);
        return [...new Set((data || []).map((r) => r.child_id))];
      };

      // --- Diagram Logic ---

      // Step 1: Get immediate parents of the person (H)
      const hParentIds = await getParentsIds([id]);

      // Step 2: Get ALL children of these parents (H + Siblings)
      // If no parents found, the "current generation" is just H.
      let currentGenIds = [id];
      if (hParentIds.length > 0) {
        const allChildren = await getChildrenIds(hParentIds);
        // Add unique children (just in case)
        const combined = new Set([...allChildren, id]);
        currentGenIds = Array.from(combined);
      }

      // Step 3: Recursive Ancestry Loop (Parents, Grandparents...)
      let generations = [];
      let currentChildBatch = [id];
      let loopSafety = 0;
      const MAX_GENERATIONS = 10;

      while (loopSafety < MAX_GENERATIONS) {
        const parentIds = await getParentsIds(currentChildBatch);
        if (parentIds.length === 0) break;

        const grandParentIds = await getParentsIds(parentIds);
        let parentSiblingIds = [];
        if (grandParentIds.length > 0) {
          const auntsUncles = await getChildrenIds(grandParentIds);
          parentSiblingIds = auntsUncles.filter(
            (uid) => !parentIds.includes(uid)
          );
        }

        generations.push({
          level: loopSafety + 1,
          parentIds: parentIds,
          siblingIds: parentSiblingIds,
        });

        currentChildBatch = parentIds;
        loopSafety++;
      }

      // --- Fetch Details ---

      // Collect all IDs
      const allRelatedIds = new Set([...currentGenIds]);
      generations.forEach((gen) => {
        gen.parentIds.forEach((pid) => allRelatedIds.add(pid));
        gen.siblingIds.forEach((sid) => allRelatedIds.add(sid));
      });

      const allIdsArray = Array.from(allRelatedIds);
      const relatedPeopleMap = {};

      if (allIdsArray.length > 0) {
        const { data: relatives } = await supabase
          .from("people")
          .select("id, first_name, middle_name, last_name, birth_date") // Added birth_date for sorting
          .in("id", allIdsArray);

        (relatives || []).forEach((p) => {
          relatedPeopleMap[p.id] = formatPersonName(p);
        });
      }

      // --- Construct Response ---

      // Sort function: Birth date (asc), then ID (asc) as fallback
      const sortByDate = (a, b) => {
        const dateA = a.birth_date || "9999-12-31";
        const dateB = b.birth_date || "9999-12-31";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.id - b.id;
      };

      // Current Generation (H + Siblings) Sorted
      current_generation = currentGenIds
        .map((gid) => relatedPeopleMap[gid])
        .filter(Boolean)
        .sort(sortByDate);

      // Ancestral Generations Sorted
      ancestral_generations = generations.map((gen) => {
        const parents = gen.parentIds
          .map((pid) => relatedPeopleMap[pid])
          .filter(Boolean)
          .sort(sortByDate);
        const siblings = gen.siblingIds
          .map((sid) => relatedPeopleMap[sid])
          .filter(Boolean)
          .sort(sortByDate);
        return {
          level: gen.level,
          parents,
          siblings,
        };
      });
    }

    // Render Story
    let storyHTML = "";
    if (person.story) {
      storyHTML = (await renderStoryToHTML(person.story)) || "";
    }

    res.json({
      id: person.id,
      first_name: person.first_name,
      middle_name: person.middle_name,
      last_name: person.last_name,
      birth_date: person.birth_date,
      name: formatPersonName(person).name,
      role: person.role,
      storyHTML,
      current_generation, // The sorted list including self and siblings
      ancestral_generations,
    });
  } catch (error) {
    console.error("Error fetching person details:", error);
    res.status(400).json({ error: error.message });
  }
};

async function renderStoryToHTML(story) {
  const ids = Array.from(
    new Set(
      Array.from(story.matchAll(/\[person:(\d+)\]/g)).map((m) => Number(m[1]))
    )
  );
  if (ids.length === 0) return story;

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
