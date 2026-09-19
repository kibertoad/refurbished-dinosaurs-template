// Dumps a bounded NE16 word-indexed jump table and the target address of each entry.
// @category Restoration

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;

public class ReportJumpTable extends GhidraScript {
    private static final int MAX_ENTRIES = 128;

    @Override
    protected void run() throws Exception {
        String[] arguments = getScriptArgs();
        if (arguments.length < 2) {
            printerr("Supply a jump-table address and entry count, for example 1010:7052 16.");
            return;
        }

        Address tableAddress = toAddr(arguments[0]);
        int entryCount = Integer.decode(arguments[1]);
        if (entryCount < 1 || entryCount > MAX_ENTRIES) {
            printerr("Entry count must be between 1 and " + MAX_ENTRIES + ".");
            return;
        }

        Address dispatchAddress = arguments.length >= 3
            ? toAddr(arguments[2])
            : findDispatchBefore(tableAddress);
        if (dispatchAddress == null) {
            printerr("Could not locate the indexed JMP before the table; pass the dispatch address as a third argument.");
            return;
        }

        println("===== jump table " + tableAddress + " (" + entryCount + " entries) =====");
        println("dispatch: " + dispatchAddress);
        for (int index = 0; index < entryCount; index++) {
            int word = readUInt16(tableAddress.add(index * 2));
            Address target = dispatchAddress.add(word);
            println(String.format(
                "[%02d] word=0x%04x target=%s",
                index,
                word & 0xffff,
                target));
        }
    }

    private Address findDispatchBefore(Address tableAddress) {
        Address cursor = tableAddress;
        for (var step = 0; step < 32; step++) {
            cursor = cursor.subtract(1);
            Instruction instruction = getInstructionAt(cursor);
            if (instruction == null)
                continue;
            if (!"JMP".equalsIgnoreCase(instruction.getMnemonicString()))
                continue;
            if (instruction.toString().contains("["))
                return instruction.getAddress();
        }

        return null;
    }

    private int readUInt16(Address address) throws Exception {
        byte[] bytes = new byte[2];
        currentProgram.getMemory().getBytes(address, bytes);
        return (bytes[0] & 0xff) | ((bytes[1] & 0xff) << 8);
    }
}
