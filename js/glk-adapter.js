/**
 * Minimal Glk Adapter for ifvms.js
 *
 * Glk is the standard I/O system for interactive fiction VMs.
 * This adapter bridges ifvms.js to our custom terminal UI.
 */

// Glk constants
const evtype_None = 0;
const evtype_CharInput = 2;
const evtype_LineInput = 3;

const wintype_TextBuffer = 3;
const wintype_TextGrid = 4;

const filemode_Write = 0x01;
const filemode_Read = 0x02;
const filemode_ReadWrite = 0x03;

const seekmode_Start = 0;
const seekmode_Current = 1;
const seekmode_End = 2;

const gestalt_CharOutput = 2;
const gestalt_CharOutput_ExactPrint = 2;
const gestalt_LineInput = 3;
const gestalt_Unicode = 15;

/**
 * Create a Glk interface bound to a terminal output callback
 */
export function createGlk(terminal) {
  let outputBuffer = '';
  let windows = [];
  let streams = [];
  let currentStream = null;

  // Input state - stored explicitly for debugging
  const inputState = {
    buffer: null,
    maxLen: 0,
    pending: false,
    event: null,  // Store the glk_event to set length when input received
  };

  // Reference structure for events
  class RefStruct {
    constructor() {
      this.fields = [0, 0, 0, 0];
    }
    push_field(val) {
      this.fields.push(val);
    }
    get_field(idx) {
      return this.fields[idx] || 0;
    }
    set_field(idx, val) {
      this.fields[idx] = val;
    }
  }

  // Reference box for return values
  class RefBox {
    constructor() {
      this.value = 0;
    }
    set_value(val) {
      this.value = val;
    }
    get_value() {
      return this.value;
    }
  }

  // Create window object
  function createWindow(type, rock) {
    const win = {
      type,
      rock,
      str: createStream(rock),
      input_request_type: null,
      line_input_buf: null,
    };
    windows.push(win);
    return win;
  }

  // Create stream object
  function createStream(rock) {
    const str = {
      rock: rock || 0,
      write_count: 0,
      read_count: 0,
      data: [],
      pos: 0,
    };
    streams.push(str);
    return str;
  }

  // Main window/stream
  const mainWindow = createWindow(wintype_TextBuffer, 201);
  const mainStream = mainWindow.str;
  currentStream = mainStream;

  const Glk = {
    // Class constructors
    RefStruct,
    RefBox,

    // Fatal error handler
    fatal_error: function(msg) {
      console.error('Glk fatal error:', msg);
      terminal.handleError(String(msg));
    },

    // Exit
    glk_exit: function() {
      if (outputBuffer) {
        terminal.print(outputBuffer);
        outputBuffer = '';
      }
      terminal.print('\n*** Game session ended ***');
    },

    // Gestalt - capability queries
    glk_gestalt: function(sel, val) {
      switch (sel) {
        case gestalt_CharOutput:
          return gestalt_CharOutput_ExactPrint;
        case gestalt_LineInput:
          return 1;
        case gestalt_Unicode:
          return 1;
        case 0x1100: // garglk_gestalt_Graphics (color support)
          return 0;
        default:
          return 0;
      }
    },

    glk_gestalt_ext: function(sel, val, arr) {
      return this.glk_gestalt(sel, val);
    },

    // Window management
    glk_window_open: function(split, method, size, wintype, rock) {
      return createWindow(wintype, rock);
    },

    glk_window_close: function(win, result) {
      if (result) {
        result.set_field(0, win.str.read_count);
        result.set_field(1, win.str.write_count);
      }
    },

    glk_window_get_stream: function(win) {
      return win ? win.str : mainStream;
    },

    glk_window_clear: function(win) {
      // Only clear for main text buffer
      if (win && win.type === wintype_TextBuffer) {
        terminal.clear();
      }
    },

    glk_set_window: function(win) {
      if (win) {
        currentStream = win.str;
      }
    },

    glk_window_get_size: function(win, widthref, heightref) {
      if (widthref) widthref.set_value(80);
      if (heightref) heightref.set_value(24);
    },

    glk_window_move_cursor: function(win, x, y) {
      // Ignored for simple terminal
    },

    glk_window_get_parent: function(win) {
      return mainWindow;
    },

    glk_window_set_arrangement: function(win, method, size, keywin) {
      // Ignored
    },

    glk_window_iterate: function(win, rockbox) {
      // Simple implementation - just return null (no more windows)
      return null;
    },

    // Stream management
    glk_stream_set_current: function(str) {
      currentStream = str || mainStream;
    },

    glk_stream_get_current: function() {
      return currentStream;
    },

    glk_stream_open_file: function(fref, fmode, rock) {
      const str = createStream(rock);
      str.fref = fref;
      str.fmode = fmode;

      if (fmode === filemode_Read || fmode === filemode_ReadWrite) {
        const saved = localStorage.getItem(fref.filename);
        if (saved) {
          try {
            str.data = JSON.parse(saved);
          } catch (e) {
            str.data = [];
          }
        }
      }
      return str;
    },

    glk_stream_open_file_uni: function(fref, fmode, rock) {
      return this.glk_stream_open_file(fref, fmode, rock);
    },

    glk_stream_open_memory: function(buf, buflen, fmode, rock) {
      const str = createStream(rock);
      str.buf = buf;
      str.buflen = buflen;
      str.fmode = fmode;
      return str;
    },

    glk_stream_open_memory_uni: function(buf, buflen, fmode, rock) {
      return this.glk_stream_open_memory(buf, buflen, fmode, rock);
    },

    glk_stream_close: function(str, result) {
      if (result) {
        result.set_field(0, str.read_count);
        result.set_field(1, str.write_count);
      }
      // If it's a file stream with write mode, save to localStorage
      if (str.fref && (str.fmode === filemode_Write || str.fmode === filemode_ReadWrite)) {
        localStorage.setItem(str.fref.filename, JSON.stringify(str.data));
      }
    },

    glk_stream_iterate: function(str, rockbox) {
      return null;
    },

    glk_stream_set_position: function(str, pos, seekmode) {
      if (seekmode === seekmode_Start) {
        str.pos = pos;
      } else if (seekmode === seekmode_Current) {
        str.pos += pos;
      } else if (seekmode === seekmode_End) {
        str.pos = (str.data ? str.data.length : 0) + pos;
      }
    },

    glk_stream_get_position: function(str) {
      return str.pos;
    },

    // Output - regular
    glk_put_char: function(ch) {
      outputBuffer += String.fromCharCode(ch);
    },

    glk_put_char_stream: function(str, ch) {
      if (str === mainStream || str === currentStream) {
        outputBuffer += String.fromCharCode(ch);
      } else if (str.buf) {
        if (str.pos < str.buflen) {
          str.buf[str.pos++] = ch;
        }
      } else if (str.data) {
        str.data.push(ch);
      }
      str.write_count++;
    },

    glk_put_string: function(text) {
      outputBuffer += text;
    },

    glk_put_string_stream: function(str, text) {
      if (str === mainStream || str === currentStream) {
        outputBuffer += text;
      } else if (str.data) {
        for (let i = 0; i < text.length; i++) {
          str.data.push(text.charCodeAt(i));
        }
      }
      str.write_count += text.length;
    },

    glk_put_buffer: function(buf) {
      for (let i = 0; i < buf.length; i++) {
        outputBuffer += String.fromCharCode(buf[i]);
      }
    },

    glk_put_buffer_stream: function(str, buf) {
      if (str === mainStream || str === currentStream) {
        for (let i = 0; i < buf.length; i++) {
          outputBuffer += String.fromCharCode(buf[i]);
        }
      } else if (str.data) {
        for (let i = 0; i < buf.length; i++) {
          str.data.push(buf[i]);
        }
      } else if (str.buf) {
        for (let i = 0; i < buf.length && str.pos < str.buflen; i++) {
          str.buf[str.pos++] = buf[i];
        }
      }
      str.write_count += buf.length;
    },

    // Output - Unicode
    glk_put_char_uni: function(ch) {
      outputBuffer += String.fromCodePoint(ch);
    },

    glk_put_char_stream_uni: function(str, ch) {
      this.glk_put_char_stream(str, ch);
    },

    glk_put_string_uni: function(text) {
      outputBuffer += text;
    },

    glk_put_buffer_uni: function(buf) {
      for (let i = 0; i < buf.length; i++) {
        outputBuffer += String.fromCodePoint(buf[i]);
      }
    },

    // JavaScript string output (ifvms extension)
    glk_put_jstring: function(text) {
      if (text) outputBuffer += text;
    },

    glk_put_jstring_stream: function(str, text) {
      if (!text) return;
      if (str === mainStream || str === currentStream) {
        outputBuffer += text;
      } else if (str.data) {
        for (let i = 0; i < text.length; i++) {
          str.data.push(text.charCodeAt(i));
        }
      }
      if (str) str.write_count += text.length;
    },

    // Input - read from stream
    glk_get_char_stream: function(str) {
      if (str.buf && str.pos < str.buflen) {
        str.read_count++;
        return str.buf[str.pos++];
      }
      if (str.data && str.pos < str.data.length) {
        str.read_count++;
        return str.data[str.pos++];
      }
      return -1;
    },

    glk_get_char_stream_uni: function(str) {
      return this.glk_get_char_stream(str);
    },

    glk_get_buffer_stream: function(str, buf, len) {
      let count = 0;
      const maxLen = len || buf.length;
      for (let i = 0; i < maxLen; i++) {
        const ch = this.glk_get_char_stream(str);
        if (ch === -1) break;
        buf[i] = ch;
        count++;
      }
      return count;
    },

    glk_get_buffer_stream_uni: function(str, buf, len) {
      return this.glk_get_buffer_stream(str, buf, len);
    },

    glk_get_line_stream: function(str, buf, len) {
      let count = 0;
      const maxLen = len || buf.length;
      for (let i = 0; i < maxLen - 1; i++) {
        const ch = this.glk_get_char_stream(str);
        if (ch === -1) break;
        buf[i] = ch;
        count++;
        if (ch === 10) break; // newline
      }
      return count;
    },

    glk_get_line_stream_uni: function(str, buf, len) {
      return this.glk_get_line_stream(str, buf, len);
    },

    // Style hints (ignored for terminal)
    glk_set_style: function(style) {},
    glk_set_style_stream: function(str, style) {},
    glk_stylehint_set: function(wintype, style, hint, value) {},
    glk_stylehint_clear: function(wintype, style, hint) {},

    // Gargoyle extensions (ignored)
    garglk_set_reversevideo_stream: function(str, val) {},

    // Input requests
    glk_request_line_event: function(win, buf, initlen) {
      this._request_line(win, buf, initlen);
    },

    glk_request_line_event_uni: function(win, buf, initlen) {
      this._request_line(win, buf, initlen);
    },

    _request_line: function(win, buf, initlen) {
      // Flush any pending output
      if (outputBuffer) {
        terminal.print(outputBuffer);
        outputBuffer = '';
      }

      // ifvms passes (win, buffer, initlen) - maxlen comes from buffer length
      const maxlen = buf ? buf.length : 0;

      // Store buffer reference in state object
      inputState.buffer = buf;
      inputState.maxLen = maxlen;
      inputState.pending = true;

      if (win) {
        win.input_request_type = 'line';
        win.line_input_buf = buf;
      }

      terminal.waitForInput((input) => {
        if (inputState.pending && inputState.buffer) {
          // Copy input to buffer
          const len = Math.min(input.length, inputState.maxLen);

          for (let i = 0; i < len; i++) {
            inputState.buffer[i] = input.charCodeAt(i);
          }

          // Set the input length in the event BEFORE resume is called
          if (inputState.event) {
            inputState.event.set_field(2, len);
          }

          inputState.pending = false;
        }
      });
    },

    glk_request_char_event: function(win) {
      if (outputBuffer) {
        terminal.print(outputBuffer);
        outputBuffer = '';
      }
      if (win) {
        win.input_request_type = 'char';
      }
    },

    glk_request_char_event_uni: function(win) {
      this.glk_request_char_event(win);
    },

    glk_cancel_line_event: function(win, event) {
      if (win) {
        win.input_request_type = null;
        win.line_input_buf = null;
      }
      if (event) {
        event.set_field(0, 0);
      }
    },

    glk_cancel_char_event: function(win) {
      if (win) {
        win.input_request_type = null;
      }
    },

    // Event handling
    glk_select: function(event) {
      // Store the event reference so we can set the length when input is received
      inputState.event = event;

      // Set event type - the length (field 2) will be set when input arrives
      event.set_field(0, evtype_LineInput);
      event.set_field(1, mainWindow);
      event.set_field(2, 0);  // Will be updated when input is received
      event.set_field(3, 0);  // Terminator key (0 = enter)
    },

    glk_select_poll: function(event) {
      event.set_field(0, evtype_None);
    },

    // Tick (for long operations)
    glk_tick: function() {},

    // File operations
    glk_fileref_create_by_prompt: function(usage, fmode, rock) {
      return { rock, usage, fmode, filename: 'zork1-save' };
    },

    glk_fileref_create_by_name: function(usage, name, rock) {
      return { rock, usage, filename: name };
    },

    glk_fileref_destroy: function(fref) {},

    glk_fileref_does_file_exist: function(fref) {
      return localStorage.getItem(fref.filename) !== null ? 1 : 0;
    },

    // Called after each VM step to flush output
    update: function() {
      if (outputBuffer) {
        terminal.print(outputBuffer);
        outputBuffer = '';
      }
    },
  };

  return Glk;
}
