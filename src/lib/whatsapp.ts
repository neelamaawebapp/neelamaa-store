export async function sendWhatsAppMessage(to: string, body: string, mediaUrl?: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "+14155238886"; // Default sandbox sender

  if (!accountSid || !authToken) {
    console.log(`[MOCK WHATSAPP] Credentials not set. Sent to ${to}: ${body} ${mediaUrl ? `(Media: ${mediaUrl})` : ""}`);
    return { success: false, error: "Credentials not configured" };
  }

  // Format destination number: must start with '+' and have country code.
  let formattedTo = to.trim();
  if (!formattedTo.startsWith("+")) {
    if (formattedTo.length === 10) {
      formattedTo = `+91${formattedTo}`;
    } else {
      formattedTo = `+${formattedTo}`;
    }
  }

  try {
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.append("To", `whatsapp:${formattedTo}`);
    params.append("From", `whatsapp:${from}`);
    params.append("Body", body);
    if (mediaUrl) {
      params.append("MediaUrl", mediaUrl);
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to send Twilio message");
    }

    console.log(`[SUCCESS] Twilio WhatsApp sent to ${formattedTo}. Message SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error("Twilio WhatsApp Error:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}
