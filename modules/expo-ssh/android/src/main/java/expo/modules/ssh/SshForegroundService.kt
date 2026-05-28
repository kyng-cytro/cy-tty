package expo.modules.ssh

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder

class SshForegroundService : Service() {

  companion object {
    private const val CHANNEL_ID = "cy_tty_ssh_sessions"
    private const val NOTIF_ID = 0x737368 // "ssh" in hex
  }

  override fun onCreate() {
    super.onCreate()
    createChannel()
    startForeground(NOTIF_ID, buildNotification())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
    START_STICKY

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannel() {
    val mgr = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val ch = NotificationChannel(
        CHANNEL_ID,
        "SSH Sessions",
        NotificationManager.IMPORTANCE_LOW,
      )
      ch.description = "Keeps SSH sessions alive in the background"
      ch.setShowBadge(false)
      mgr.createNotificationChannel(ch)
    }
  }

  private fun buildNotification(): Notification =
    Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_send)
      .setContentTitle("cy-tty")
      .setContentText("SSH session active")
      .setOngoing(true)
      .build()
}
