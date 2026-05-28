import { VTParser, parseParams, type ParserActions } from './parser';
import type {
  CellColor,
  CursorShape,
  DirtyRow,
  TerminalCell,
  TerminalCursor,
  TerminalDelta,
} from './types';

const DEFAULT_FG: CellColor = { kind: 'default' };
const DEFAULT_BG: CellColor = { kind: 'default' };

function makeCell(overrides: Partial<TerminalCell> = {}): TerminalCell {
  return {
    char: '',
    width: 1,
    fg: DEFAULT_FG,
    bg: DEFAULT_BG,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    invisible: false,
    strikethrough: false,
    ...overrides,
  };
}

function makeRow(cols: number): TerminalCell[] {
  return Array.from({ length: cols }, () => makeCell());
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface SavedCursor {
  row: number;
  col: number;
  attrs: CellAttrs;
}

interface CellAttrs {
  fg: CellColor;
  bg: CellColor;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  invisible: boolean;
  strikethrough: boolean;
}

function defaultAttrs(): CellAttrs {
  return {
    fg: DEFAULT_FG,
    bg: DEFAULT_BG,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    invisible: false,
    strikethrough: false,
  };
}

const SCROLLBACK_MAX = 1000;

export class Terminal implements ParserActions {
  private grid: TerminalCell[][];
  private altGrid: TerminalCell[][];
  private scrollback: TerminalCell[][] = [];

  private curRow = 0;
  private curCol = 0;
  private curVisible = true;
  private curShape: CursorShape = 'block';
  private savedCursor: SavedCursor | null = null;
  private altSavedCursor: SavedCursor | null = null;

  private scrollTop = 0;
  private scrollBottom: number;

  private attrs: CellAttrs = defaultAttrs();

  private altScreenActive = false;
  private autoWrapPending = false;

  private titleStr = '';

  private dirtySet = new Set<number>();

  private readonly parser: VTParser;

  constructor(
    private cols: number,
    private rows: number,
  ) {
    this.scrollBottom = rows - 1;
    this.grid = Array.from({ length: rows }, () => makeRow(cols));
    this.altGrid = Array.from({ length: rows }, () => makeRow(cols));
    this.parser = new VTParser(this);
  }

  processBytes(data: string): TerminalDelta {
    this.dirtySet.clear();
    this.autoWrapPending = false;
    this._appendedScrollback = [];
    let cleared = false;
    let titleChanged: string | null = null;

    const prev = { cleared: false, title: null as string | null };
    this._clearFlag = prev;

    this.parser.feed(data);

    if (prev.cleared) cleared = true;
    if (prev.title !== null) titleChanged = prev.title;

    const dirtyRows: DirtyRow[] = Array.from(this.dirtySet)
      .sort((a, b) => a - b)
      .map((index) => ({ index, cells: [...this.grid[index]!] }));

    const appendedScrollback = this._appendedScrollback;
    this._appendedScrollback = [];

    return {
      dirtyRows,
      cursor: this.getCursor(),
      cleared,
      title: titleChanged,
      appendedScrollback,
    };
  }

  // Side channel so processBytes can capture clear/title events fired during parser.feed()
  private _clearFlag: { cleared: boolean; title: string | null } | null = null;
  private _appendedScrollback: TerminalCell[][] = [];

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.scrollBottom = rows - 1;

    // Resize each grid (add/remove rows and cols as needed)
    for (const g of [this.grid, this.altGrid]) {
      // Truncate or extend rows
      while (g.length > rows) g.pop();
      while (g.length < rows) g.push(makeRow(cols));
      // Truncate or extend each row
      for (let r = 0; r < g.length; r++) {
        const row = g[r]!;
        while (row.length > cols) row.pop();
        while (row.length < cols) row.push(makeCell());
      }
    }

    this.curRow = clamp(this.curRow, 0, rows - 1);
    this.curCol = clamp(this.curCol, 0, cols - 1);
    this.scrollTop = 0;
    this.scrollBottom = rows - 1;
  }

  getState() {
    return {
      grid: this.grid.map((r) => [...r]),
      scrollback: this.scrollback.map((r) => [...r]),
      cursor: this.getCursor(),
      cols: this.cols,
      rows: this.rows,
      title: this.titleStr,
      alternateScreen: this.altScreenActive,
    };
  }

  print(char: string): void {
    if (this.autoWrapPending) {
      this.curCol = 0;
      this.lineFeed();
      this.autoWrapPending = false;
    }

    const col = this.curCol;
    const row = this.curRow;

    if (col < this.cols && row < this.rows) {
      this.grid[row]![col] = {
        char,
        width: 1,
        fg: this.attrs.fg,
        bg: this.attrs.bg,
        bold: this.attrs.bold,
        dim: this.attrs.dim,
        italic: this.attrs.italic,
        underline: this.attrs.underline,
        blink: this.attrs.blink,
        inverse: this.attrs.inverse,
        invisible: this.attrs.invisible,
        strikethrough: this.attrs.strikethrough,
      };
      this.markDirty(row);
    }

    if (this.curCol + 1 >= this.cols) {
      this.autoWrapPending = true;
    } else {
      this.curCol++;
    }
  }

  execute(code: number): void {
    switch (code) {
      case 0x07: /* BEL */ break;
      case 0x08: /* BS */ if (this.curCol > 0) this.curCol--; break;
      case 0x09: /* HT — advance to next 8-col tab stop */ {
        const next = Math.min(this.cols - 1, Math.floor(this.curCol / 8) * 8 + 8);
        this.curCol = next;
        break;
      }
      case 0x0a: /* LF */
      case 0x0b: /* VT */
      case 0x0c: /* FF */
        this.lineFeed();
        break;
      case 0x0d: /* CR */
        this.curCol = 0;
        this.autoWrapPending = false;
        break;
    }
  }

  escDispatch(intermediate: string, final: number): void {
    if (intermediate === '') {
      switch (String.fromCharCode(final)) {
        case '7': /* DECSC — save cursor */ this.saveCursor(); break;
        case '8': /* DECRC — restore cursor */ this.restoreCursor(); break;
        case 'M': /* RI — reverse index */ this.reverseIndex(); break;
        case 'c': /* RIS — full reset */ this.fullReset(); break;
      }
    }
    if (intermediate === '#') {
      if (final === 0x38) /* DECALN — fill with E */ {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            this.grid[r]![c] = makeCell({ char: 'E' });
          }
          this.markDirty(r);
        }
      }
    }
  }

  csiDispatch(params: number[], intermediate: string, final: number): void {
    const p = (n: number, def = 0) => (params[n] !== undefined && params[n]! > 0 ? params[n]! : def);

    switch (String.fromCharCode(final)) {
      case 'A': /* CUU */ this.curRow = Math.max(this.scrollTop, this.curRow - p(0, 1)); break;
      case 'B': /* CUD */ this.curRow = Math.min(this.scrollBottom, this.curRow + p(0, 1)); break;
      case 'C': /* CUF */ this.curCol = Math.min(this.cols - 1, this.curCol + p(0, 1)); break;
      case 'D': /* CUB */ this.curCol = Math.max(0, this.curCol - p(0, 1)); break;
      case 'E': /* CNL */ this.curRow = Math.min(this.scrollBottom, this.curRow + p(0, 1)); this.curCol = 0; break;
      case 'F': /* CPL */ this.curRow = Math.max(this.scrollTop, this.curRow - p(0, 1)); this.curCol = 0; break;
      case 'G': /* CHA */ this.curCol = clamp(p(0, 1) - 1, 0, this.cols - 1); break;
      case 'H': /* CUP */
      case 'f': /* HVP */ {
        this.curRow = clamp(p(0, 1) - 1, 0, this.rows - 1);
        this.curCol = clamp(p(1, 1) - 1, 0, this.cols - 1);
        this.autoWrapPending = false;
        break;
      }
      case 'd': /* VPA */ this.curRow = clamp(p(0, 1) - 1, 0, this.rows - 1); break;

      case 'J': /* ED */ this.eraseDisplay(p(0, 0)); break;
      case 'K': /* EL */ this.eraseLine(p(0, 0)); break;
      case 'X': /* ECH */ {
        const n = p(0, 1);
        for (let c = this.curCol; c < Math.min(this.cols, this.curCol + n); c++) {
          this.grid[this.curRow]![c] = makeCell({ fg: this.attrs.fg, bg: this.attrs.bg });
        }
        this.markDirty(this.curRow);
        break;
      }

      case 'L': /* IL */ this.insertLines(p(0, 1)); break;
      case 'M': /* DL */ this.deleteLines(p(0, 1)); break;
      case 'P': /* DCH */ this.deleteChars(p(0, 1)); break;
      case '@': /* ICH */ this.insertChars(p(0, 1)); break;

      case 'S': /* SU */
        for (let i = 0; i < p(0, 1); i++) this.scrollUp();
        break;
      case 'T': /* SD */
        for (let i = 0; i < p(0, 1); i++) this.scrollDown();
        break;

      case 'r': /* DECSTBM */ {
        const top = clamp(p(0, 1) - 1, 0, this.rows - 1);
        const bot = clamp(p(1, this.rows) - 1, 0, this.rows - 1);
        if (top < bot) {
          this.scrollTop = top;
          this.scrollBottom = bot;
          this.curRow = 0;
          this.curCol = 0;
        }
        break;
      }

      case 'm': /* SGR */ this.applySgr(params.length === 0 ? [0] : params); break;

      case 'h': this.setMode(this.getRawParam(), true); break;
      case 'l': this.setMode(this.getRawParam(), false); break;

      case 's': this.saveCursor(); break;
      case 'u': this.restoreCursor(); break;

      case 'q': /* DECSCUSR */ {
        if (intermediate === ' ') {
          const n = p(0, 0);
          if (n === 0 || n === 1 || n === 2) this.curShape = 'block';
          else if (n === 3 || n === 4) this.curShape = 'underline';
          else if (n === 5 || n === 6) this.curShape = 'bar';
        }
        break;
      }
    }
  }

  // HACK: expose raw param string for h/l mode handling
  private _rawParamBuf = '';
  getRawParam(): string { return this._rawParamBuf; }

  oscDispatch(raw: string): void {
    const semi = raw.indexOf(';');
    if (semi === -1) return;
    const cmd = raw.slice(0, semi);
    const value = raw.slice(semi + 1);
    if (cmd === '0' || cmd === '2') {
      this.titleStr = value;
      if (this._clearFlag) this._clearFlag.title = value;
    }
  }

  private getCursor(): TerminalCursor {
    return {
      row: this.curRow,
      col: this.curCol,
      visible: this.curVisible,
      shape: this.curShape,
    };
  }

  private markDirty(row: number): void {
    this.dirtySet.add(row);
  }

  private lineFeed(): void {
    if (this.curRow === this.scrollBottom) {
      this.scrollUp();
    } else {
      this.curRow = Math.min(this.rows - 1, this.curRow + 1);
    }
  }

  private reverseIndex(): void {
    if (this.curRow === this.scrollTop) {
      this.scrollDown();
    } else {
      this.curRow = Math.max(0, this.curRow - 1);
    }
  }

  private scrollUp(): void {
    const removed = this.grid.splice(this.scrollTop, 1)[0];
    if (removed) {
      // Only push to scrollback on main screen full-viewport scrolls; alternate screen manages its own display
      if (!this.altScreenActive && this.scrollTop === 0) {
        const savedRow = [...removed];
        this.scrollback.push(savedRow);
        this._appendedScrollback.push(savedRow);
        if (this.scrollback.length > SCROLLBACK_MAX) {
          this.scrollback.splice(0, this.scrollback.length - SCROLLBACK_MAX);
        }
      }
      for (let c = 0; c < this.cols; c++) removed[c] = makeCell();
      this.grid.splice(this.scrollBottom, 0, removed);
    }
    for (let r = this.scrollTop; r <= this.scrollBottom; r++) this.markDirty(r);
  }

  private scrollDown(): void {
    const removed = this.grid.splice(this.scrollBottom, 1)[0];
    if (removed) {
      for (let c = 0; c < this.cols; c++) removed[c] = makeCell();
      this.grid.splice(this.scrollTop, 0, removed);
    }
    for (let r = this.scrollTop; r <= this.scrollBottom; r++) this.markDirty(r);
  }

  private eraseDisplay(mode: number): void {
    const clearRow = (r: number) => {
      this.grid[r] = makeRow(this.cols);
      this.markDirty(r);
    };
    if (mode === 0) {
      this.eraseLine(0);
      for (let r = this.curRow + 1; r < this.rows; r++) clearRow(r);
    } else if (mode === 1) {
      for (let r = 0; r < this.curRow; r++) clearRow(r);
      this.eraseLine(1);
    } else if (mode === 2 || mode === 3) {
      for (let r = 0; r < this.rows; r++) clearRow(r);
      if (this._clearFlag) this._clearFlag.cleared = true;
    }
  }

  private eraseLine(mode: number): void {
    const row = this.grid[this.curRow]!;
    if (mode === 0) {
      for (let c = this.curCol; c < this.cols; c++) row[c] = makeCell();
    } else if (mode === 1) {
      for (let c = 0; c <= this.curCol; c++) row[c] = makeCell();
    } else if (mode === 2) {
      for (let c = 0; c < this.cols; c++) row[c] = makeCell();
    }
    this.markDirty(this.curRow);
  }

  private insertLines(n: number): void {
    for (let i = 0; i < n; i++) {
      this.grid.splice(this.scrollBottom, 1);
      this.grid.splice(this.curRow, 0, makeRow(this.cols));
    }
    for (let r = this.curRow; r <= this.scrollBottom; r++) this.markDirty(r);
    this.curCol = 0;
  }

  private deleteLines(n: number): void {
    for (let i = 0; i < n; i++) {
      this.grid.splice(this.curRow, 1);
      this.grid.splice(this.scrollBottom, 0, makeRow(this.cols));
    }
    for (let r = this.curRow; r <= this.scrollBottom; r++) this.markDirty(r);
    this.curCol = 0;
  }

  private deleteChars(n: number): void {
    const row = this.grid[this.curRow]!;
    row.splice(this.curCol, n);
    while (row.length < this.cols) row.push(makeCell());
    this.markDirty(this.curRow);
  }

  private insertChars(n: number): void {
    const row = this.grid[this.curRow]!;
    const blanks = Array.from({ length: n }, () => makeCell());
    row.splice(this.curCol, 0, ...blanks);
    while (row.length > this.cols) row.pop();
    this.markDirty(this.curRow);
  }

  private applySgr(params: number[]): void {
    let i = 0;
    while (i < params.length) {
      const n = params[i]!;
      if (n === 0) {
        this.attrs = defaultAttrs();
      } else if (n === 1) { this.attrs.bold = true; }
      else if (n === 2) { this.attrs.dim = true; }
      else if (n === 3) { this.attrs.italic = true; }
      else if (n === 4) { this.attrs.underline = true; }
      else if (n === 5 || n === 6) { this.attrs.blink = true; }
      else if (n === 7) { this.attrs.inverse = true; }
      else if (n === 8) { this.attrs.invisible = true; }
      else if (n === 9) { this.attrs.strikethrough = true; }
      else if (n === 22) { this.attrs.bold = false; this.attrs.dim = false; }
      else if (n === 23) { this.attrs.italic = false; }
      else if (n === 24) { this.attrs.underline = false; }
      else if (n === 25) { this.attrs.blink = false; }
      else if (n === 27) { this.attrs.inverse = false; }
      else if (n === 28) { this.attrs.invisible = false; }
      else if (n === 29) { this.attrs.strikethrough = false; }
      else if (n >= 30 && n <= 37) { this.attrs.fg = { kind: 'palette', index: n - 30 }; }
      else if (n === 39) { this.attrs.fg = DEFAULT_FG; }
      else if (n >= 40 && n <= 47) { this.attrs.bg = { kind: 'palette', index: n - 40 }; }
      else if (n === 49) { this.attrs.bg = DEFAULT_BG; }
      else if (n >= 90 && n <= 97) { this.attrs.fg = { kind: 'palette', index: n - 90 + 8 }; }
      else if (n >= 100 && n <= 107) { this.attrs.bg = { kind: 'palette', index: n - 100 + 8 }; }
      else if (n === 38) {
        const color = this.parseSgrColor(params, i + 1);
        if (color) { this.attrs.fg = color.color; i += color.consumed; }
      }
      else if (n === 48) {
        const color = this.parseSgrColor(params, i + 1);
        if (color) { this.attrs.bg = color.color; i += color.consumed; }
      }
      i++;
    }
  }

  private parseSgrColor(
    params: number[],
    offset: number,
  ): { color: CellColor; consumed: number } | null {
    const mode = params[offset];
    if (mode === 5 && params[offset + 1] !== undefined) {
      return { color: { kind: 'palette', index: params[offset + 1]! }, consumed: 2 };
    }
    if (mode === 2 && params[offset + 3] !== undefined) {
      return {
        color: {
          kind: 'rgb',
          r: params[offset + 1] ?? 0,
          g: params[offset + 2] ?? 0,
          b: params[offset + 3]!,
        },
        consumed: 4,
      };
    }
    return null;
  }

  private setMode(rawParam: string, on: boolean): void {
    const isPrivate = rawParam.startsWith('?');
    const nums = rawParam.replace('?', '').split(';').map(Number);
    for (const n of nums) {
      if (isPrivate) {
        switch (n) {
          case 1:  /* DECCKM */ break;
          case 25: this.curVisible = on; break;
          case 47:
          case 1047:
          case 1049:
            this.switchScreen(on);
            break;
          case 2004: /* Bracketed paste */ break;
        }
      } else {
        switch (n) {
          case 20: /* LNM */ break;
        }
      }
    }
  }

  private switchScreen(toAlt: boolean): void {
    if (toAlt && !this.altScreenActive) {
      this.altScreenActive = true;
      this.altSavedCursor = { row: this.curRow, col: this.curCol, attrs: { ...this.attrs } };
      [this.grid, this.altGrid] = [this.altGrid, this.grid];
      this.curRow = 0; this.curCol = 0;
      this.eraseDisplay(2);
    } else if (!toAlt && this.altScreenActive) {
      this.altScreenActive = false;
      [this.grid, this.altGrid] = [this.altGrid, this.grid];
      if (this.altSavedCursor) {
        this.curRow = this.altSavedCursor.row;
        this.curCol = this.altSavedCursor.col;
        this.attrs = this.altSavedCursor.attrs;
      }
      for (let r = 0; r < this.rows; r++) this.markDirty(r);
    }
  }

  private saveCursor(): void {
    this.savedCursor = { row: this.curRow, col: this.curCol, attrs: { ...this.attrs } };
  }

  private restoreCursor(): void {
    if (this.savedCursor) {
      this.curRow = this.savedCursor.row;
      this.curCol = this.savedCursor.col;
      this.attrs = this.savedCursor.attrs;
    }
  }

  private fullReset(): void {
    this.curRow = 0; this.curCol = 0;
    this.scrollTop = 0; this.scrollBottom = this.rows - 1;
    this.attrs = defaultAttrs();
    this.altScreenActive = false;
    this.grid = Array.from({ length: this.rows }, () => makeRow(this.cols));
    this.altGrid = Array.from({ length: this.rows }, () => makeRow(this.cols));
    for (let r = 0; r < this.rows; r++) this.markDirty(r);
    if (this._clearFlag) this._clearFlag.cleared = true;
  }
}
