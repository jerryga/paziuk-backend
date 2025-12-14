const supabase = require("../supabaseClient");

exports.createMessage = async (req, res) => {
  const { personId, name, extra_info } = req.body;
  try {
    if (!personId) {
      return res.status(400).json({ error: "personId is required" });
    }

    // Enforce one message per person
    const { data: existingMessages, error: fetchError } = await supabase
      .from("messages")
      .select("id")
      .eq("person_id", personId)
      .limit(1);
    console.log(existingMessages, fetchError);
    if (fetchError) throw fetchError;
    if (existingMessages && existingMessages.length > 0) {
      return res
        .status(409)
        .json({ error: "A message for this person already exists" });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([{ person_id: personId, person_name: name, extra_info }])
      .select("*")
      .single();

    console.log(data, error);
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id);
    if (error) throw error;
    res.json({ message: "Message deleted", data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getMessageByPersonId = async (req, res) => {
  const { personId } = req.params;
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
