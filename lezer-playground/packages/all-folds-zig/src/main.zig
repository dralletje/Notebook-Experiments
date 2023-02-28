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

const Fold = extern struct {
    name_from: u32,
    name_to: u32,

    fold_from: u32,
    fold_to: u32,

    const empty = Fold{ .name_from = 0, .name_to = 0, .fold_from = 0, .fold_to = 0 };
};

export fn all_folds(
    treebuffer: [*:Node.empty]Node,
    treebuffer_length: u16,
    doc_offset: u16,
) usize {
    // console.time("meta_from_tree", .{});
    // defer console.timeEnd("meta_from_tree", .{});

    return _all_folds(treebuffer, treebuffer_length, doc_offset) catch |x| {
        console.log("Error: {}", .{x});
        return 0;
    };
}

var positions: []Fold = &[0]Fold{};

fn _all_folds(treebuffer: [*:Node.empty]Node, treebuffer_length: u16, text_offset: u32) !usize {
    const max_amount_of_positions = treebuffer_length / 4;
    if (positions.len < max_amount_of_positions) {
        main_allocator.free(positions);
        positions = try main_allocator.alloc(Fold, max_amount_of_positions);
    }
    var positions_index: usize = 0;

    // console.time("Actual thing", .{});
    {
        var i: u16 = 0;
        while (!std.meta.eql(treebuffer[i], Node.empty)) : (i += 1) {
            const node: Node = treebuffer[i];

            // if (tree.type.name === "Node") {
            //   let node = tree.topNode;
            //   let callee = node.firstChild;
            //   let arg_list = node.getChild("Arguments");

            //   if (callee == null || arg_list == null) return;

            //   ranges_from_wasm.push({
            //     name: [callee.from + offset, callee.to + offset],
            //     fold: [arg_list.from + 1 + offset, arg_list.to - 1 + offset],
            //   });
            // }

            // 2 is Node for now...
            // Need a way to give this to webassembly.. arguments? Ugh
            if (node.type == 2) {
                const name_node = treebuffer[i + 1];

                const _arguments_index = get_child_of_type(treebuffer[i..node.end()], 13) orelse continue;
                const arguments_index = i + _arguments_index;
                const arguments_node = treebuffer[arguments_index];

                const position = Fold{
                    .name_from = text_offset + name_node.text_start,
                    .name_to = text_offset + name_node.text_end,
                    .fold_from = text_offset + arguments_node.text_start + 1,
                    .fold_to = text_offset + arguments_node.text_end - 1,
                };

                positions[positions_index] = position;
                positions_index += 1;
            }
        }
    }

    // console.timeEnd("Actual thing", .{});

    positions[positions_index] = Fold.empty;

    return @ptrToInt(positions.ptr);
}
