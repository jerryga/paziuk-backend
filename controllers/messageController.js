const supabase = require("../supabaseClient");

exports.createMessage = async (req, res) => {
  const { personId, extra_info } = req.body;
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
    if (fetchError) throw fetchError;
    if (existingMessages && existingMessages.length > 0) {
      return res
        .status(409)
        .json({ error: "A message for this person already exists" });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([{ person_id: personId, extra_info }])
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { data, error } = await supabase.from("messages").select("*");
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
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
