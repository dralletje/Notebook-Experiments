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

extern fn slice_doc_number(from: u32, to: u32) u32;

fn get_child_of_type(buffer: []Node, node_type: u16) ?u16 {
    var i: u16 = 1; // Skip to first child
    while (i < buffer.len) : (i += 1) {
        if (buffer[i].type == node_type) {
            return i;
        }
    }
    return null;
}

// Only useful to map from memory
const Node = extern struct {
    type: u16,
    text_start: u16,
    text_end: u16,
    bytes_end: u16,

    const empty = Node{ .type = 0, .text_start = 0, .text_end = 0, .bytes_end = 0 };

    fn end(self: Node) u16 {
        return self.bytes_end / 4;
    }
};

const MappedPosition = extern struct {
    text_from: u32,
    text_to: u32,

    parsed_from: u32,
    parsed_to: u32,

    const empty = MappedPosition{ .text_from = 0, .text_to = 0, .parsed_from = 0, .parsed_to = 0 };
};

// AAAAAAAAAAA
// Getting performance_now() is not very performant!!!
// HAHAHA SO IRONIC
extern fn performance_now() f64;
// fn performance_now() f64 {
//     return 0;
// }

var loop_time: f64 = 0;
var allocate_time: f64 = 0;
var times_memory_is_expanded: i32 = 0;
var shebababa: f64 = 0;
export fn reset_timing() void {
    console.log("Loop time: {d} ms", .{loop_time});
    console.log("Allocate time: {d} ms", .{allocate_time});
    console.log("Times memory is expanded: {d}", .{times_memory_is_expanded});
    console.log("Shebababa: {d} ms", .{shebababa});
    loop_time = 0;
    allocate_time = 0;
    times_memory_is_expanded = 0;
    shebababa = 0;
}

export fn meta_from_tree(
    treebuffer: [*:Node.empty]Node,
    treebuffer_length: u16,
    doc_offset: u16,
) usize {
    // console.time("meta_from_tree", .{});
    // defer console.timeEnd("meta_from_tree", .{});

    var start = performance_now();
    defer shebababa += performance_now() - start;
    return _meta_from_tree(treebuffer, treebuffer_length, doc_offset) catch |x| {
        console.log("Error: {}", .{x});
        return 0;
    };
}

var positions: []MappedPosition = &[0]MappedPosition{};

export fn test_performance_performance() void {
    // Just trying out
    var test_i: u16 = 0;
    const start_test_performance = performance_now();
    var total_x_stuff: f64 = 0;
    while (test_i < 10000) : (test_i += 1) {
        const first = performance_now();
        const last = performance_now();
        total_x_stuff += last - first;
    }
    const end_test_performance = performance_now();
    console.log("Test performance: {d} ms", .{end_test_performance - start_test_performance});
    console.log("total_x_stuff: {d} ms", .{total_x_stuff});
}

fn _meta_from_tree(treebuffer: [*:Node.empty]Node, treebuffer_length: u16, text_offset: u32) !usize {
    const start_allocate = performance_now();
    const max_amount_of_positions = treebuffer_length / 4;
    if (positions.len < max_amount_of_positions) {
        times_memory_is_expanded += 1;
        main_allocator.free(positions);
        positions = try main_allocator.alloc(MappedPosition, max_amount_of_positions);
    }
    var positions_index: usize = 0;
    allocate_time += performance_now() - start_allocate;

    // console.time("Actual thing", .{});
    const start = performance_now();
    {
        var i: u16 = 0;
        // while (!std.meta.eql(treebuffer[i], Node.empty)) : (i += 1) {
        while (i < treebuffer_length) : (i += 1) {
            const node: Node = treebuffer[i];
            // console.log("Node {}: {}", .{ i, node });

            // console.group("Type: {}", .{node.type});
            // errdefer console.groupEnd();

            if (node.type == 2) {
                const name_index = get_child_of_type(treebuffer[i..node.end()], 6) orelse get_child_of_type(treebuffer[i..node.end()], 5) orelse get_child_of_type(treebuffer[i..node.end()], 3) orelse {
                    continue;
                };
                const name_node = treebuffer[i + name_index];

                const _position_index = get_child_of_type(treebuffer[i..node.end()], 11) orelse continue;
                const position_index = i + _position_index;
                const position_end = treebuffer[position_index].end();

                const _from_index = get_child_of_type(treebuffer[position_index..position_end], 12) orelse continue;
                const from_index = position_index + _from_index;
                const from_node: Node = treebuffer[from_index];

                const _to_index = get_child_of_type(treebuffer[from_index..position_end], 12) orelse continue;
                const to_index = from_index + _to_index;
                const to_node = treebuffer[to_index];

                // Couldn't get this to work with the string from javascript directly,
                // a bunch of this was because the string contains multiple characters for advanced utf-8 characters,
                // putting all my character offsets in disarray!
                // On top of that, it seemed like the string was also getting too big to even give to webassembly?
                // Seems unlikely, but I couldn't be bothered.
                // Might get back here later to do it with string in memory, because that is a lot faster!
                const from_number = slice_doc_number(from_node.text_start + text_offset, from_node.text_end + text_offset);
                const to_number = slice_doc_number(to_node.text_start + text_offset, to_node.text_end + text_offset);

                // _ = from_node;
                // _ = to_node;
                // _ = text_offset;
                // _ = name_node;

                const position = MappedPosition{
                    .text_from = from_number,
                    .text_to = to_number,
                    .parsed_from = text_offset + name_node.text_start,
                    .parsed_to = text_offset + name_node.text_end,
                };

                positions[positions_index] = position;
                positions_index += 1;
            }
        }
    }
    loop_time += performance_now() - start;

    // console.timeEnd("Actual thing", .{});

    positions[positions_index] = MappedPosition.empty;

    return @ptrToInt(positions.ptr);
}
