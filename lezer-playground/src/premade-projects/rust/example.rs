type LinkedList = Option<~Node>;

struct Node {
   val: int,
   tail: LinkedList
}

fn construct_list(n: int, x: int) -> LinkedList {
    match n {
        0 => { None }
        _ => { Some(~Node{val: x, tail: construct_list(n - 1, x + 1)}) }
    }
}

fn print_list(p: LinkedList) -> ~str {
    match p {
        None => { ~"" }
        Some(node) => { node.val.to_str() + ", " 
                        + print_list(node.tail) }
    }
}

trait Map {
   fn mapr(&mut self, fn(int) -> int);
}

impl Map for LinkedList {
    fn mapr(&mut self, f: fn(int) -> int) {
         match(*self) {
            None => { }
            Some(ref mut current) => { 
               let (port, chan) : (Port<int>, Chan<int>) = Chan::new();
               let val = current.val; // Can't capture current
               spawn(proc() { chan.send(f(val)); });
               current.tail.mapr(f); // why here?
               current.val = port.recv();
            }
        } 
    } 
}

fn expensive_inc(n: int) -> int { 
   let mut a = 1;
   println!("starting inc: {:d}", n);
   for _ in range(0, 10000) {
        for _ in range(0, 1000000) {
           a = a + 1;
        }
   }
   
   println!("finished inc: {:d} ({:d})", n, a);
   n + 1 
}

fn main() {
    let mut p : LinkedList = construct_list(5, 10);
    p.mapr(expensive_inc);
    println!("List: {:s}", print_list(p.clone()));
}