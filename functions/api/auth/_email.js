import { connect } from "cloudflare:sockets";
import { originOf } from "./_auth.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function required(env, key) {
  const value = String(env?.[key] || "").trim();
  if (!value) throw new Error("Missing " + key);
  return value;
}

function b64(value) {
  let binary = "";
  const bytes = encoder.encode(String(value));
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readSmtpResponse(reader) {
  let buffer = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error("SMTP connection closed unexpectedly");
    buffer += decoder.decode(chunk.value, { stream: true });

    const lines = buffer.split("\r\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!/^\d{3}(?: |$)/.test(line)) continue;
      const code = Number(line.slice(0, 3));
      if (code >= 400) {
        const error = new Error("SMTP " + code + ": " + line.slice(4));
        error.responseCode = code;
        throw error;
      }
      return { code, line };
    }
  }
}

async function writeLine(writer, value) {
  await writer.write(encoder.encode(String(value) + "\r\n"));
}

async function smtpSend(env, { from, to, subject, text, html }) {
  const host = String(env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = required(env, "SMTP_USER");
  const pass = required(env, "SMTP_PASS");
  const secure = String(env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";

  if (![465, 587].includes(port)) {
    throw new Error("Unsupported SMTP port. Cookie supports Gmail SMTP on ports 465 and 587.");
  }

  const socket = connect({ hostname: host, port }, { secureTransport: secure ? "on" : "starttls" });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();

  try {
    await readSmtpResponse(reader);
    await writeLine(writer, "EHLO cookie.ai");
    await readSmtpResponse(reader);

    let activeReader = reader;

    if (!secure) {
      await writeLine(writer, "STARTTLS");
      await readSmtpResponse(activeReader);
      activeReader.releaseLock();
      writer.releaseLock();

      const tlsSocket = socket.startTls();
      activeReader = tlsSocket.readable.getReader();
      const tlsWriter = tlsSocket.writable.getWriter();

      await writeLine(tlsWriter, "EHLO cookie.ai");
      await readSmtpResponse(activeReader);

      await writeLine(tlsWriter, "AUTH LOGIN");
      await readSmtpResponse(activeReader);
      await writeLine(tlsWriter, b64(user));
      await readSmtpResponse(activeReader);
      await writeLine(tlsWriter, b64(pass));
      await readSmtpResponse(activeReader);

      await writeLine(tlsWriter, "MAIL FROM:<" + from + ">");
      await readSmtpResponse(activeReader);
      await writeLine(tlsWriter, "RCPT TO:<" + to + ">");
      await readSmtpResponse(activeReader);
      await writeLine(tlsWriter, "DATA");
      await readSmtpResponse(activeReader);

      const message = [
        "From: Cookie <" + from + ">",
        "To: " + to,
        "Subject: " + subject,
        "MIME-Version: 1.0",
        "Content-Type: multipart/alternative; boundary=\"cookie-boundary\"",
        "",
        "--cookie-boundary",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        text,
        "",
        "--cookie-boundary",
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        html,
        "",
        "--cookie-boundary--",
        ""
      ].join("\r\n").replace(/\n\./g, "\n..");

      await writeLine(tlsWriter, message.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
      await writeLine(tlsWriter, ".");
      await readSmtpResponse(activeReader);
      await writeLine(tlsWriter, "QUIT");
      try { await readSmtpResponse(activeReader); } catch {}
      activeReader.releaseLock();
      tlsWriter.releaseLock();
      return;
    }

    await writeLine(writer, "AUTH LOGIN");
    await readSmtpResponse(reader);
    await writeLine(writer, b64(user));
    await readSmtpResponse(reader);
    await writeLine(writer, b64(pass));
    await readSmtpResponse(reader);

    await writeLine(writer, "MAIL FROM:<" + from + ">");
    await readSmtpResponse(reader);
    await writeLine(writer, "RCPT TO:<" + to + ">");
    await readSmtpResponse(reader);
    await writeLine(writer, "DATA");
    await readSmtpResponse(reader);

    const message = [
      "From: Cookie <" + from + ">",
      "To: " + to,
      "Subject: " + subject,
      "MIME-Version: 1.0",
      "Content-Type: multipart/alternative; boundary=\"cookie-boundary\"",
      "",
      "--cookie-boundary",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      text,
      "",
      "--cookie-boundary",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      "",
      "--cookie-boundary--",
      ""
    ].join("\r\n").replace(/\n\./g, "\n..");

    await writeLine(writer, message.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    await writeLine(writer, ".");
    await readSmtpResponse(reader);
    await writeLine(writer, "QUIT");
    try { await readSmtpResponse(reader); } catch {}
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

export async function sendVerificationEmail(request, env, { email, name, code, token, purpose = "signup" }) {
  const from = String(env.EMAIL_FROM || env.SMTP_USER || "").trim() || required(env, "EMAIL_FROM");
  const base = originOf(request, env);
  const kind = purpose === "reset" ? "reset your Cookie password" : "verify your Cookie account";
  const subject = purpose === "reset" ? "Reset your Cookie password" : "Verify your Cookie account";
  const path = purpose === "reset" ? "/?reset=" + encodeURIComponent(token) : "/?verify=" + encodeURIComponent(token);
  const link = base + path;
  const safeName = String(name || "there").replace(/[<>]/g, "");
  const text = [
    "Hi " + safeName + ",",
    "",
    "Use this code to " + kind + ": " + code,
    "The code expires in 10 minutes and can be used once.",
    "",
    "You can also use this secure link:",
    link,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Cookie AI"
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;background:#111;color:#eee;font-family:Inter,Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;padding:32px;background:#1a1a1a;border:1px solid #2c2c2c;border-radius:22px">
  <div style="font-size:26px;font-weight:800;letter-spacing:-.04em;margin-bottom:24px">Cookie</div>
  <p style="font-size:16px;line-height:1.6">Hi ${safeName},</p>
  <p style="font-size:16px;line-height:1.6">Use the code below to ${kind}.</p>
  <div style="font-size:34px;letter-spacing:.24em;font-weight:800;padding:22px 18px;background:#111;border:1px solid #333;border-radius:16px;text-align:center;margin:20px 0">${code}</div>
  <p style="font-size:13px;color:#999;line-height:1.6">This code expires in 10 minutes and can only be used once.</p>
  <a href="${link}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#fff;color:#111;text-decoration:none;border-radius:12px;font-weight:700">Continue securely</a>
  <p style="font-size:12px;color:#777;line-height:1.6;margin-top:24px">If you did not request this email, you can safely ignore it.</p>
</div></body></html>`;
  await smtpSend(env, { from, to: email, subject, text, html });
}
