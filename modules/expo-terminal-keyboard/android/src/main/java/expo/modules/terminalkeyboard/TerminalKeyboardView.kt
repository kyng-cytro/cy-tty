package expo.modules.terminalkeyboard

import android.content.Context
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

private const val ESC = ""
private const val DEL = ""

// ExpoView (→ ReactViewGroup) cannot be the IME target: React Native's focus management
// returns false from requestFocus() on ViewGroups. We embed a plain View child that has
// no RN lifecycle and let IT own the InputConnection.
class TerminalKeyboardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val onInput by EventDispatcher<Map<String, Any>>()

  private val imeView = ImeInputView(context)

  init {
    addView(imeView, FrameLayout.LayoutParams(1, 1))
  }

  fun setTerminalFocused(focused: Boolean) {
    if (focused) {
      imeView.requestFocus()
      imm().showSoftInput(imeView, InputMethodManager.SHOW_FORCED)
    } else {
      imm().hideSoftInputFromWindow(imeView.windowToken, 0)
      imeView.clearFocus()
    }
  }

  private fun imm() =
    context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager

  private fun dispatchInput(data: String) {
    onInput(mapOf("data" to data))
  }

  inner class ImeInputView(context: Context) : View(context) {

    init {
      isFocusable = true
      isFocusableInTouchMode = true
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      setMeasuredDimension(1, 1)
    }

    override fun onCheckIsTextEditor(): Boolean = true

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
      outAttrs.inputType = InputType.TYPE_NULL
      outAttrs.imeOptions =
        EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
      return TerminalInputConnection(this)
    }
  }

  inner class TerminalInputConnection(view: View) : BaseInputConnection(view, false) {

    override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
      val str = text?.toString() ?: return true
      dispatchInput(if (str == "\n") "\r" else str)
      return true
    }

    override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
      repeat(beforeLength) { dispatchInput(DEL) }
      return true
    }

    override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean {
      repeat(beforeLength) { dispatchInput(DEL) }
      return true
    }

    override fun sendKeyEvent(event: KeyEvent): Boolean {
      if (event.action != KeyEvent.ACTION_DOWN) return super.sendKeyEvent(event)

      if (event.isCtrlPressed) {
        val unicode = event.getUnicodeChar(0)
        if (unicode > 0) {
          val c = unicode.toChar().lowercaseChar()
          if (c in 'a'..'z') { dispatchInput((c.code - 96).toChar().toString()); return true }
        }
      }

      val seq = mapKey(event)
      if (seq != null) { dispatchInput(seq); return true }

      val ch = event.unicodeChar
      if (ch > 0) { dispatchInput(ch.toChar().toString()); return true }

      return super.sendKeyEvent(event)
    }
  }

  private fun mapKey(event: KeyEvent): String? = when (event.keyCode) {
    KeyEvent.KEYCODE_DEL         -> DEL
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
