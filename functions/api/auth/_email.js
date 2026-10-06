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
  const recipients = Array.isArray(to) ? [...new Set(to.map(value => String(value || "").trim().toLowerCase()).filter(value => /^\\S+@\\S+\\.\\S+$/.test(value)))] : [String(to || "").trim()];
  if (!recipients.length) throw new Error("No valid SMTP recipients");
  const headerTo = recipients.length === 1 ? recipients[0] : "undisclosed-recipients:;";
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
      for (const recipient of recipients) {
        await writeLine(tlsWriter, "RCPT TO:<" + recipient + ">");
        await readSmtpResponse(activeReader);
      }
      await writeLine(tlsWriter, "DATA");
      await readSmtpResponse(activeReader);

      const message = [
        "From: Cookie <" + from + ">",
        "To: " + headerTo,
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
    for (const recipient of recipients) {
      await writeLine(writer, "RCPT TO:<" + recipient + ">");
      await readSmtpResponse(reader);
    }
    await writeLine(writer, "DATA");
    await readSmtpResponse(reader);

    const message = [
      "From: Cookie <" + from + ">",
      "To: " + headerTo,
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
    purpose === "reset"
      ? "Use the secure link below to reset your Cookie password:"
      : "Use this code to " + kind + ": " + code,
    purpose === "reset"
      ? "The reset link expires in 10 minutes and can be used once."
      : "The code expires in 10 minutes and can be used once.",
    "",
    "Continue securely:",
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
  ${purpose === "reset"
    ? '<p style="font-size:16px;line-height:1.6">Use the secure link below to reset your Cookie password.</p><p style="font-size:13px;color:#999;line-height:1.6">The reset link expires in 10 minutes and can only be used once.</p>'
    : '<p style="font-size:16px;line-height:1.6">Use the code below to verify your Cookie account.</p><div style="font-size:34px;letter-spacing:.24em;font-weight:800;padding:22px 18px;background:#111;border:1px solid #333;border-radius:16px;text-align:center;margin:20px 0">' + code + '</div><p style="font-size:13px;color:#999;line-height:1.6">This code expires in 10 minutes and can only be used once.</p>'}
  <a href="${link}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#fff;color:#111;text-decoration:none;border-radius:12px;font-weight:700">Continue securely</a>
  <p style="font-size:12px;color:#777;line-height:1.6;margin-top:24px">If you did not request this email, you can safely ignore it.</p>
</div></body></html>`;
  await smtpSend(env, { from, to: email, subject, text, html });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

export async function sendReleaseAnnouncementEmail(request, env, {
  recipients,
  title,
  intro,
  features = [],
  ctaLabel = "Try Cookie",
  ctaUrl
}) {
  const from = String(env.EMAIL_FROM || env.SMTP_USER || "").trim() || required(env, "EMAIL_FROM");
  const validRecipients = [...new Set((recipients || []).map(value => String(value || "").trim().toLowerCase()).filter(value => /^\S+@\S+\.\S+$/.test(value)))];
  if (!validRecipients.length) return { sent: 0, batches: 0 };

  const subject = String(title || "New updates are live in Cookie").trim().slice(0, 160);
  const safeTitle = escapeHtml(subject);
  const safeIntro = escapeHtml(intro || "Cookie just got a major update. New features and improvements are now live.");
  const url = String(ctaUrl || originOf(request, env)).trim();
  const safeUrl = escapeHtml(url);
  const safeCta = escapeHtml(ctaLabel || "Try Cookie");
  const cleanFeatures = Array.isArray(features) ? features.map(value => String(value || "").trim()).filter(Boolean).slice(0, 8) : [];
  const text = [
    "Cookie AI",
    "",
    subject,
    "",
    String(intro || "Cookie just got a major update. New features and improvements are now live."),
    "",
    ...(cleanFeatures.length ? cleanFeatures.map(value => "• " + value) : ["• New features, performance improvements, and a more polished experience."]),
    "",
    String(ctaLabel || "Try Cookie") + ":",
    url,
    "",
    "You're receiving this because you have a Cookie account.",
    "",
    "Cookie AI"
  ].join("\n");
  const featureHtml = (cleanFeatures.length ? cleanFeatures : ["New features, performance improvements, and a more polished experience."])
    .map(value => '<li style="margin:0 0 9px;color:#d5d8dc;line-height:1.55">' + escapeHtml(value) + '</li>').join("");
  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f2;color:#181818;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:44px 20px">
    <div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#757575;margin:0 0 20px">Cookie AI</div>
    <div style="background:#151515;border-radius:20px;padding:34px 32px">
      <div style="font-size:34px;line-height:1.05;letter-spacing:-.05em;font-weight:720;color:#fff;margin-bottom:18px">${safeTitle}</div>
      <p style="font-size:16px;line-height:1.65;color:#cfd1d4;margin:0 0 25px">${safeIntro}</p>
      <ul style="padding:0 0 0 19px;margin:0 0 27px">${featureHtml}</ul>
      <a href="${safeUrl}" style="display:inline-block;background:#fff;color:#111;text-decoration:none;padding:12px 17px;border-radius:10px;font-weight:700;font-size:13px">${safeCta}</a>
    </div>
    <p style="font-size:11px;line-height:1.6;color:#818181;margin:18px 3px 0">You're receiving this because you have a Cookie account.</p>
  </div>
</body></html>`;
  const batchSize = 50;
  let sent = 0;
  let batches = 0;
  for (let i = 0; i < validRecipients.length; i += batchSize) {
    const batch = validRecipients.slice(i, i + batchSize);
    await smtpSend(env, { from, to: batch, subject, text, html });
    sent += batch.length;
    batches += 1;
  }
  return { sent, batches };
}
