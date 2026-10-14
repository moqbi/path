Pod::Spec.new do |s|
  s.name           = 'NearbyBeacon'
  s.version        = '1.0.0'
  s.summary        = 'Face-to-face discovery over Bluetooth LE for ATHAR Moments'
  s.description    = 'Advertises a short-lived server token and scans for others, foreground only.'
  s.author         = 'ATHAR'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreBluetooth'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
