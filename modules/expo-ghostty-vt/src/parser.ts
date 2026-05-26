/**
 * VT/ANSI state-machine parser — Paul Williams DEC-compatible design.
 *
 * Parses a byte stream and dispatches semantic actions to the terminal.
 * Does NOT maintain grid state; that is the Terminal class's job.
 *
 * Implemented states: Ground, Escape, EscIntermediate,
 *   CsiEntry/Param/Intermediate/Ignore, OscString, SosPmApc (swallowed).
 *
 * Reference: https://vt100.net/emu/dec_ansi_parser
 */

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
  /** Printable character — add to grid at cursor position. */
  print(char: string): void;
  /** C0/C1 control byte (< 0x20 or 0x80-0x9F). */
  execute(code: number): void;
  /** ESC <intermediate…> <final>. */
  escDispatch(intermediate: string, final: number): void;
  /** CSI <params> <intermediate…> <final>. */
  csiDispatch(params: number[], intermediate: string, final: number): void;
  /** OSC complete: "Pn;…" string. */
  oscDispatch(raw: string): void;
}

/** Parse a single "params" string like "1;38;2;255;0;128" → [1,38,2,255,0,128]. */
export function parseParams(raw: string): number[] {
  if (!raw) return [];
  return raw.split(';').map((s) => (s === '' ? 0 : parseInt(s, 10)));
}

export class VTParser {
  private state = State.Ground;
  private paramBuf = '';
  private intermediateBuf = '';
  private oscBuf = '';
  /** Accumulator for multi-byte UTF-8 sequences arriving as ISO-8859-1. */
  private utf8Buf: number[] = [];
  private utf8Remaining = 0;

  constructor(private readonly actions: ParserActions) {}

  /**
   * Feed a chunk of data to the parser.
   * `data` is an ISO-8859-1 string (each charCode 0-255 is one byte).
   */
  feed(data: string): void {
    for (let i = 0; i < data.length; i++) {
      this.processByte(data.charCodeAt(i));
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private processByte(byte: number): void {
    // ── UTF-8 multi-byte reassembly ────────────────────────────────────────
    if (this.utf8Remaining > 0) {
      if ((byte & 0xc0) === 0x80) {
        // Continuation byte
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
        // Unexpected — reset and fall through
        this.utf8Buf = [];
        this.utf8Remaining = 0;
      }
    }

    // Detect start of multi-byte UTF-8 sequence
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

    // ── Anywhere transitions (apply in all states) ─────────────────────────
    if (byte === 0x18 || byte === 0x1a) {
      // CAN / SUB — cancel sequence
      this.state = State.Ground;
      return;
    }
    if (byte === 0x1b) {
      // ESC
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.oscBuf = '';
      this.state = State.Escape;
      return;
    }
    if (byte === 0x9b) {
      // C1 CSI (8-bit)
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.state = State.CsiEntry;
      return;
    }
    if (byte === 0x9d) {
      // C1 OSC (8-bit)
      this.oscBuf = '';
      this.state = State.OscString;
      return;
    }
    if (byte === 0x98 || byte === 0x9e || byte === 0x9f) {
      // SOS/PM/APC — swallow until ST
      this.state = State.SosPmApc;
      return;
    }

    // ── State dispatch ─────────────────────────────────────────────────────
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

  // ── Ground ────────────────────────────────────────────────────────────────

  private handleGround(byte: number): void {
    if (byte < 0x20) {
      // C0 control character
      this.actions.execute(byte);
    } else if (byte === 0x7f) {
      // DEL — ignore
    } else {
      // Printable ASCII
      this.actions.print(String.fromCharCode(byte));
    }
  }

  // ── Escape ────────────────────────────────────────────────────────────────

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
      // '[' → CSI
      this.paramBuf = '';
      this.intermediateBuf = '';
      this.state = State.CsiEntry;
      return;
    }
    if (byte === 0x5d) {
      // ']' → OSC
      this.oscBuf = '';
      this.state = State.OscString;
      return;
    }
    if (byte === 0x58 || byte === 0x5e || byte === 0x5f) {
      // SOS / PM / APC
      this.state = State.SosPmApc;
      return;
    }
    if (byte >= 0x30 && byte <= 0x7e) {
      // Final byte
      this.actions.escDispatch(this.intermediateBuf, byte);
      this.intermediateBuf = '';
      this.state = State.Ground;
      return;
    }
    // Ignore and return to ground
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
    // Ignore
    this.state = State.Ground;
  }

  // ── CSI ───────────────────────────────────────────────────────────────────

  private handleCsiEntry(byte: number): void {
    if (byte < 0x20) {
      this.actions.execute(byte);
      return;
    }
    if (byte >= 0x30 && byte <= 0x3f) {
      // Parameter or private marker
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
    // Strip leading private/prefix markers (?, !, >, =) from params
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

  // ── OSC ───────────────────────────────────────────────────────────────────

  private handleOsc(byte: number): void {
    if (byte === 0x07 || byte === 0x9c) {
      // BEL or ST terminates OSC
      this.actions.oscDispatch(this.oscBuf);
      this.oscBuf = '';
      this.state = State.Ground;
      return;
    }
    if (byte === 0x1b) {
      // ESC starts ST (ESC \), handled by next processByte → escape state
      this.actions.oscDispatch(this.oscBuf);
      this.oscBuf = '';
      this.state = State.Escape;
      return;
    }
    // Accumulate printable / control chars
    if (byte >= 0x20) {
      this.oscBuf += String.fromCharCode(byte);
    }
  }

  // ── UTF-8 decode ──────────────────────────────────────────────────────────

  private decodeUtf8(bytes: number[]): string {
    try {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return '�';
    }
  }
}
