package expo.modules.terminalkeyboard

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoTerminalKeyboardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTerminalKeyboard")

    View(TerminalKeyboardView::class) {
      Events("onInput")

      Prop("focused") { view: TerminalKeyboardView, focused: Boolean ->
        view.setTerminalFocused(focused)
      }
    }
  }
}
