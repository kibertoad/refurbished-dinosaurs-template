// Applies a declared-entries file (schema restoration-declared-entries-v1, docs/GHIDRA.md) to one
// Ghidra view. Arguments: the entries file and, optionally, the view name; items that name another
// view are skipped, and items that name none apply to every view.
//
// It first handles each `remove` item: removes the functions at its `starts`, clears the listing
// of its half-open `clear` range and, where it names an `owner` function, disassembles every flow
// target inside that range from the owner's instructions and recomputes the owner's body; a
// cleared range with no owner is decoded again only from the entries. A removal whose owner is
// itself a declared entry runs after the entries are created. Then, for each entry, it clears
// defined data at the entry, disassembles there and creates a function; a function whose body held
// the entry is recomputed so that it stops at the new one. Run it on a copy of a snapshot, without
// -readOnly, after CorrectNearTransfers.java and before ApplyDeclaredFlows.java. It prints
// addresses and counts only.
// @category Restoration

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import ghidra.app.cmd.function.CreateFunctionCmd;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.listing.Instruction;

public class ApplyDeclaredEntries extends GhidraScript {
    private void remove(SegmentedInputs.Removal removal) throws Exception {
        FunctionManager fm = currentProgram.getFunctionManager();
        Function owner = null;
        if (removal.owner() != null) {
            owner = fm.getFunctionAt(toAddr(removal.owner()));
            if (owner == null) {
                throw new IllegalStateException("No owner function " + removal.owner());
            }
        }
        Address low = toAddr(removal.clear().start());
        Address high = toAddr(removal.clear().end()).subtract(1);
        AddressSet clear = new AddressSet(low, high);
        for (String text : removal.starts()) {
            Address start = toAddr(text);
            if (fm.getFunctionAt(start) != null) {
                fm.removeFunction(start);
                println("REMOVED\t" + start);
            } else {
                println("ABSENT\t" + start);
            }
        }
        clearListing(clear);
        if (owner == null) {
            println("CLEARED\t" + clear);
            return;
        }
        Set<Address> tried = new HashSet<>();
        boolean added = true;
        while (added) {
            added = false;
            for (Instruction i : currentProgram.getListing().getInstructions(new AddressSet(owner.getEntryPoint(), high), true)) {
                List<Address> targets = new ArrayList<>(Arrays.asList(i.getFlows()));
                if (i.getFallThrough() != null) {
                    targets.add(i.getFallThrough());
                }
                for (Address t : targets) {
                    if (clear.contains(t) && getInstructionAt(t) == null && tried.add(t)) {
                        disassemble(t);
                        added = true;
                        println("DISASSEMBLED\t" + t);
                    }
                }
                if (added) {
                    break;
                }
            }
        }
        CreateFunctionCmd.fixupFunctionBody(currentProgram, owner, monitor);
        println("OWNER\t" + owner.getEntryPoint() + "\t" + owner.getBody().getNumAddresses());
    }

    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1 || args.length > 2) {
            throw new IllegalArgumentException("Supply the declared-entries file and, optionally, the view.");
        }
        String view = args.length == 2 ? args[1] : null;
        SegmentedInputs.DeclaredEntries declared = SegmentedInputs.readDeclaredEntries(Path.of(args[0]), view);
        FunctionManager fm = currentProgram.getFunctionManager();
        List<SegmentedInputs.Removal> deferred = new ArrayList<>();
        for (SegmentedInputs.Removal removal : declared.removals()) {
            if (removal.owner() != null && fm.getFunctionAt(toAddr(removal.owner())) == null) {
                deferred.add(removal);
                continue;
            }
            remove(removal);
        }
        int created = 0, existed = 0, failed = 0;
        for (String text : declared.entries()) {
            Address a = toAddr(text);
            if (fm.getFunctionAt(a) != null) {
                existed++;
                println("EXISTS\t" + a);
                continue;
            }
            if (getInstructionAt(a) == null) {
                Data d = getDataContaining(a);
                if (d != null && d.isDefined()) {
                    clearListing(d.getMinAddress(), d.getMaxAddress());
                }
                disassemble(a);
            }
            if (getInstructionAt(a) == null) {
                failed++;
                println("NOINSTRUCTION\t" + a);
                continue;
            }
            Function holder = fm.getFunctionContaining(a);
            if (holder != null) {
                holder.setBody(new AddressSet(holder.getEntryPoint(), holder.getEntryPoint()));
            }
            Function f = createFunction(a, null);
            if (holder != null) {
                CreateFunctionCmd.fixupFunctionBody(currentProgram, holder, monitor);
            }
            if (f == null) {
                failed++;
                println("NOFUNCTION\t" + a);
                continue;
            }
            created++;
            println("CREATED\t" + a + "\t" + f.getBody().getNumAddresses()
                + (holder != null ? "\tsplit " + holder.getEntryPoint() + " " + holder.getBody().getNumAddresses() : ""));
        }
        for (SegmentedInputs.Removal removal : deferred) {
            remove(removal);
        }
        println("ENTRIES_COMPLETE\tview=" + (view == null ? "" : view) + "\tcreated=" + created + "\texisted=" + existed
            + "\tfailed=" + failed + "\tremovals=" + declared.removals().size());
    }
}
