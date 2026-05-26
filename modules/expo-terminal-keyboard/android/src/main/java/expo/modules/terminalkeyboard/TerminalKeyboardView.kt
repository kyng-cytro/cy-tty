package expo.modules.terminalkeyboard

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.view.inputmethod.InputType
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

private const val ESC = "\u001b"

class TerminalKeyboardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  init {
    isFocusable = true
    isFocusableInTouchMode = true
  }

  fun setTerminalFocused(focused: Boolean) {
    if (focused) {
      requestFocus()
      post {
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(this, InputMethodManager.SHOW_IMPLICIT)
      }
    } else {
      val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
      imm.hideSoftInputFromWindow(windowToken, 0)
      clearFocus()
    }
  }

  override fun onCheckIsTextEditor(): Boolean = true

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
    outAttrs.inputType = InputType.TYPE_NULL
    outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
    return TerminalInputConnection(this)
  }

  private fun dispatchInput(data: String) {
    try {
      val params = Arguments.createMap().apply { putString("data", data) }
      (context as? ReactContext)
        ?.getJSModule(RCTEventEmitter::class.java)
        ?.receiveEvent(id, "onInput", params)
    } catch (_: Exception) {}
  }

  inner class TerminalInputConnection(view: View) : BaseInputConnection(view, false) {

    override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
      val str = text?.toString() ?: return true
      dispatchInput(if (str == "\n") "\r" else str)
      return true
    }

    override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
      repeat(beforeLength) { dispatchInput("") }
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
