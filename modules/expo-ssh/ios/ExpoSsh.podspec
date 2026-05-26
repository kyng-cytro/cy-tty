Pod::Spec.new do |s|
  s.name           = 'ExpoSsh'
  s.version        = '1.0.0'
  s.summary        = 'SSH transport native module for cy-tty'
  s.description    = 'Wraps NMSSH (libssh2) to provide an interactive SSH shell channel for React Native.'
  s.author         = ''
  s.homepage       = 'https://github.com/kyng-cytro/cy-tty'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # NMSSH: Objective-C libssh2 wrapper — battle-tested iOS SSH library
  s.dependency 'NMSSH', '~> 2.3'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
