Pod::Spec.new do |s|
  s.name           = 'ExpoTerminalKeyboard'
  s.version        = '1.0.0'
  s.summary        = 'Native buffer-free keyboard input view for cy-tty terminal'
  s.author         = ''
  s.homepage       = 'https://github.com/kyng-cytro/cy-tty'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
