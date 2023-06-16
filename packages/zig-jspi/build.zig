const std = @import("std");
const print = std.debug.print;
const Builder = @import("std").build.Builder;

pub fn build(b: *Builder) void {
    var target: std.zig.CrossTarget = .{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    };
    target.cpu_features_add.addFeature(@enumToInt(std.Target.wasm.Feature.reference_types));


  // const exe = b.addSharedLibrary(.{
  //     .name = "zig",
  //     .root_source_file = .{ .path = "src/main.zig" },
  //     .target = target,
  //     .optimize = .ReleaseSafe,
  // });

    const exe = b.addSharedLibrary("fresh", "src/main.zig", .unversioned);
    exe.setTarget(target);
    exe.setBuildMode(.ReleaseSafe);

    b.installArtifact(exe);
    // const compile_step = b.step("compile", "Compiles src/main.zig");
    // compile_step.dependOn(&exe.step);
}


// const std = @import("std");
// const print = std.debug.print;
// const Builder = @import("std").build.Builder;

// pub fn build(b: *Builder) void {
//       const target: std.zig.CrossTarget = .{
//         .cpu_arch = .wasm32,
//         .os_tag = .freestanding,
//     };
//     // target.cpu_features_add.addFeature(@enumToInt(std.Target.wasm.Feature.reference_types));

//     const exe = b.addExecutable(.{
//         .name = "zig",
//         .root_source_file = .{ .path = "src/main.zig" },
//         .target = target,
//         // .optimize = optimize,
//     });

//     // exe.setTarget(target);

//     // const mode = b.standardReleaseOptions();
//     // exe.setBuildMode(.ReleaseSafe);

//     b.installArtifact(exe);


//     // const compile_step = b.step("compile", "Compiles src/main.zig");
//     // compile_step.dependOn(&exe.step);
// }