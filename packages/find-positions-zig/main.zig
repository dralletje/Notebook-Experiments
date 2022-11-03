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

const Node = extern struct {
    type: u16,
    text_start: u16,
    text_end: u16,
    _end: u16,

    const empty = Node{ .type = 0, .text_start = 0, .text_end = 0, ._end = 0 };

    fn end(self: Node) u16 {
        return self._end / 4;
    }

    // fn children(self: Node, index: u16) []Node {
    //     return @intToPtr([*]Node, @ptrToInt(&self) + 8)[0..self.end() - 1 - index];
    // }
};

const MappedPosition = extern struct {
    text_from: u32,
    text_to: u32,

    parsed_from: u32,
    parsed_to: u32,

    const empty = MappedPosition{ .text_from = 0, .text_to = 0, .parsed_from = 0, .parsed_to = 0 };
};

export fn meta_from_tree(
    treebuffer: [*:Node.empty]Node,
    treebuffer_length: u16,
    doc_offset: u16,
) usize {
    // console.time("Hahaa", .{});
    // defer console.timeEnd("Hahaa", .{});

    return _meta_from_tree(treebuffer, treebuffer_length, doc_offset) catch |x| {
        console.log("Error: {}", .{x});
        return 0;
    };
}

var positions: []MappedPosition = &[0]MappedPosition{};

fn _meta_from_tree(treebuffer: [*:Node.empty]Node, treebuffer_length: u16, text_offset: u32) !usize {
    const max_amount_of_positions = treebuffer_length / 4;
    if (positions.len < max_amount_of_positions) {
        main_allocator.free(positions);
        positions = try main_allocator.alloc(MappedPosition, max_amount_of_positions);
    }
    var positions_index: usize = 0;

    // console.time("Actual thing", .{});
    {
        var i: u16 = 0;
        while (!std.meta.eql(treebuffer[i], Node.empty)) : (i += 1) {
            const node: Node = treebuffer[i];
            // console.log("Node {}: {}", .{ i, node });

            // console.group("Type: {}", .{node.type});
            // errdefer console.groupEnd();

            if (node.type == 2) {
                const name_index = get_child_of_type(treebuffer[i..node.end()], 6) orelse get_child_of_type(treebuffer[i..node.end()], 5) orelse {
                    continue;
                };
                const name_node = treebuffer[i + name_index];

                if (get_child_of_type(treebuffer[i..node.end()], 11)) |_position_index| {
                    const position_index = i + _position_index;
                    const position_end = treebuffer[position_index].end();

                    if (get_child_of_type(treebuffer[position_index..position_end], 12)) |_from_index| {
                        const from_index = position_index + _from_index;
                        if (get_child_of_type(treebuffer[from_index..position_end], 12)) |_to_index| {
                            const to_index = from_index + _to_index;

                            // _ = to_index;
                            // _ = text_offset;

                            const from_node: Node = treebuffer[from_index];
                            // _ = from_node;
                            // const from_text = try doc_browser.read(from_node.text_start + text_offset, from_node.text_end + text_offset);
                            // const from_text = as_slice[from_node.text_start + text_offset .. from_node.text_end + text_offset];
                            // const from_number = try std.fmt.parseInt(u16, from_text, 10);
                            const from_number = slice_doc_number(from_node.text_start + text_offset, from_node.text_end + text_offset);

                            const to_node = treebuffer[to_index];
                            // _ = to_node;
                            // const to_text = try doc_browser.read(to_node.text_start + text_offset, to_node.text_end + text_offset);
                            // const to_text = as_slice[to_node.text_start + text_offset .. to_node.text_end + text_offset];
                            // const to_number = try std.fmt.parseInt(u16, to_text, 10);
                            const to_number = slice_doc_number(to_node.text_start + text_offset, to_node.text_end + text_offset);

                            const position = MappedPosition{
                                .text_from = from_number,
                                .text_to = to_number,
                                .parsed_from = text_offset + name_node.text_start,
                                .parsed_to = text_offset + name_node.text_end,
                            };

                            // try positions.append(positions);
                            positions[positions_index] = position;
                            positions_index += 1;
                        }
                    }
                }
            }

            // const has_children = node.end() / 4 != i + 1;
            // if (!has_children) {
            //     console.groupEnd();
            // } else {
            //     try list.append(node.end());
            // }
            // while (list.items.len > 0 and list.items[list.items.len - 1] == i + 1) {
            //     _ = list.pop();
            //     console.groupEnd();
            // }
        }
    }

    // var output_stuff = output_slice[0..output_index];
    // console.log("output_stuff: {any}", .{output_stuff});

    // console.timeEnd("Actual thing", .{});

    // try positions.append(MappedPosition.empty);
    positions[positions_index] = MappedPosition.empty;

    // return 0;
    return @ptrToInt(positions.ptr);
}
