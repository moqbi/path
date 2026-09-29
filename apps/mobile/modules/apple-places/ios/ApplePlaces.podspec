Pod::Spec.new do |s|
  s.name           = 'ApplePlaces'
  s.version        = '1.0.0'
  s.summary        = 'Nearby places from Apple Maps for ATHAR Moments'
  s.description    = 'MKLocalPointsOfInterestRequest and MKLocalSearch, exposed to JavaScript.'
  s.author         = 'ATHAR'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'CoreLocation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
