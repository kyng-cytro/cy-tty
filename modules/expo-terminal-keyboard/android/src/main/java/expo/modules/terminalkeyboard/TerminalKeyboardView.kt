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
    minimumWidth = 1
    minimumHeight = 1
  }

  // React Native's layout engine rounds sub-pixel sizes to 0; Android refuses
  // requestFocus() on zero-area views, so clamp to at least 1×1 px.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    if (measuredWidth == 0 || measuredHeight == 0)
      setMeasuredDimension(maxOf(1, measuredWidth), maxOf(1, measuredHeight))
  }

  fun setTerminalFocused(focused: Boolean) {
    mainHandler.post {
      wantKeyboard = focused
      if (focused) {
        requestFocus()
        showIme(allowToggleFallback = true)
        // Retry once in case showSoftInput fired before the IME service was ready.
        // Must NOT use toggleSoftInput here — it would close an already-open keyboard.
        mainHandler.postDelayed({ if (wantKeyboard) showIme(allowToggleFallback = false) }, 300)
      } else {
        imm().hideSoftInputFromWindow(windowToken, 0)
        clearFocus()
      }
    }
  }

  override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
    super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
    if (gainFocus && wantKeyboard) showIme(allowToggleFallback = false)
  }

  override fun onCheckIsTextEditor(): Boolean = true

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
    outAttrs.inputType = InputType.TYPE_NULL
    outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
    return TerminalInputConnection(this)
  }

  private fun imm() =
    context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager

  private fun showIme(allowToggleFallback: Boolean) {
    val shown = imm().showSoftInput(this, InputMethodManager.SHOW_FORCED)
    if (!shown && allowToggleFallback) {
      @Suppress("DEPRECATION")
      imm().toggleSoftInput(InputMethodManager.SHOW_FORCED, InputMethodManager.HIDE_IMPLICIT_ONLY)
    }
  }

  private fun dispatchInput(data: String) = onInput(mapOf("data" to data))

  inner class TerminalInputConnection(view: View) : BaseInputConnection(view, false) {

    // Some IMEs call commitText for soft-key text; others (especially with
    // TYPE_NULL) call sendKeyEvent for everything. Both paths must work.

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
      if (event.action != KeyEvent.ACTION_DOWN) return super.sendKeyEvent(event)

      // Ctrl combos
      if (event.isCtrlPressed) {
        val unicode = event.getUnicodeChar(0)
        if (unicode > 0) {
          val c = unicode.toChar().lowercaseChar()
          if (c in 'a'..'z') { dispatchInput((c.code - 96).toChar().toString()); return true }
        }
      }

      // Special / function keys
      val seq = mapKey(event)
      if (seq != null) { dispatchInput(seq); return true }

      // Printable characters — TYPE_NULL IMEs route all text through sendKeyEvent.
      // event.unicodeChar already factors in Shift and other meta state.
      val ch = event.unicodeChar
      if (ch > 0) { dispatchInput(ch.toChar().toString()); return true }

      return super.sendKeyEvent(event)
    }
  }

  private fun mapKey(event: KeyEvent): String? = when (event.keyCode) {
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
