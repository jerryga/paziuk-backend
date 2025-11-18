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
      .select("*")
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
      .single();

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
  const { story } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: "Invalid person ID" });

  const { data, error } = await supabase
    .from("people")
    .update({ story })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  return res.json(data);
};

exports.getPersonDetails = async (req, res) => {
  const { id } = req.params;

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to get person details", error);
    res.status(400).json({ error: error.message });
    return;
  }

  if (person.story) {
    const html = await renderStoryToHTML(person.story);
    res.json({ ...person, storyHTML: html || "" });
  } else {
    res.json({ ...person, storyHTML: "" });
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
    nameMap[p.id] = buildPersonName(p);
  });

  const safe = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return story.replace(/\[person:(\d+)\]/g, (match, id) => {
    const name = nameMap[id] ?? `Unknown (${id})`;
    return `<a href="/person.html?id=${id}" class="person-link">${safe(
      name
    )}</a>`;
  });
}
