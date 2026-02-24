#!/usr/bin/env ruby

require 'xcodeproj'

project_path = 'ios/SmartRing.xcodeproj'
project = Xcodeproj::Project.open(project_path)

puts "Fixing file paths in Xcode project (v2)..."

# Get the main target
target = project.targets.first

# Remove all existing bridge files
puts "\nRemoving old file references..."
target.source_build_phase.files.to_a.each do |build_file|
  file_ref = build_file.file_ref
  next unless file_ref
  
  filename = file_ref.path
  if filename =~ /(QCBandBridge|QCCentralManager|JstyleBridge|NewBle)\.m$/
    puts "  Removing: #{filename}"
    build_file.remove_from_project
  end
end

target.frameworks_build_phase.files.to_a.each do |build_file|
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
smartring_groups = main_group.groups.select { |g| g.name == 'SmartRing' }

smartring_groups.each do |smartring_group|
  old_qcband = smartring_group.groups.find { |g| g.name == 'QCBandBridge' }
  old_jstyle = smartring_group.groups.find { |g| g.name == 'JstyleBridge' }
  
  old_qcband.remove_from_project if old_qcband
  old_jstyle.remove_from_project if old_jstyle
end

# Get the correct SmartRing group (the one that contains AppDelegate.swift)
smartring_group = smartring_groups.find { |g| 
  g.children.any? { |c| c.respond_to?(:path) && c.path == 'SmartRing/AppDelegate.swift' }
}

unless smartring_group
  smartring_group = smartring_groups.first
end

puts "\nAdding files with correct absolute paths..."

# Add QCBandBridge group
qcband_group = smartring_group.new_group('QCBandBridge')
qcband_files = [
  'QCBandBridge.h',
  'QCBandBridge.m',
  'QCCentralManager.h',
  'QCCentralManager.m'
]

qcband_files.each do |filename|
  # Use absolute path
  abs_path = File.expand_path("ios/QCBandBridge/#{filename}")
  file_ref = qcband_group.new_file(abs_path)
  file_ref.name = filename
  
  if filename.end_with?('.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "  ✓ Added #{filename} to Compile Sources"
  else
    puts "  ✓ Added #{filename}"
  end
end

# Add JstyleBridge group
jstyle_group = smartring_group.new_group('JstyleBridge')
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
  # Use absolute path
  abs_path = File.expand_path("ios/JstyleBridge/#{filename}")
  file_ref = jstyle_group.new_file(abs_path)
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
puts "\n✅ File paths fixed with absolute paths!"
puts "\nNext: Clean build folder in Xcode (⌘⇧K) and rebuild"
