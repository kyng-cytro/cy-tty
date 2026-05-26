package expo.modules.ssh

import com.jcraft.jsch.ChannelShell
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session as JSchSession
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.InputStream
import java.io.OutputStream

class ExpoSshModule : Module() {

  private var jschSession: JSchSession? = null
  private var shellChannel: ChannelShell? = null
  private var shellInput: InputStream? = null
  private var shellOutput: OutputStream? = null
  private var readThread: Thread? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoSsh")

    // ── Events ──────────────────────────────────────────────────────────────
    Events("onData", "onError", "onClose")

    // ── connect ─────────────────────────────────────────────────────────────
    // AsyncFunction runs on a background thread; blocking JSch calls are safe here.
    AsyncFunction("connect") { host: String, port: Int, username: String, password: String ->
      // Clean up any lingering connection first
      teardown()

      val jsch = JSch()
      val sess = jsch.getSession(username, host, port)
      sess.setPassword(password)
      sess.setConfig("StrictHostKeyChecking", "no")
      sess.setConfig("PreferredAuthentications", "password")
      sess.connect(15_000)

      val ch = sess.openChannel("shell") as ChannelShell
      ch.setPtyType("xterm-256color")
      ch.setPtySize(80, 24, 0, 0)

      // Capture streams BEFORE connect() so we don't miss early data
      val inStream = ch.inputStream
      val outStream = ch.outputStream

      ch.connect(15_000)

      jschSession = sess
      shellChannel = ch
      shellInput = inStream
      shellOutput = outStream

      startReading(inStream, ch)
    }

    // ── disconnect ──────────────────────────────────────────────────────────
    AsyncFunction("disconnect") {
      teardown()
    }

    // ── write ───────────────────────────────────────────────────────────────
    AsyncFunction("write") { data: String ->
      val out = shellOutput ?: throw IllegalStateException("Not connected")
      // ISO-8859-1 maps bytes 0-255 to chars 0-255 — binary-safe for terminal I/O
      out.write(data.toByteArray(Charsets.ISO_8859_1))
      out.flush()
    }

    // ── resize ──────────────────────────────────────────────────────────────
    AsyncFunction("resize") { cols: Int, rows: Int ->
      shellChannel?.setPtySize(cols, rows, 0, 0)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Starts a daemon thread that reads SSH output and emits onData events.
   * When the stream ends or an error occurs the thread emits onClose / onError.
   */
  private fun startReading(inStream: InputStream, ch: ChannelShell) {
    readThread = Thread {
      val buf = ByteArray(8_192)
      try {
        while (!Thread.currentThread().isInterrupted) {
          val n = inStream.read(buf)
          if (n == -1) break
          // Emit data as ISO-8859-1 string to preserve raw bytes across the bridge
          val data = String(buf, 0, n, Charsets.ISO_8859_1)
          sendEvent("onData", mapOf("data" to data))
        }
      } catch (e: Exception) {
        if (!Thread.currentThread().isInterrupted) {
          sendEvent("onError", mapOf("message" to (e.message ?: "Read error")))
        }
      } finally {
        sendEvent("onClose", emptyMap<String, Any>())
      }
    }.also {
      it.isDaemon = true
      it.name = "expo-ssh-read"
      it.start()
    }
  }

  /** Closes channel, session, and interrupts the read thread. */
  private fun teardown() {
    readThread?.interrupt()
    readThread = null
    try { shellChannel?.disconnect() } catch (_: Exception) {}
    try { jschSession?.disconnect() } catch (_: Exception) {}
    shellChannel = null
    jschSession = null
    shellInput = null
    shellOutput = null
  }
}
