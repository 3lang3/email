export default {
  async email(message, env, ctx) {
    const { from, to } = message;
    const subject = message.headers.get("subject") || "";
    const date = message.headers.get("date") || new Date().toISOString();
    const messageId = message.headers.get("message-id") || crypto.randomUUID();

    // Read raw email body
    const rawBody = await new Response(message.raw).arrayBuffer();
    const bodyText = new TextDecoder().decode(rawBody);

    // Extract plain text content from the email body (simplified)
    let content = bodyText;
    const textMatch = bodyText.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\s*$)/i);
    if (textMatch) {
      content = textMatch[1].trim();
    }

    await env.DB.prepare(
      `INSERT INTO emails (message_id, sender, recipient, subject, body, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(messageId, from, to, subject, content, date).run();
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/emails") {
      let filterParams;

      if (request.method === "POST") {
        filterParams = await request.json();
      } else {
        filterParams = Object.fromEntries(url.searchParams);
      }

      const limit = Math.min(parseInt(filterParams.limit || "50"), 200);
      const offset = parseInt(filterParams.offset || "0");
      const { from, to, subject, minutes, search } = filterParams;

      let query = "SELECT * FROM emails";
      const conditions = [];
      const params = [];

      if (from) {
        conditions.push("sender = ?");
        params.push(from);
      }
      if (to) {
        conditions.push("recipient = ?");
        params.push(to);
      }
      if (subject) {
        conditions.push("subject LIKE ?");
        params.push(`%${subject}%`);
      }
      if (minutes) {
        const cutoff = new Date(Date.now() - parseInt(minutes) * 60000).toISOString();
        conditions.push("received_at >= ?");
        params.push(cutoff);
      }
      if (search) {
        conditions.push("(subject LIKE ? OR body LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY received_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const { results } = await env.DB.prepare(query).bind(...params).all();
      return Response.json({ emails: results });
    }

    if (url.pathname.startsWith("/api/emails/")) {
      const id = url.pathname.split("/").pop();
      const result = await env.DB.prepare(
        "SELECT * FROM emails WHERE id = ?"
      ).bind(id).first();

      if (!result) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      return Response.json({ email: result });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
}