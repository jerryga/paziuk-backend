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
    id: person.id,
    name: parts.join(" ") || "Unknown",
    first_name: person.first_name,
    middle_name: person.middle_name,
    last_name: person.last_name,
  };
}

// Helper function to format relationship type
function formatRelationType(relType) {
  if (!relType) return null;
  // Handle different possible column names
  const typeName =
    relType.type_name || relType.name || relType.type || "Unknown";
  return {
    id: relType.id,
    type_name: typeName,
    ...relType, // Include all original fields
  };
}

// Helper function to format relationships response
function formatRelationships(relationships) {
  if (!relationships) return [];
  return relationships.map((rel) => ({
    id: rel.id,
    created_at: rel.created_at,
    notes: rel.notes,
    parent: formatPersonName(rel.parent),
    child: formatPersonName(rel.child),
    relation_type: formatRelationType(rel.relation_type),
  }));
}

exports.getAllFamilyTrees = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("family_tree")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all relationships with related data (people and relationship type)
exports.getAllRelationships = async (req, res) => {
  try {
    const familyTreeId = req.query.family_tree_id;

    const { data, error } = await supabase
      .from("relationships")
      .select(
        `
        id,
        created_at,
        notes,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*),
        family_tree:family_tree(id, name)
      `
      )
      .eq("family_tree_id", familyTreeId) // ← FILTER HERE
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(formatRelationships(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get relationships for a specific person (as parent)
exports.getRelationshipsByParent = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { data, error } = await supabase
      .from("relationships")
      .select(
        `
        id,
        created_at,
        notes,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      )
      .eq("parent_id", parentId);

    if (error) throw error;
    res.json(formatRelationships(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get relationships for a specific person (as child)
exports.getRelationshipsByChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const { data, error } = await supabase
      .from("relationships")
      .select(
        `
        id,
        created_at,
        notes,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      )
      .eq("child_id", childId);

    if (error) throw error;
    res.json(formatRelationships(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all relationships for a person (both as parent and child)
exports.getRelationshipsByPerson = async (req, res) => {
  try {
    const { personId } = req.params;

    // Get relationships where person is parent
    const { data: asParent, error: error1 } = await supabase
      .from("relationships")
      .select(
        `
        id,
        created_at,
        notes,
        role:parent_id,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      )
      .eq("parent_id", personId);

    // Get relationships where person is child
    const { data: asChild, error: error2 } = await supabase
      .from("relationships")
      .select(
        `
        id,
        created_at,
        notes,
        role:child_id,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      )
      .eq("child_id", personId);

    if (error1 || error2) throw error1 || error2;

    res.json({
      asParent: formatRelationships(asParent || []),
      asChild: formatRelationships(asChild || []),
      all: formatRelationships([...(asParent || []), ...(asChild || [])]),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Create a new relationship
exports.createRelationship = async (req, res) => {
  try {
    const { parent_id, child_id, relation_type, notes } = req.body;

    // Validate required fields
    if (!parent_id || !child_id || !relation_type) {
      return res.status(400).json({
        error: "parent_id, child_id, and relation_type are required",
      });
    }

    const { data, error } = await supabase
      .from("relationships")
      .insert([{ parent_id, child_id, relation_type, notes }])
      .select(
        `
        id,
        created_at,
        notes,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      );

    if (error) throw error;
    const formatted = formatRelationships(data);
    res.status(201).json(formatted[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update a relationship
exports.updateRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id, child_id, relation_type, notes } = req.body;

    const { data, error } = await supabase
      .from("relationships")
      .update({ parent_id, child_id, relation_type, notes })
      .eq("id", id)
      .select(
        `
        id,
        created_at,
        notes,
        parent:people!relationships_parent_id_fkey(id, first_name, middle_name, last_name),
        child:people!relationships_child_id_fkey(id, first_name, middle_name, last_name),
        relation_type:relationship_type(*)
      `
      );

    if (error) throw error;
    const formatted = formatRelationships(data);
    res.json(formatted[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a relationship
exports.deleteRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("relationships")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.json({ message: "Relationship deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
