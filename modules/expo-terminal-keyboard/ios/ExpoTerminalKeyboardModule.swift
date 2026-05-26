import ExpoModulesCore

public class ExpoTerminalKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTerminalKeyboard")

    View(TerminalKeyboardView.self) {
      Events("onInput")

      Prop("focused") { (view: TerminalKeyboardView, focused: Bool) in
        DispatchQueue.main.async {
          if focused {
            _ = view.becomeFirstResponder()
          } else {
            _ = view.resignFirstResponder()
          }
        }
      }
    }
  }
}
