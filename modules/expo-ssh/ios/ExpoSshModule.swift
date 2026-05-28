import ExpoModulesCore
import NMSSH

// MARK: - Per-session state

private class SshSessionState {
  let session: NMSSHSession
  var channel: NMSSHChannel?
  let delegate: SshChannelDelegate

  init(session: NMSSHSession, delegate: SshChannelDelegate) {
    self.session = session
    self.delegate = delegate
  }
}

// MARK: - Per-session channel delegate

private class SshChannelDelegate: NSObject, NMSSHChannelDelegate {
  let sessionId: String
  // Weak ref so the delegate doesn't prevent module deallocation.
  weak var module: ExpoSshModule?

  private let urlRegex = try! NSRegularExpression(pattern: "https?://\\S+")
  private let knownAuthHosts: Set<String> = ["login.tailscale.com"]
  private var authChallengeFired = false

  init(sessionId: String, module: ExpoSshModule) {
    self.sessionId = sessionId
    self.module = module
  }

  func channel(_ channel: NMSSHChannel, didReadData message: String) {
    // Check for auth URL in data stream (Tailscale keyboard-interactive over shell)
    if !authChallengeFired, let url = extractAuthUrl(from: message) {
      authChallengeFired = true
      module?.sendEvent("onAuthChallenge", ["sessionId": sessionId, "url": url])
      return
    }
    module?.sendEvent("onData", ["sessionId": sessionId, "data": message])
  }

  func channel(_ channel: NMSSHChannel, didReadError error: String) {
    module?.sendEvent("onError", ["sessionId": sessionId, "message": error])
  }

  func channelShellDidClose(_ channel: NMSSHChannel) {
    module?.handleShellClose(sessionId: sessionId)
  }

  private func extractAuthUrl(from text: String) -> String? {
    let range = NSRange(text.startIndex..., in: text)
    guard let match = urlRegex.firstMatch(in: text, range: range),
          let urlRange = Range(match.range, in: text) else { return nil }
    let url = String(text[urlRange])
    guard let host = URLComponents(string: url)?.host else { return nil }
    let isKnown = knownAuthHosts.contains(where: { host == $0 || host.hasSuffix(".\($0)") })
    return isKnown ? url : nil
  }
}

// MARK: - Module

public class ExpoSshModule: Module {

  private var sessions = [String: SshSessionState]()
  private let sshQueue = DispatchQueue(label: "expo.ssh.queue", qos: .userInitiated)

  // MARK: Module definition

  public func definition() -> ModuleDefinition {
    Name("ExpoSsh")

    Events("onData", "onError", "onClose", "onAuthChallenge")

    // ── connect ─────────────────────────────────────────────────────────────
    AsyncFunction("connect") { [weak self] (
      sessionId: String, host: String, port: Int, username: String, password: String,
      promise: Promise
    ) in
      guard let self else { promise.reject("SSH_ERROR", "Module deallocated"); return }
      self.sshQueue.async {
        self.teardown(sessionId: sessionId)

        let sess = NMSSHSession(host: host, port: port, andUsername: username)
        sess.connect()
        guard sess.isConnected else {
          promise.reject("SSH_CONNECT", "Failed to connect to \(host):\(port)")
          return
        }

        sess.keepAliveInterval = 30
        sess.authenticate(byPassword: password)
        guard sess.isAuthorized else {
          sess.disconnect()
          promise.reject("SSH_AUTH", "Authentication failed for \(username)@\(host)")
          return
        }

        self.openShell(sess: sess, sessionId: sessionId, promise: promise)
      }
    }

    // ── connectWithKey ──────────────────────────────────────────────────────
    AsyncFunction("connectWithKey") { [weak self] (
      sessionId: String, host: String, port: Int, username: String,
      privateKeyPem: String, passphrase: String,
      promise: Promise
    ) in
      guard let self else { promise.reject("SSH_ERROR", "Module deallocated"); return }
      self.sshQueue.async {
        self.teardown(sessionId: sessionId)

        let sess = NMSSHSession(host: host, port: port, andUsername: username)
        sess.connect()
        guard sess.isConnected else {
          promise.reject("SSH_CONNECT", "Failed to connect to \(host):\(port)")
          return
        }

        sess.keepAliveInterval = 30
        let phrase: String? = passphrase.isEmpty ? nil : passphrase
        sess.authenticateByPublicKey(
          withUsername: username,
          password: phrase,
          publicKey: nil,
          privateKey: privateKeyPem
        )
        guard sess.isAuthorized else {
          sess.disconnect()
          promise.reject("SSH_AUTH", "Key authentication failed for \(username)@\(host)")
          return
        }

        self.openShell(sess: sess, sessionId: sessionId, promise: promise)
      }
    }

    // ── disconnect ──────────────────────────────────────────────────────────
    AsyncFunction("disconnect") { [weak self] (sessionId: String, promise: Promise) in
      guard let self else { promise.resolve(nil); return }
      self.sshQueue.async {
        self.teardown(sessionId: sessionId)
        promise.resolve(nil)
      }
    }

    // ── write ───────────────────────────────────────────────────────────────
    AsyncFunction("write") { [weak self] (sessionId: String, data: String, promise: Promise) in
      guard let self else { promise.reject("SSH_ERROR", "Module deallocated"); return }
      self.sshQueue.async {
        guard let ch = self.sessions[sessionId]?.channel else {
          promise.reject("SSH_ERROR", "Not connected: \(sessionId)")
          return
        }
        var writeError: NSError?
        ch.write(data, error: &writeError, timeout: 30)
        if let err = writeError {
          promise.reject("SSH_WRITE", err.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    // ── resize ──────────────────────────────────────────────────────────────
    AsyncFunction("resize") { [weak self] (sessionId: String, cols: Int, rows: Int, promise: Promise) in
      guard let self else { promise.resolve(nil); return }
      self.sshQueue.async {
        self.sessions[sessionId]?.channel?.requestSizeWidth(UInt(cols), height: UInt(rows))
        promise.resolve(nil)
      }
    }
  }

  // MARK: Internal callback (called from SshChannelDelegate)

  func handleShellClose(sessionId: String) {
    sshQueue.async { [weak self] in
      self?.sessions.removeValue(forKey: sessionId)
    }
    sendEvent("onClose", ["sessionId": sessionId])
  }

  // MARK: Private helpers

  /// Must only be called from within `sshQueue`.
  private func openShell(sess: NMSSHSession, sessionId: String, promise: Promise) {
    let delegate = SshChannelDelegate(sessionId: sessionId, module: self)
    let state = SshSessionState(session: sess, delegate: delegate)

    let ch = sess.channel
    ch.delegate = delegate
    ch.requestPty = true
    ch.ptyTerminalType = .xterm

    var shellError: NSError?
    let started = ch.startShell(&shellError)
    guard started, shellError == nil else {
      sess.disconnect()
      promise.reject("SSH_SHELL", shellError?.localizedDescription ?? "Failed to start shell")
      return
    }

    state.channel = ch
    sessions[sessionId] = state
    promise.resolve(nil)
  }

  /// Must only be called from within `sshQueue`.
  private func teardown(sessionId: String) {
    guard let state = sessions.removeValue(forKey: sessionId) else { return }
    state.channel?.close()
    state.session.disconnect()
  }
}
