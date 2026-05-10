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

exports.getAllObituaries = async (req, res) => {
  try {
    const { data: obituaries, error: obituaryError } = await supabase
      .from("obituaries")
      .select("id, person_id, content, updated_at")
      .order("updated_at", { ascending: false });

    if (obituaryError) throw obituaryError;

    const personIds = [
      ...new Set((obituaries || []).map((item) => item.person_id).filter(Boolean)),
    ];
    const peopleById = {};

    if (personIds.length > 0) {
      const { data: people, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, middle_name, last_name")
        .in("id", personIds);

      if (peopleError) throw peopleError;

      (people || []).forEach((person) => {
        peopleById[person.id] = formatPersonName(person);
      });
    }

    const records = (obituaries || []).map((obituary) => {
      const person = peopleById[obituary.person_id] || null;
      return {
        id: obituary.id,
        person_id: obituary.person_id,
        content: obituary.content || "",
        updated_at: obituary.updated_at,
        person,
        person_name: person?.name || "Unknown",
      };
    });

    res.json({ obituaries: records });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.createObituary = async (req, res) => {
  const content = String(req.body?.content || "").trim();
  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  try {
    const { data, error } = await supabase
      .from("obituaries")
      .insert([
        {
          content,
          person_id: null,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ obituary: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteObituary = async (req, res) => {
  const obituaryId = Number(req.params.id);
  if (Number.isNaN(obituaryId)) {
    return res.status(400).json({ error: "Invalid obituary ID" });
  }

  try {
    const { data, error } = await supabase
      .from("obituaries")
      .delete()
      .eq("id", obituaryId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Obituary not found" });
    }
    res.json({ message: "Obituary deleted", obituary: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.linkObituary = async (req, res) => {
  const personId = Number(req.params.id);
  const obituaryId = Number(req.body?.obituaryId);

  if (Number.isNaN(personId)) {
    return res.status(400).json({ error: "Invalid person ID" });
  }
  if (Number.isNaN(obituaryId)) {
    return res.status(400).json({ error: "Invalid obituary ID" });
  }

  try {
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .maybeSingle();

    if (personError) throw personError;
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    const { data: obituary, error: obituaryLookupError } = await supabase
      .from("obituaries")
      .select("id, person_id")
      .eq("id", obituaryId)
      .maybeSingle();

    if (obituaryLookupError) throw obituaryLookupError;
    if (!obituary) {
      return res.status(404).json({ error: "Obituary not found" });
    }

    if (obituary.person_id === personId) {
      return res.json({ message: "Obituary already linked to this person" });
    }

    // Unlink (set person_id = NULL) any existing obituary on the target person
    // instead of deleting it, so the displaced obituary remains recoverable as
    // an orphan and is visible at /pages/obituary.html?id=null.
    const { data: displacedRows, error: displaceError } = await supabase
      .from("obituaries")
      .update({ person_id: null, updated_at: new Date().toISOString() })
      .eq("person_id", personId)
      .select();

    if (displaceError) throw displaceError;

    const { data: updatedRows, error: updateError } = await supabase
      .from("obituaries")
      .update({
        person_id: personId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", obituaryId)
      .select();

    if (updateError) throw updateError;

    if (!updatedRows || updatedRows.length === 0) {
      console.error("linkObituary: update affected 0 rows", {
        personId,
        obituaryId,
      });
      return res
        .status(500)
        .json({ error: "Obituary update affected no rows." });
    }

    console.log("linkObituary success", {
      personId,
      obituaryId,
      displacedCount: displacedRows?.length || 0,
      updatedRow: updatedRows[0],
    });

    return res.json({
      message: "Obituary linked",
      obituary: updatedRows[0],
      displacedExisting: (displacedRows?.length || 0) > 0,
    });
  } catch (error) {
    console.error("Error linking obituary:", error);
    return res.status(500).json({ error: "Failed to link obituary" });
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
    const personData = { ...(req.body || {}) };
    if (personData.birth_date !== undefined) {
      personData.birth_date = normalizeBirthDateForDb(personData.birth_date);
    }
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
      birth_date: normalizeBirthDateForDb(birth_date),
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
    res.status(500).json({ error: "Failed to add sibling" });
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

    const { data: familyTreeRows, error: familyTreeError } = await supabase
      .from("relationships")
      .select("family_tree_id")
      .or(`parent_id.eq.${parentId},child_id.eq.${parentId}`)
      .not("family_tree_id", "is", null)
      .order("id", { ascending: false })
      .limit(1);

    if (familyTreeError) throw familyTreeError;
    const familyTreeId = familyTreeRows[0]?.family_tree_id ?? null;

    if (!familyTreeId) {
      return res.status(400).json({
        error:
          "Cannot add a child because the selected person is not part of any family tree.",
      });
    }

    const childPayload = {
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      birth_date: normalizeBirthDateForDb(birth_date),
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
      family_tree_id: familyTreeId,
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
    res.status(500).json({ error: "Failed to add child" });
  }
};

exports.updatePerson = async (req, res) => {
  try {
    const { id } = req.params;
    const personData = { ...(req.body || {}) };
    if (personData.birth_date !== undefined) {
      personData.birth_date = normalizeBirthDateForDb(personData.birth_date);
    }
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

    const { data: existingPerson, error: personLookupError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .maybeSingle();

    if (personLookupError) throw personLookupError;
    if (!existingPerson) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Remove relationships referencing this person before deleting the record
    const { error: relError } = await supabase
      .from("relationships")
      .delete()
      .or(`parent_id.eq.${personId},child_id.eq.${personId}`);

    const { error } = await supabase.from("people").delete().eq("id", personId);
    console.log("Delete person result:", error, personId);
    if (error) throw error;
    res.json({ message: "Person deleted successfully" });
  } catch (error) {
    console.error("Error deleting person:", error);
    res.status(500).json({ error: "Failed to delete person" });
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
        `first_name.ilike.%${q}%,middle_name.ilike.%${q}%,last_name.ilike.%${q}%`,
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
  try {
    const personId = Number(req.params.id);
    if (Number.isNaN(personId)) {
      return res.status(400).json({ error: "Invalid person ID" });
    }

    const { story, obituary, birth_date, first_name, middle_name, last_name } =
      req.body || {};

    const updateData = {};
    const assignIfProvided = (key, value) => {
      if (value !== undefined) {
        updateData[key] = value === "" ? null : value;
      }
    };

    assignIfProvided("story", story);
    if (birth_date !== undefined) {
      assignIfProvided("birth_date", normalizeBirthDateForDb(birth_date));
    }
    assignIfProvided("first_name", first_name);
    assignIfProvided("middle_name", middle_name);
    assignIfProvided("last_name", last_name);

    const hasPersonUpdate = Object.keys(updateData).length > 0;
    const hasObituaryUpdate = obituary !== undefined;

    if (!hasPersonUpdate && !hasObituaryUpdate) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    let savedPerson = null;

    if (hasPersonUpdate) {
      const { data, error } = await supabase
        .from("people")
        .update(updateData)
        .eq("id", personId)
        .select()
        .maybeSingle();

      console.log("Save person update result:", error, personId);

      if (error) return res.status(400).json({ error: error.message });
      savedPerson = data;
    } else {
      const { data, error } = await supabase
        .from("people")
        .select("id")
        .eq("id", personId)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      savedPerson = data;
    }

    if (!savedPerson) {
      return res.status(404).json({ error: "Person not found! Try again." });
    }

    if (hasObituaryUpdate) {
      const obituaryText = String(obituary || "").trim();

      if (obituaryText) {
        const { error: obituaryError } = await supabase
          .from("obituaries")
          .upsert(
            {
              person_id: personId,
              content: obituaryText,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "person_id" },
          );

        if (obituaryError) {
          return res.status(400).json({ error: obituaryError.message });
        }
      } else {
        const { error: obituaryError } = await supabase
          .from("obituaries")
          .delete()
          .eq("person_id", personId);

        if (obituaryError) {
          return res.status(400).json({ error: obituaryError.message });
        }
      }
    }

    return res.json(savedPerson);
  } catch (err) {
    console.error("Error saving person:", err);
    return res.status(400).json({ error: err.message });
  }
};

// Modified getPersonDetails
exports.getPersonDetails = async (req, res) => {
  const id = Number(req.params.id);
  const mode = req.query.mode;

  res.set("Cache-Control", "no-store");

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
            (uid) => !parentIds.includes(uid),
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

    const { data: obituaryRow, error: obituaryError } = await supabase
      .from("obituaries")
      .select("content")
      .eq("person_id", id)
      .maybeSingle();

    if (obituaryError) throw obituaryError;

    const obituary = obituaryRow?.content || "";

    // Render Story and Obituary
    let storyHTML = "";
    if (person.story) {
      storyHTML = (await renderStoryToHTML(person.story)) || "";
    }

    let obituaryHTML = "";
    if (obituary) {
      obituaryHTML = (await renderStoryToHTML(obituary)) || "";
    }

    res.json({
      id: person.id,
      first_name: person.first_name,
      middle_name: person.middle_name,
      last_name: person.last_name,
      birth_date: person.birth_date,
      name: formatPersonName(person).name,
      role: person.role,
      story: person.story || "",
      storyHTML,
      obituary,
      obituaryHTML,
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
      Array.from(story.matchAll(/\[person:(\d+)\]/g)).map((m) => Number(m[1])),
    ),
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
