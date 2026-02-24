#!/usr/bin/env ruby
# Script to add JstyleBridge files to the Xcode project
# Uses xcodeproj gem (installed with CocoaPods)

require 'xcodeproj'

project_path = 'ios/SmartRing.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.find { |t| t.name == 'SmartRing' }
unless target
  puts "ERROR: Could not find SmartRing target"
  exit 1
end

puts "Found target: #{target.name}"

# Create JstyleBridge group
main_group = project.main_group
jstyle_group = main_group.new_group('JstyleBridge', 'JstyleBridge')
puts "Created JstyleBridge group"

# Add source files
jstyle_dir = 'ios/JstyleBridge'

# Header files (add to project but not to compile sources)
headers = ['JstyleBridge.h', 'NewBle.h', 'BleSDK_X3.h', 'BleSDK_Header_X3.h', 'DeviceData_X3.h']
headers.each do |h|
  path = File.join('..', jstyle_dir, h)
  if File.exist?(File.join(jstyle_dir, h))
    ref = jstyle_group.new_file(h)
    puts "  Added header: #{h}"
  else
    puts "  WARNING: #{h} not found"
  end
end

# Source files (add to compile sources)
sources = ['JstyleBridge.m', 'NewBle.m']
sources.each do |s|
  if File.exist?(File.join(jstyle_dir, s))
    ref = jstyle_group.new_file(s)
    target.source_build_phase.add_file_reference(ref)
    puts "  Added source: #{s}"
  else
    puts "  WARNING: #{s} not found"
  end
end

# Add libBleSDK.a
lib_path = File.join(jstyle_dir, 'libBleSDK.a')
if File.exist?(lib_path)
  lib_ref = jstyle_group.new_file('libBleSDK.a')
  target.frameworks_build_phase.add_file_reference(lib_ref)
  puts "  Added library: libBleSDK.a"
end

# Add QCBandSDK.framework if it exists
fw_path = 'ios/Frameworks/QCBandSDK.framework'
if File.exist?(fw_path)
  fw_group = main_group['Frameworks'] || main_group.new_group('Frameworks', 'Frameworks')
  fw_ref = fw_group.new_file('QCBandSDK.framework')
  target.frameworks_build_phase.add_file_reference(fw_ref)

  # Add to Embed Frameworks phase
  embed_phase = target.build_phases.find { |p| p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && p.name == 'Embed Frameworks' }
  unless embed_phase
    embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
    embed_phase.name = 'Embed Frameworks'
    embed_phase.symbol_dst_subfolder_spec = :frameworks
    target.build_phases << embed_phase
  end
  embed_ref = embed_phase.add_file_reference(fw_ref)
  embed_ref.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
  puts "  Added framework: QCBandSDK.framework (Embed & Sign)"
end

# Update build settings
target.build_configurations.each do |config|
  settings = config.build_settings

  # Header search paths
  header_paths = settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
  header_paths = [header_paths] if header_paths.is_a?(String)
  new_path = '"$(SRCROOT)/JstyleBridge"'
  header_paths << new_path unless header_paths.include?(new_path)
  settings['HEADER_SEARCH_PATHS'] = header_paths

  # Framework search paths
  fw_paths = settings['FRAMEWORK_SEARCH_PATHS'] || ['$(inherited)']
  fw_paths = [fw_paths] if fw_paths.is_a?(String)
  new_fw_path = '"$(SRCROOT)/Frameworks"'
  fw_paths << new_fw_path unless fw_paths.include?(new_fw_path)
  settings['FRAMEWORK_SEARCH_PATHS'] = fw_paths

  # Library search paths
  lib_paths = settings['LIBRARY_SEARCH_PATHS'] || ['$(inherited)']
  lib_paths = [lib_paths] if lib_paths.is_a?(String)
  new_lib_path = '"$(SRCROOT)/JstyleBridge"'
  lib_paths << new_lib_path unless lib_paths.include?(new_lib_path)
  settings['LIBRARY_SEARCH_PATHS'] = lib_paths

  # Ensure ObjC linker flag (needed for static libraries)
  other_flags = settings['OTHER_LDFLAGS'] || ['$(inherited)']
  other_flags = [other_flags] if other_flags.is_a?(String)
  other_flags << '-ObjC' unless other_flags.include?('-ObjC')
  settings['OTHER_LDFLAGS'] = other_flags

  puts "  Updated build settings for: #{config.name}"
end

project.save
puts "\nDone! JstyleBridge added to Xcode project."
