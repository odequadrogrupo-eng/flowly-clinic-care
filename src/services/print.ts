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

export type DirectPrintResult = {
  ok: boolean;
  mode: "webusb" | "webserial" | "agent";
  message: string;
  endpoint?: string;
};

function appendLine(chunks: number[], line = "") {
  const bytes = new TextEncoder().encode(`${line}\n`);
  chunks.push(...bytes);
}

function encodeEscPos(payload: PrintTicketPayload) {
  const bytes: number[] = [];
  const issuedAt = new Date(payload.issuedAtIso).toLocaleString("pt-BR");

  // Initialize + centered content.
  bytes.push(0x1b, 0x40, 0x1b, 0x61, 0x01);
  appendLine(bytes, payload.clinicName.toUpperCase());
  appendLine(bytes, payload.welcomeMessage);
  appendLine(bytes);

  // Double-width + double-height for ticket code.
  bytes.push(0x1d, 0x21, 0x11);
  appendLine(bytes, payload.ticketCode);
  bytes.push(0x1d, 0x21, 0x00);

  appendLine(bytes, issuedAt);
  if (payload.qrEnabled) {
    appendLine(bytes, `QR: ${payload.qrValue ?? payload.ticketCode}`);
  }
  appendLine(bytes, payload.footerMessage);
  appendLine(bytes);
  appendLine(bytes);

  // Full cut.
  bytes.push(0x1d, 0x56, 0x41, 0x10);
  return new Uint8Array(bytes);
}

function toBase64(data: Uint8Array) {
  let binary = "";
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i] ?? 0);
  }
  return btoa(binary);
}

async function printViaWebUsb(data: Uint8Array) {
  const nav = navigator as Navigator & { usb?: unknown };
  const usb = nav.usb as
    | {
        requestDevice(options: { filters: unknown[] }): Promise<unknown>;
      }
    | undefined;

  if (!usb) {
    throw new Error("WebUSB não está disponível neste navegador/dispositivo.");
  }

  const device = (await usb.requestDevice({ filters: [] })) as {
    configuration?: {
      interfaces?: Array<{
        interfaceNumber: number;
        alternates?: Array<{ endpoints?: Array<{ endpointNumber: number; direction: string }> }>;
      }>;
    };
    open(): Promise<void>;
    selectConfiguration(value: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    close(): Promise<void>;
  };

  let claimedInterface: number | null = null;
  try {
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const interfaces = device.configuration?.interfaces ?? [];
    let interfaceNumber = -1;
    let endpointNumber = -1;

    for (const iface of interfaces) {
      for (const alt of iface.alternates ?? []) {
        const outEndpoint = (alt.endpoints ?? []).find((endpoint) => endpoint.direction === "out");
        if (outEndpoint) {
          interfaceNumber = iface.interfaceNumber;
          endpointNumber = outEndpoint.endpointNumber;
          break;
        }
      }
      if (endpointNumber > -1) break;
    }

    if (interfaceNumber < 0 || endpointNumber < 0) {
      throw new Error("Não foi encontrado endpoint de saída na impressora USB.");
    }

    await device.claimInterface(interfaceNumber);
    claimedInterface = interfaceNumber;
    await device.transferOut(endpointNumber, data as unknown as BufferSource);
  } finally {
    if (claimedInterface !== null) {
      await device.releaseInterface(claimedInterface).catch(() => undefined);
    }
    await device.close().catch(() => undefined);
  }
}

async function printViaWebSerial(data: Uint8Array) {
  const nav = navigator as Navigator & { serial?: unknown };
  const serial = nav.serial as
    | {
        requestPort(): Promise<unknown>;
      }
    | undefined;

  if (!serial) {
    throw new Error("WebSerial não está disponível neste navegador/dispositivo.");
  }

  const port = (await serial.requestPort()) as {
    open(options: { baudRate: number }): Promise<void>;
    writable?: WritableStream<Uint8Array>;
    close(): Promise<void>;
  };

  await port.open({ baudRate: 9600 });
  try {
    if (!port.writable) {
      throw new Error("A porta serial selecionada não está pronta para escrita.");
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close().catch(() => undefined);
  }
}

export async function printDirect(
  payload: PrintTicketPayload,
  mode: "webusb" | "webserial",
): Promise<DirectPrintResult> {
  const data = encodeEscPos(payload);
  if (mode === "webusb") {
    await printViaWebUsb(data);
    return {
      ok: true,
      mode,
      message: "Impressão enviada via WebUSB.",
    } satisfies DirectPrintResult;
  }

  await printViaWebSerial(data);
  return {
    ok: true,
    mode,
    message: "Impressão enviada via WebSerial.",
  } satisfies DirectPrintResult;
}

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

export async function tryPrintWithWebApi(
  payload: PrintTicketPayload,
  mode: "webusb" | "webserial",
  endpoint = "http://127.0.0.1:3311/print",
): Promise<DirectPrintResult> {
  const rawEscPos = encodeEscPos(payload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode,
      payload,
      raw_escpos_base64: toBase64(rawEscPos),
    }),
  });

  if (!response.ok) {
    throw new Error(`Print Agent respondeu ${response.status}.`);
  }

  return {
    ok: true,
    mode: "agent",
    message: "Impressão enviada para agente local.",
    endpoint,
  } satisfies DirectPrintResult;
}
