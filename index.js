import { EmailMessage } from "cloudflare:email";

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
    ).bind(messageId, from.toLowerCase(), to.toLowerCase(), subject, content, date).run();
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
        params.push(from.toLowerCase());
      }
      if (to) {
        conditions.push("recipient = ?");
        params.push(to.toLowerCase());
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

    // GET /api/emails/delete - 删除全部邮件
    if (url.pathname === "/api/emails/delete") {
      await env.DB.prepare("DELETE FROM emails").run();
      return Response.json({ success: true, message: "All emails deleted" });
    }

    // POST /api/emails/send - 发送(回复)邮件
    if (url.pathname === "/api/emails/send" && request.method === "POST") {
      const { from, to, subject, body, inReplyTo } = await request.json();
      if (!from || !to || !subject || !body) {
        return Response.json({ error: "Missing required fields: from, to, subject, body" }, { status: 400 });
      }

      let rawEmail = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n`;
      rawEmail += `Date: ${new Date().toUTCString()}\r\n`;
      rawEmail += `Message-ID: <${crypto.randomUUID()}@email-worker>\r\n`;
      if (inReplyTo) {
        rawEmail += `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n`;
      }
      rawEmail += `MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;

      const msg = new EmailMessage(from, to, new TextEncoder().encode(rawEmail));
      await env.SEND_EMAIL.send(msg);
      return Response.json({ success: true, message: "Email sent" });
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