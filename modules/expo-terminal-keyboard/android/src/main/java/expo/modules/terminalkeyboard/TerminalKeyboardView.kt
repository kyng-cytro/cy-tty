package expo.modules.terminalkeyboard

import android.content.Context
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

private const val ESC = ""

class TerminalKeyboardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val onInput by EventDispatcher<Map<String, Any>>()

  private val mainHandler = Handler(Looper.getMainLooper())
  private var wantKeyboard = false

  init {
    isFocusable = true
    isFocusableInTouchMode = true
    // Non-zero so Android's window manager considers the view layout-visible
    minimumWidth = 1
    minimumHeight = 1
  }

  // ── Public API (called from Expo prop setter) ──────────────────────────────

  fun setTerminalFocused(focused: Boolean) {
    mainHandler.post {
      wantKeyboard = focused
      if (focused) {
        requestFocus()
        showIme()
        // Belt-and-suspenders retry: sometimes the first call fires before the
        // IME service is ready (e.g. screen just became visible)
        mainHandler.postDelayed({ if (wantKeyboard) showIme() }, 300)
      } else {
        hideIme()
        clearFocus()
      }
    }
  }

  // ── IME helpers ────────────────────────────────────────────────────────────

  private fun imm() =
    context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager

  /**
   * Show the soft keyboard.
   * SHOW_FORCED bypasses the "implicit" heuristic that suppresses the IME
   * when the view has no size or is not the "expected" text editor.
   * We fall back to toggleSoftInput if the direct call returns false, which
   * can happen on some OEM ROMs where showSoftInput is gated on window focus.
   */
  private fun showIme() {
    val m = imm()
    val shown = m.showSoftInput(this, InputMethodManager.SHOW_FORCED)
    if (!shown) {
      @Suppress("DEPRECATION")
      m.toggleSoftInput(InputMethodManager.SHOW_FORCED, InputMethodManager.HIDE_IMPLICIT_ONLY)
    }
  }

  private fun hideIme() {
    imm().hideSoftInputFromWindow(windowToken, 0)
  }

  // ── Focus changes ──────────────────────────────────────────────────────────

  /**
   * When the view actually receives focus (possibly asynchronously after
   * requestFocus()), try showing the keyboard again — this is the most
   * reliable trigger point on Android.
   */
  override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
    super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
    if (gainFocus && wantKeyboard) showIme()
  }

  // ── InputConnection ────────────────────────────────────────────────────────

  override fun onCheckIsTextEditor(): Boolean = true

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
    outAttrs.inputType = InputType.TYPE_NULL
    outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
    return TerminalInputConnection(this)
  }

  private fun dispatchInput(data: String) {
    onInput(mapOf("data" to data))
  }

  inner class TerminalInputConnection(view: View) : BaseInputConnection(view, false) {

    override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
      val str = text?.toString() ?: return true
      dispatchInput(if (str == "\n") "\r" else str)
      return true
    }

    override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
      repeat(beforeLength) { dispatchInput("") }
      return true
    }

    override fun sendKeyEvent(event: KeyEvent): Boolean {
      if (event.action == KeyEvent.ACTION_DOWN) {
        val seq = mapKeyEvent(event)
        if (seq != null) {
          dispatchInput(seq)
          return true
        }
      }
      return super.sendKeyEvent(event)
    }
  }

  // ── Hardware key mapping ───────────────────────────────────────────────────

  private fun mapKeyEvent(event: KeyEvent): String? {
    if (event.isCtrlPressed) {
      val unicode = event.getUnicodeChar(0)
      if (unicode > 0) {
        val c = unicode.toChar().lowercaseChar()
        if (c in 'a'..'z') return (c.code - 96).toChar().toString()
      }
    }

    return when (event.keyCode) {
      KeyEvent.KEYCODE_DPAD_UP     -> "$ESC[A"
      KeyEvent.KEYCODE_DPAD_DOWN   -> "$ESC[B"
      KeyEvent.KEYCODE_DPAD_RIGHT  -> "$ESC[C"
      KeyEvent.KEYCODE_DPAD_LEFT   -> "$ESC[D"
      KeyEvent.KEYCODE_MOVE_HOME   -> "$ESC[H"
      KeyEvent.KEYCODE_MOVE_END    -> "$ESC[F"
      KeyEvent.KEYCODE_PAGE_UP     -> "$ESC[5~"
      KeyEvent.KEYCODE_PAGE_DOWN   -> "$ESC[6~"
      KeyEvent.KEYCODE_FORWARD_DEL -> "$ESC[3~"
      KeyEvent.KEYCODE_INSERT      -> "$ESC[2~"
      KeyEvent.KEYCODE_F1          -> "${ESC}OP"
      KeyEvent.KEYCODE_F2          -> "${ESC}OQ"
      KeyEvent.KEYCODE_F3          -> "${ESC}OR"
      KeyEvent.KEYCODE_F4          -> "${ESC}OS"
      KeyEvent.KEYCODE_F5          -> "$ESC[15~"
      KeyEvent.KEYCODE_F6          -> "$ESC[17~"
      KeyEvent.KEYCODE_F7          -> "$ESC[18~"
      KeyEvent.KEYCODE_F8          -> "$ESC[19~"
      KeyEvent.KEYCODE_F9          -> "$ESC[20~"
      KeyEvent.KEYCODE_F10         -> "$ESC[21~"
      KeyEvent.KEYCODE_F11         -> "$ESC[23~"
      KeyEvent.KEYCODE_F12         -> "$ESC[24~"
      KeyEvent.KEYCODE_TAB         -> if (event.isShiftPressed) "$ESC[Z" else "\t"
      KeyEvent.KEYCODE_ESCAPE      -> ESC
      KeyEvent.KEYCODE_ENTER       -> "\r"
      else                         -> null
    }
  }
}
