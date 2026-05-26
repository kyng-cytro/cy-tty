package expo.modules.terminalkeyboard

import android.content.Context
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

private const val TAG = "CyTTY-Keyboard"

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

  // React Native's layout engine can round sub-pixel sizes to 0. Override
  // onMeasure so this view always reports at least 1×1 px — Android refuses
  // requestFocus() on zero-area views regardless of isFocusable.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    if (measuredWidth == 0 || measuredHeight == 0) {
      Log.d(TAG, "onMeasure: forcing 1×1 (was ${measuredWidth}×${measuredHeight})")
      setMeasuredDimension(maxOf(1, measuredWidth), maxOf(1, measuredHeight))
    }
  }

  // ── Public API (called from Expo prop setter) ──────────────────────────────

  fun setTerminalFocused(focused: Boolean) {
    Log.d(TAG, "setTerminalFocused($focused) called on thread=${Thread.currentThread().name}")
    mainHandler.post {
      Log.d(TAG, "setTerminalFocused($focused) executing on main thread, wantKeyboard=$wantKeyboard")
      wantKeyboard = focused
      if (focused) {
        val focusResult = requestFocus()
        Log.d(TAG, "requestFocus() returned=$focusResult  isFocused=$isFocused  isAttachedToWindow=$isAttachedToWindow  w=${width}x${height}")
        showIme(allowToggleFallback = true)
        mainHandler.postDelayed({
          Log.d(TAG, "postDelayed retry: wantKeyboard=$wantKeyboard  isFocused=$isFocused")
          // No toggleSoftInput here — calling it while keyboard is open would close it
          if (wantKeyboard) showIme(allowToggleFallback = false)
        }, 300)
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
   * @param allowToggleFallback Only true on the FIRST attempt. toggleSoftInput
   *   is idempotent-open but calling it a second time while the keyboard is
   *   already visible will close it — so the retry must never use it.
   */
  private fun showIme(allowToggleFallback: Boolean = false) {
    val m = imm()
    val shown = m.showSoftInput(this, InputMethodManager.SHOW_FORCED)
    Log.d(TAG, "showSoftInput() returned=$shown  isFocused=$isFocused  fallback=$allowToggleFallback")
    if (!shown && allowToggleFallback) {
      Log.d(TAG, "showSoftInput failed — using toggleSoftInput (first attempt only)")
      @Suppress("DEPRECATION")
      m.toggleSoftInput(InputMethodManager.SHOW_FORCED, InputMethodManager.HIDE_IMPLICIT_ONLY)
    }
  }

  private fun hideIme() {
    Log.d(TAG, "hideIme()")
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
    Log.d(TAG, "onFocusChanged(gainFocus=$gainFocus)  wantKeyboard=$wantKeyboard")
    if (gainFocus && wantKeyboard) showIme(allowToggleFallback = false)
  }

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
    Log.d(TAG, "onCreateInputConnection() called — IME is connecting")
    outAttrs.inputType = InputType.TYPE_NULL
    outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
    return TerminalInputConnection(this)
  }

  // ── InputConnection ────────────────────────────────────────────────────────

  override fun onCheckIsTextEditor(): Boolean = true

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
