# JSch loads cipher, MAC, compression, and channel implementations via
# Class.forName() at runtime. Without these rules R8 strips them and
# the session fails after the initial handshake.
-keep class com.jcraft.jsch.** { *; }
