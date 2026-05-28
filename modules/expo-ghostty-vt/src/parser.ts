// Paul Williams DEC-compatible VT/ANSI parser. Reference: https://vt100.net/emu/dec_ansi_parser

const enum State {
  Ground = 0,
  Escape,
  EscIntermediate,
  CsiEntry,
  CsiParam,
  CsiIntermediate,
  CsiIgnore,
  OscString,
  SosPmApc,
}

export interface ParserActions {
  print(char: string): void;
  execute(code: number): void;
  escDispatch(intermediate: string, final: number): void;
  csiDispatch(params: number[], intermediate: string, final: number): void;
  oscDispatch(raw: string): void;
}

export function parseParams(raw: string): number[] {
  if (!raw) return [];
  return raw.split(';').map((s) => (s === '' ? 0 : parseInt(s, 10)));
}

export class VTParser {
  private state = State.Ground;
  private paramBuf = '';
  private intermediateBuf = '';
  private oscBuf = '';
  private utf8Buf: number[] = [];
  private utf8Remaining = 0;

  constructor(private readonly actions: ParserActions) {}

  feed(data: string): void {
    for (let i = 0; i < data.length; i++) {
      this.processByte(data.charCodeAt(i));
    }
  }

  private processByte(byte: number): void {
    if (this.utf8Remaining > 0) {
      if ((byte & 0xc0) === 0x80) {
        this.utf8Buf.push(byte);
        this.utf8Remaining--;
        if (this.utf8Remaining === 0) {
          const char = this.decodeUtf8(this.utf8Buf);
          this.utf8Buf = [];
          if (this.state === State.Ground) {
            this.actions.print(char);
          }
        }
        return;
      } else {
        // Unexpected continuation — reset and fall through
        this.utf8Buf = [];
        this.utf8Remaining = 0;
      }
    }

    if (byte >= 0xc0 && byte <= 0xdf) {
      this.utf8Buf = [byte];
      this.utf8Remaining = 1;
      return;
    }
    if (byte >= 0xe0 && byte <= 0xef) {
      this.utf8Buf = [byte];
      this.utf8Remaining = 2;
      return;
    }
    if (byte >= 0xf0 && byte <= 0xf7) {
      this.utf8Buf = [byte];
      this.utf8Remaining = 3;
      return;
    }

    if (byte === 0x18 || byte === 0x1a) {
      this.state = State.Ground;
      return;
    }
    if (byte === 0x1b) {
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.oscBuf = '';
      this.state = State.Escape;
      return;
    }
    if (byte === 0x9b) {
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.state = State.CsiEntry;
      return;
    }
    if (byte === 0x9d) {
      this.oscBuf = '';
      this.state = State.OscString;
      return;
    }
    if (byte === 0x98 || byte === 0x9e || byte === 0x9f) {
      this.state = State.SosPmApc;
      return;
    }

    switch (this.state) {
      case State.Ground:
        return this.handleGround(byte);
      case State.Escape:
        return this.handleEscape(byte);
      case State.EscIntermediate:
        return this.handleEscIntermediate(byte);
      case State.CsiEntry:
        return this.handleCsiEntry(byte);
      case State.CsiParam:
        return this.handleCsiParam(byte);
      case State.CsiIntermediate:
        return this.handleCsiIntermediate(byte);
      case State.CsiIgnore:
        if (byte >= 0x40 && byte <= 0x7e) this.state = State.Ground;
        return;
      case State.OscString:
        return this.handleOsc(byte);
      case State.SosPmApc:
        if (byte === 0x9c || (byte === 0x5c && this.state === State.SosPmApc)) {
          this.state = State.Ground;
        }
        return;
    }
  }

  private handleGround(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
    } else if (byte !== 0x7f) {
      this.actions.print(String.fromCharCode(byte));
    }
  }

  private handleEscape(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x20 && byte <= 0x2f) {
      // Intermediate
      this.intermediateBuf += String.fromCharCode(byte);
      this.state = State.EscIntermediate;
      return;
    }
    if (byte === 0x5b) {
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.state = State.CsiEntry;
      return;
    }
    if (byte === 0x5d) {
      this.oscBuf = '';
      this.state = State.OscString;
      return;
    }
    if (byte === 0x58 || byte === 0x5e || byte === 0x5f) {
      this.state = State.SosPmApc;
      return;
    }
    if (byte >= 0x30 && byte <= 0x7e) {
      this.actions.escDispatch(this.intermediateBuf, byte);
      this.intermediateBuf = '';
      this.state = State.Ground;
      return;
    }
    this.state = State.Ground;
  }

  private handleEscIntermediate(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x20 && byte <= 0x2f) {
      this.intermediateBuf += String.fromCharCode(byte);
      return;
    }
    if (byte >= 0x30 && byte <= 0x7e) {
      this.actions.escDispatch(this.intermediateBuf, byte);
      this.intermediateBuf = '';
      this.state = State.Ground;
      return;
    }
    this.state = State.Ground;
  }

  private handleCsiEntry(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x30 && byte <= 0x3f) {
      this.paramBuf += String.fromCharCode(byte);
      this.state = State.CsiParam;
      return;
    }
    if (byte >= 0x20 && byte <= 0x2f) {
      this.intermediateBuf += String.fromCharCode(byte);
      this.state = State.CsiIntermediate;
      return;
    }
    if (byte >= 0x40 && byte <= 0x7e) {
      this.dispatchCsi(byte);
      return;
    }
  }

  private handleCsiParam(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x30 && byte <= 0x3f) {
      this.paramBuf += String.fromCharCode(byte);
      return;
    }
    if (byte >= 0x20 && byte <= 0x2f) {
      this.intermediateBuf += String.fromCharCode(byte);
      this.state = State.CsiIntermediate;
      return;
    }
    if (byte >= 0x40 && byte <= 0x7e) {
      this.dispatchCsi(byte);
      return;
    }
    this.state = State.CsiIgnore;
  }

  private handleCsiIntermediate(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x20 && byte <= 0x2f) {
      this.intermediateBuf += String.fromCharCode(byte);
      return;
    }
    if (byte >= 0x40 && byte <= 0x7e) {
      this.dispatchCsi(byte);
      return;
    }
    this.state = State.CsiIgnore;
  }

  private dispatchCsi(final: number): void {
    const raw = this.paramBuf;
    const intermediate = this.intermediateBuf;
    const paramString = raw.startsWith('?') || raw.startsWith('>') || raw.startsWith('=')
      ? raw.slice(1)
      : raw;
    const params = parseParams(paramString);
    this.actions.csiDispatch(params, intermediate, final);
    this.paramBuf = '';
    this.intermediateBuf = '';
    this.state = State.Ground;
  }

  private handleOsc(byte: number): void {
    if (byte === 0x07 || byte === 0x9c) {
      this.actions.oscDispatch(this.oscBuf);
      this.oscBuf = '';
      this.state = State.Ground;
      return;
    }
    if (byte === 0x1b) {
      // ESC starts ST (ESC \); next processByte will handle the '\' in Escape state
      this.actions.oscDispatch(this.oscBuf);
      this.oscBuf = '';
      this.state = State.Escape;
      return;
    }
    if (byte >= 0x20) {
      this.oscBuf += String.fromCharCode(byte);
    }
  }

  private decodeUtf8(bytes: number[]): string {
    try {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return '�';
    }
  }
}
