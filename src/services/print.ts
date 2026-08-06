export type PrintTicketPayload = {
  clinicName: string;
  logoUrl?: string | null;
  welcomeMessage: string;
  ticketCode: string;
  issuedAtIso: string;
  footerMessage: string;
  paperSize: "58mm" | "80mm";
  qrEnabled: boolean;
  qrValue?: string;
};

export function buildPrintHtml(payload: PrintTicketPayload) {
  const width = payload.paperSize === "80mm" ? "302px" : "220px";
  const issuedAt = new Date(payload.issuedAtIso).toLocaleString("pt-BR");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Senha ${payload.ticketCode}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
  .ticket { width: ${width}; margin: 0 auto; padding: 10px; text-align: center; }
  .logo { max-width: 90px; max-height: 60px; object-fit: contain; margin: 0 auto 8px; display: block; }
  .clinic { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
  .welcome { font-size: 12px; margin-bottom: 8px; }
  .code { font-size: 34px; font-weight: 800; letter-spacing: 1px; margin: 8px 0; }
  .date { font-size: 11px; margin-bottom: 8px; }
  .footer { font-size: 11px; margin-top: 8px; }
  .qr { font-size: 10px; margin-top: 8px; }
</style>
</head>
<body>
  <div class="ticket">
    ${payload.logoUrl ? `<img class="logo" src="${payload.logoUrl}" />` : ""}
    <div class="clinic">${payload.clinicName}</div>
    <div class="welcome">${payload.welcomeMessage}</div>
    <div class="code">${payload.ticketCode}</div>
    <div class="date">${issuedAt}</div>
    <div class="footer">${payload.footerMessage}</div>
    ${payload.qrEnabled ? `<div class="qr">QR: ${payload.qrValue ?? payload.ticketCode}</div>` : ""}
  </div>
</body>
</html>`;
}

export function printWithBrowser(payload: PrintTicketPayload) {
  const html = buildPrintHtml(payload);
  const popup = window.open("", "_blank", "width=400,height=600");
  if (!popup) throw new Error("Nao foi possivel abrir janela de impressao.");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export async function tryPrintWithWebApi(payload: PrintTicketPayload, mode: "webusb" | "webserial") {
  // Placeholder strategy for future direct printer support.
  // For now returns a payload that can be consumed by a local print agent.
  return {
    mode,
    endpoint: "http://127.0.0.1:3311/print",
    payload,
  };
}
