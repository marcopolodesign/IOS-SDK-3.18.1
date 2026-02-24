#!/usr/bin/env ruby

require 'xcodeproj'

project_path = 'ios/SmartRing.xcodeproj'
project = Xcodeproj::Project.open(project_path)

puts "Fixing file paths in Xcode project..."

# Get the main target
target = project.targets.first

# Remove all existing bridge files from compile sources
puts "\nRemoving old file references..."
target.source_build_phase.files.each do |build_file|
  file_ref = build_file.file_ref
  next unless file_ref
  
  filename = file_ref.path
  if filename =~ /(QCBandBridge|QCCentralManager|JstyleBridge|NewBle)\.m$/
    puts "  Removing: #{filename}"
    build_file.remove_from_project
  end
end

# Remove from frameworks phase
target.frameworks_build_phase.files.each do |build_file|
  file_ref = build_file.file_ref
  next unless file_ref
  
  filename = file_ref.path
  if filename =~ /libBleSDK\.a$/
    puts "  Removing: #{filename}"
    build_file.remove_from_project
  end
end

# Find and remove old groups
main_group = project.main_group
smartring_group = main_group.groups.find { |g| g.name == 'SmartRing' }

if smartring_group
  old_qcband = smartring_group.groups.find { |g| g.name == 'QCBandBridge' }
  old_jstyle = smartring_group.groups.find { |g| g.name == 'JstyleBridge' }
  
  old_qcband.remove_from_project if old_qcband
  old_jstyle.remove_from_project if old_jstyle
end

puts "\nAdding files with correct paths..."

# Add QCBandBridge group with correct paths
qcband_group = smartring_group.new_group('QCBandBridge')
qcband_files = {
  'QCBandBridge.h' => '../QCBandBridge/QCBandBridge.h',
  'QCBandBridge.m' => '../QCBandBridge/QCBandBridge.m',
  'QCCentralManager.h' => '../QCBandBridge/QCCentralManager.h',
  'QCCentralManager.m' => '../QCBandBridge/QCCentralManager.m'
}

qcband_files.each do |filename, path|
  file_ref = qcband_group.new_reference(path)
  file_ref.name = filename
  
  if filename.end_with?('.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Compile Sources"
  else
    puts "  ✓ Added #{filename}"
  end
end

# Add JstyleBridge group with correct paths
jstyle_group = smartring_group.new_group('JstyleBridge')
jstyle_files = {
  'JstyleBridge.h' => '../JstyleBridge/JstyleBridge.h',
  'JstyleBridge.m' => '../JstyleBridge/JstyleBridge.m',
  'NewBle.h' => '../JstyleBridge/NewBle.h',
  'NewBle.m' => '../JstyleBridge/NewBle.m',
  'BleSDK_X3.h' => '../JstyleBridge/BleSDK_X3.h',
  'BleSDK_Header_X3.h' => '../JstyleBridge/BleSDK_Header_X3.h',
  'DeviceData_X3.h' => '../JstyleBridge/DeviceData_X3.h',
  'libBleSDK.a' => '../JstyleBridge/libBleSDK.a'
}

jstyle_files.each do |filename, path|
  file_ref = jstyle_group.new_reference(path)
  file_ref.name = filename
  
  if filename.end_with?('.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Compile Sources"
  elsif filename.end_with?('.a')
    target.frameworks_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Link Binary With Libraries"
  else
    puts "  ✓ Added #{filename}"
  end
end

# Save the project
project.save
puts "\n✅ File paths fixed!"
puts "\nNext: Clean build folder in Xcode (⌘⇧K) and rebuild"
