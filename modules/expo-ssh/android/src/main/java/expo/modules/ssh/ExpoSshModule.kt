package expo.modules.ssh

import com.jcraft.jsch.ChannelShell
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session as JSchSession
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap

private data class SshSessionState(
  var jschSession: JSchSession? = null,
  var shellChannel: ChannelShell? = null,
  var shellOutput: OutputStream? = null,
  var readThread: Thread? = null,
)

class ExpoSshModule : Module() {

  private val sessions = ConcurrentHashMap<String, SshSessionState>()

  override fun definition() = ModuleDefinition {
    Name("ExpoSsh")

    Events("onData", "onError", "onClose")

    AsyncFunction("connect") { sessionId: String, host: String, port: Int,
                               username: String, password: String ->
      teardown(sessionId)
      val state = SshSessionState()
      sessions[sessionId] = state

      val jsch = JSch()
      val sess = jsch.getSession(username, host, port)
      sess.setPassword(password)
      sess.setConfig("StrictHostKeyChecking", "no")
      sess.setConfig("PreferredAuthentications", "password")
      sess.connect(15_000)

      openShell(sess, sessionId, state)
    }

    AsyncFunction("connectWithKey") { sessionId: String, host: String, port: Int,
                                      username: String, privateKeyPem: String, passphrase: String ->
      teardown(sessionId)
      val state = SshSessionState()
      sessions[sessionId] = state

      val jsch = JSch()
      val keyBytes = privateKeyPem.toByteArray(Charsets.UTF_8)
      val phrase = passphrase.ifEmpty { null }?.toByteArray(Charsets.UTF_8)
      jsch.addIdentity("cy-tty-key", keyBytes, null, phrase)

      val sess = jsch.getSession(username, host, port)
      sess.setConfig("StrictHostKeyChecking", "no")
      sess.setConfig("PreferredAuthentications", "publickey")
      sess.connect(15_000)

      openShell(sess, sessionId, state)
    }

    AsyncFunction("disconnect") { sessionId: String ->
      teardown(sessionId)
    }

    AsyncFunction("write") { sessionId: String, data: String ->
      val out = sessions[sessionId]?.shellOutput
        ?: throw IllegalStateException("Session not connected: $sessionId")
      out.write(data.toByteArray(Charsets.ISO_8859_1))
      out.flush()
    }

    AsyncFunction("resize") { sessionId: String, cols: Int, rows: Int ->
      sessions[sessionId]?.shellChannel?.setPtySize(cols, rows, 0, 0)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private fun openShell(sess: JSchSession, sessionId: String, state: SshSessionState) {
    val ch = sess.openChannel("shell") as ChannelShell
    ch.setPtyType("xterm-256color")
    ch.setPtySize(80, 24, 0, 0)

    // Capture streams BEFORE connect() so we don't miss early data
    val inStream = ch.inputStream
    val outStream = ch.outputStream

    ch.connect(15_000)

    state.jschSession = sess
    state.shellChannel = ch
    state.shellOutput = outStream

    startReading(inStream, sessionId, state)
  }

  /**
   * Reads SSH output on a daemon thread and emits onData events tagged with
   * the session ID, so the JS side can route bytes to the correct VT instance.
   */
  private fun startReading(inStream: InputStream, sessionId: String, state: SshSessionState) {
    val thread = Thread {
      val buf = ByteArray(8_192)
      try {
        while (!Thread.currentThread().isInterrupted) {
          val n = inStream.read(buf)
          if (n == -1) break
          val data = String(buf, 0, n, Charsets.ISO_8859_1)
          sendEvent("onData", mapOf("sessionId" to sessionId, "data" to data))
        }
      } catch (e: Exception) {
        if (!Thread.currentThread().isInterrupted) {
          sendEvent("onError", mapOf("sessionId" to sessionId, "message" to (e.message ?: "Read error")))
        }
      } finally {
        sessions.remove(sessionId)
        sendEvent("onClose", mapOf("sessionId" to sessionId))
      }
    }
    thread.isDaemon = true
    thread.name = "expo-ssh-read-$sessionId"
    thread.start()
    state.readThread = thread
  }

  private fun teardown(sessionId: String) {
    val state = sessions.remove(sessionId) ?: return
    state.readThread?.interrupt()
    try { state.shellChannel?.disconnect() } catch (_: Exception) {}
    try { state.jschSession?.disconnect() } catch (_: Exception) {}
  }
}
