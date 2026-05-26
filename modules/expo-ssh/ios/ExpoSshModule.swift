import ExpoModulesCore
import NMSSH

// MARK: - Module

public class ExpoSshModule: Module {

  private var session: NMSSHSession?
  private var channel: NMSSHChannel?

  /// All blocking libssh2 / NMSSH operations run on this serial queue.
  /// Promises are also resolved / rejected from this queue.
  private let sshQueue = DispatchQueue(label: "expo.ssh.queue", qos: .userInitiated)

  // MARK: Module definition

  public func definition() -> ModuleDefinition {
    Name("ExpoSsh")

    Events("onData", "onError", "onClose")

    // ── connect ─────────────────────────────────────────────────────────────
    AsyncFunction("connect") { [weak self] (
      host: String, port: Int, username: String, password: String,
      promise: Promise
    ) in
      guard let self else {
        promise.reject("SSH_ERROR", "Module deallocated")
        return
      }

      self.sshQueue.async {
        // Tear down any existing connection first (safe: running on sshQueue)
        self.closeConnectionOnQueue()

        let sess = NMSSHSession(host: host, port: port, andUsername: username)
        sess.connect()

        guard sess.isConnected else {
          promise.reject("SSH_CONNECT", "Failed to connect to \(host):\(port)")
          return
        }

        sess.authenticate(byPassword: password)

        guard sess.isAuthorized else {
          sess.disconnect()
          promise.reject("SSH_AUTH", "Authentication failed for \(username)@\(host)")
          return
        }

        let ch = sess.channel
        ch.delegate = self
        ch.requestPty = true
        ch.ptyTerminalType = .xterm  // maps to "xterm"; 256-colour handled by VT parser

        var shellError: NSError?
        let started = ch.startShell(&shellError)

        guard started, shellError == nil else {
          sess.disconnect()
          let msg = shellError?.localizedDescription ?? "Failed to start shell"
          promise.reject("SSH_SHELL", msg)
          return
        }

        self.session = sess
        self.channel = ch
        promise.resolve(nil)
      }
    }

    // ── disconnect ──────────────────────────────────────────────────────────
    AsyncFunction("disconnect") { [weak self] (promise: Promise) in
      guard let self else { promise.resolve(nil); return }
      self.sshQueue.async {
        self.closeConnectionOnQueue()
        promise.resolve(nil)
      }
    }

    // ── write ───────────────────────────────────────────────────────────────
    AsyncFunction("write") { [weak self] (data: String, promise: Promise) in
      guard let self else { promise.reject("SSH_ERROR", "Module deallocated"); return }
      self.sshQueue.async {
        guard let ch = self.channel else {
          promise.reject("SSH_ERROR", "Not connected")
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
    AsyncFunction("resize") { [weak self] (cols: Int, rows: Int, promise: Promise) in
      guard let self else { promise.resolve(nil); return }
      self.sshQueue.async {
        self.channel?.requestSizeWidth(UInt(cols), height: UInt(rows))
        promise.resolve(nil)
      }
    }
  }

  // MARK: Private helpers

  /// Must only be called from within `sshQueue`.
  private func closeConnectionOnQueue() {
    channel?.close()
    session?.disconnect()
    channel = nil
    session = nil
  }
}

// MARK: - NMSSHChannelDelegate

extension ExpoSshModule: NMSSHChannelDelegate {

  public func channel(_ channel: NMSSHChannel, didReadData message: String) {
    sendEvent("onData", ["data": message])
  }

  public func channel(_ channel: NMSSHChannel, didReadError error: String) {
    sendEvent("onError", ["message": error])
  }

  public func channelShellDidClose(_ channel: NMSSHChannel) {
    // Nil out on sshQueue to stay consistent with all other mutations
    sshQueue.async { [weak self] in
      self?.channel = nil
      self?.session = nil
    }
    sendEvent("onClose", [:])
  }
}
