#!/usr/bin/env ruby
require 'xcodeproj'

project_path = 'ios/SmartRing.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'SmartRing' }

# Remove QCBandSDK.framework references (no native bridge exists for it)
# This prevents the "No such file or directory" error
project.files.select { |f| f.path&.include?('QCBandSDK') }.each do |ref|
  puts "Removing file reference: #{ref.path}"
  # Remove from build phases
  target.frameworks_build_phase.files.select { |bf| bf.file_ref == ref }.each { |bf| bf.remove_from_project }
  # Remove from embed phases
  target.build_phases.each do |phase|
    next unless phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
    phase.files.select { |bf| bf.file_ref == ref }.each { |bf| bf.remove_from_project }
  end
  ref.remove_from_project
end

# Also remove the empty Frameworks group if it exists and is empty
fw_group = project.main_group['Frameworks']
if fw_group && fw_group.children.empty?
  fw_group.remove_from_project
  puts "Removed empty Frameworks group"
end

project.save
puts "Done - removed QCBandSDK references"
