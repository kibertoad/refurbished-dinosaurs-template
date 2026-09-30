// Reports a bounded selection of memory blocks; never bytes or instructions.
// @category CleanRoom
import ghidra.app.script.GhidraScript;
import ghidra.program.model.mem.MemoryBlock;

public class ReportMemoryBlocks extends GhidraScript {
    private static final int MAX_BLOCKS = 512;
    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        MemoryBlock[] blocks = currentProgram.getMemory().getBlocks();
        int start = 0, count = blocks.length;
        String scope = "whole map";
        if (args.length == 3 && args[0].equals("page")) {
            try { start = Integer.parseInt(args[1]); count = Integer.parseInt(args[2]); }
            catch (NumberFormatException e) { printerr("Page start/count must be integers."); return; }
            if (start < 0 || start > blocks.length || count < 1 || count > MAX_BLOCKS) {
                printerr("Page start must be within 0..total; count within 1..512."); return;
            }
            count = Math.min(count, blocks.length - start);
            scope = "page; indices follow the current program's block order";
        } else if (args.length == 2 && args[0].equals("name")) {
            start = -1;
            for (int i = 0; i < blocks.length; i++) {
                if (!blocks[i].getName().equals(args[1])) continue;
                if (start >= 0) { printerr("Ambiguous block name; select a page instead."); return; }
                start = i;
            }
            if (start < 0) { printerr("No block with that exact name."); return; }
            count = 1; scope = "exact block name";
        } else if (args.length != 0) {
            printerr("Usage: ReportMemoryBlocks.java [page <start-index> <count> | name <exact-name>]"); return;
        }
        if (count > MAX_BLOCKS) {
            printerr("Program has " + blocks.length + " blocks; maximum is 512. Select page or name."); return;
        }
        println("total=" + blocks.length + " start=" + start + " emitted=" + count +
            " partial=" + (count != blocks.length) + " scope=" + scope);
        for (int i = start; i < start + count; i++) {
            MemoryBlock b = blocks[i];
            println(i + " " + b.getName() + " " + b.getStart() + "-" + b.getEnd() + " size=" + b.getSize());
        }
    }
}
