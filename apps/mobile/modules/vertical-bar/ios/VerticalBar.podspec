Pod::Spec.new do |s|
  s.name           = 'VerticalBar'
  s.version        = '1.0.0'
  s.summary        = 'Where the system tab bar sits on iPhone Duo for ATHAR Moments'
  s.description    = 'Reads whether UITabBarController moved its bar to the vertical bar region (iOS 27.1).'
  s.author         = 'ATHAR'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
