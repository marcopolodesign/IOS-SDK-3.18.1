#!/usr/bin/env ruby

require 'xcodeproj'

project_path = 'ios/SmartRing.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.first

# Get the main group
main_group = project.main_group

# Find or create SmartRing group
smartring_group = main_group.groups.find { |g| g.name == 'SmartRing' } || main_group.new_group('SmartRing')

puts "Adding QCBandBridge files..."
# Add QCBandBridge group
qcband_group = smartring_group.new_group('QCBandBridge', 'QCBandBridge')
qcband_files = [
  'QCBandBridge.h',
  'QCBandBridge.m',
  'QCCentralManager.h',
  'QCCentralManager.m'
]

qcband_files.each do |filename|
  file_path = "QCBandBridge/#{filename}"
  file_ref = qcband_group.new_file(file_path)
  
  # Add .m files to compile sources
  if filename.end_with?('.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Compile Sources"
  else
    puts "  ✓ Added #{filename}"
  end
end

puts "\nAdding JstyleBridge files..."
# Add JstyleBridge group
jstyle_group = smartring_group.new_group('JstyleBridge', 'JstyleBridge')
jstyle_files = [
  'JstyleBridge.h',
  'JstyleBridge.m',
  'NewBle.h',
  'NewBle.m',
  'BleSDK_X3.h',
  'BleSDK_Header_X3.h',
  'DeviceData_X3.h',
  'libBleSDK.a'
]

jstyle_files.each do |filename|
  file_path = "JstyleBridge/#{filename}"
  file_ref = jstyle_group.new_file(file_path)
  
  # Add .m files to compile sources
  if filename.end_with?('.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Compile Sources"
  # Add .a files to link binary
  elsif filename.end_with?('.a')
    target.frameworks_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Link Binary With Libraries"
  else
    puts "  ✓ Added #{filename}"
  end
end

puts "\nAdding QCBandSDK.framework..."
# Add Frameworks group if it doesn't exist
frameworks_group = main_group.groups.find { |g| g.name == 'Frameworks' } || main_group.new_group('Frameworks')
framework_ref = frameworks_group.new_file('Frameworks/QCBandSDK.framework')
target.frameworks_build_phase.add_file_reference(framework_ref)
puts "  ✓ Added QCBandSDK.framework to Link Binary With Libraries"

# Set framework to Embed & Sign
embed_phase = target.build_phases.find { |phase| phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && phase.name == 'Embed Frameworks' }
unless embed_phase
  embed_phase = target.new_copy_files_build_phase('Embed Frameworks')
  embed_phase.dst_subfolder_spec = '10' # Frameworks
end
build_file = embed_phase.add_file_reference(framework_ref)
build_file.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
puts "  ✓ Set QCBandSDK.framework to Embed & Sign"

puts "\nConfiguring Build Settings..."
# Configure build settings
target.build_configurations.each do |config|
  # Header Search Paths
  header_paths = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
  header_paths = [header_paths] unless header_paths.is_a?(Array)
  header_paths += [
    '$(SRCROOT)/JstyleBridge',
    '$(SRCROOT)/QCBandBridge',
    '$(SRCROOT)/Frameworks'
  ]
  config.build_settings['HEADER_SEARCH_PATHS'] = header_paths.uniq
  
  # Framework Search Paths
  framework_paths = config.build_settings['FRAMEWORK_SEARCH_PATHS'] || ['$(inherited)']
  framework_paths = [framework_paths] unless framework_paths.is_a?(Array)
  framework_paths << '$(SRCROOT)/Frameworks'
  config.build_settings['FRAMEWORK_SEARCH_PATHS'] = framework_paths.uniq
  
  # Library Search Paths
  library_paths = config.build_settings['LIBRARY_SEARCH_PATHS'] || ['$(inherited)']
  library_paths = [library_paths] unless library_paths.is_a?(Array)
  library_paths << '$(SRCROOT)/JstyleBridge'
  config.build_settings['LIBRARY_SEARCH_PATHS'] = library_paths.uniq
  
  puts "  ✓ Configured #{config.name} build settings"
end

# Add CoreBluetooth.framework if not present
core_bluetooth = target.frameworks_build_phase.files.find { |f| f.file_ref.path == 'CoreBluetooth.framework' }
unless core_bluetooth
  cb_ref = project.frameworks_group.new_file('System/Library/Frameworks/CoreBluetooth.framework')
  cb_ref.source_tree = 'SDKROOT'
  target.frameworks_build_phase.add_file_reference(cb_ref)
  puts "\n✓ Added CoreBluetooth.framework"
end

# Save the project
project.save
puts "\n✅ Xcode project configuration complete!"
puts "\nNext steps:"
puts "1. Open Xcode: open ios/SmartRing.xcworkspace"
puts "2. Clean build folder (⌘⇧K)"
puts "3. Build project (⌘B)"
puts "4. Run on physical device (⌘R)"
