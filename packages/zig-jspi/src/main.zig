const std = @import("std");
const print = std.debug.print;

const String = extern struct {
    length: usize,
    start: usize,

    pub fn from(message: []const u8) String {
        return String{
            .start = @ptrToInt(message.ptr),
            .length = message.len,
        };
    }

    const empty = String{ .length = 0, .start = 0 };
};

const do_logging = true;

const console = if (do_logging)
    struct {
        pub fn log(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleLog(string);
        }

        pub fn group(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleGroup(string);
        }

        pub fn groupEnd() void {
            consoleGroupEnd();
        }

        pub fn time(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleTime(string);
        }

        pub fn timeEnd(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleTimeEnd(string);
        }
    }
else
    struct {
        pub fn log(comptime fmt: []const u8, args: anytype) void {
            _ = fmt;
            _ = args;
        }
        pub fn group(comptime fmt: []const u8, args: anytype) void {
            _ = fmt;
            _ = args;
        }
        pub fn groupEnd() void {}

        pub fn time(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleTime(string);
        }

        pub fn timeEnd(comptime fmt: []const u8, args: anytype) void {
            var buf = std.fmt.allocPrint(main_allocator, fmt, args) catch return;
            defer main_allocator.free(buf);
            const string = String.from(buf);
            consoleTimeEnd(string);
        }
    };

pub const main_allocator = std.heap.page_allocator;

extern fn consoleLog(message: String) void;
extern fn consoleGroup(message: String) void;
extern fn consoleGroupEnd() void;
extern fn consoleTime(message: String) void;
extern fn consoleTimeEnd(message: String) void;

extern fn get_a_number() i32;

fn get_a_number_better() i32 {
    return get_a_number();
}


comptime {
    asm (
        \\refs:
        \\    .globl refs
        \\    .tabletype refs, externref, 2
    );
}

comptime {
    asm (
        \\result i32
        \\param x i32
        \\type x
        \\export "jspi"
    );
}

const ExternRef = *anyopaque;

const document = struct {
    pub fn createElement(name: []const u8) i32 {
        _ = name;
        const ref = &"10";
        asm volatile (
            \\local.get %[ref]
            \\local.get %[ref]
            \\table.get refs
            \\call __createElement
            \\table.set refs
            :
            : [ref] "r" (ref),
        );
        return 10;
    }
};



export fn jspi(any: *anyopaque) i32 {
    _ = any;
    // console.time("meta_from_tree", .{});
    // defer console.timeEnd("meta_from_tree", .{});

    // console.log("Hello, {}", .{ any });
    const ref = "10";
    _ = ref;

    // asm volatile (
    //     \\call __createElement
    //     :
    //     :
    // );

    _ = document.createElement("hi");

    // asm volatile (
    //     \\externref
    //     :
    //     :
    // );

    return get_a_number_better();
}

