import ExpoModulesCore
import UIKit

class TerminalKeyboardView: ExpoView, UIKeyInput {
  let onInput = EventDispatcher()

  // MARK: – UIKeyInput

  // Always report hasText = true so deleteBackward fires even at the
  // "start" — there is no buffer so this is a safe lie.
  var hasText: Bool { true }

  func insertText(_ text: String) {
    // The OS sends "\n" for the Return key; terminals expect "\r".
    onInput(["data": text == "\n" ? "\r" : text])
  }

  func deleteBackward() {
    onInput(["data": "\u{7F}"])
  }

  // MARK: – Responder

  override var canBecomeFirstResponder: Bool { true }

  // MARK: – UITextInputTraits (disable all OS text assistance)

  override var autocorrectionType: UITextAutocorrectionType {
    get { .no }
    set {}
  }

  override var autocapitalizationType: UITextAutocapitalizationType {
    get { .none }
    set {}
  }

  override var spellCheckingType: UITextSpellCheckingType {
    get { .no }
    set {}
  }

  override var smartQuotesType: UITextSmartQuotesType {
    get { .no }
    set {}
  }

  override var smartDashesType: UITextSmartDashesType {
    get { .no }
    set {}
  }

  // MARK: – Hardware keyboard (iOS 13.4+)

  override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    var handled = false
    for press in presses {
      guard let key = press.key else { continue }
      if let seq = mapHardwareKey(key) {
        onInput(["data": seq])
        handled = true
      }
    }
    if !handled {
      super.pressesBegan(presses, with: event)
    }
  }

  private func mapHardwareKey(_ key: UIKey) -> String? {
    // Ctrl + letter
    if key.modifierFlags.contains(.control) {
      let ch = key.charactersIgnoringModifiers
      if ch.count == 1, let scalar = ch.unicodeScalars.first {
        let v = scalar.value
        if v >= 97 && v <= 122 { return String(UnicodeScalar(v - 96)!) }
        if v >= 65 && v <= 90  { return String(UnicodeScalar(v - 64)!) }
      }
    }

    switch key.keyCode {
    case .keyboardUpArrow:    return "\u{1B}[A"
    case .keyboardDownArrow:  return "\u{1B}[B"
    case .keyboardRightArrow: return "\u{1B}[C"
    case .keyboardLeftArrow:  return "\u{1B}[D"
    case .keyboardHome:       return "\u{1B}[H"
    case .keyboardEnd:        return "\u{1B}[F"
    case .keyboardPageUp:     return "\u{1B}[5~"
    case .keyboardPageDown:   return "\u{1B}[6~"
    case .keyboardDeleteForward: return "\u{1B}[3~"
    case .keyboardF1:  return "\u{1B}OP"
    case .keyboardF2:  return "\u{1B}OQ"
    case .keyboardF3:  return "\u{1B}OR"
    case .keyboardF4:  return "\u{1B}OS"
    case .keyboardF5:  return "\u{1B}[15~"
    case .keyboardF6:  return "\u{1B}[17~"
    case .keyboardF7:  return "\u{1B}[18~"
    case .keyboardF8:  return "\u{1B}[19~"
    case .keyboardF9:  return "\u{1B}[20~"
    case .keyboardF10: return "\u{1B}[21~"
    case .keyboardF11: return "\u{1B}[23~"
    case .keyboardF12: return "\u{1B}[24~"
    case .keyboardTab:
      return key.modifierFlags.contains(.shift) ? "\u{1B}[Z" : "\t"
    case .keyboardEscape:
      return "\u{1B}"
    default:
      return nil
    }
  }
}
