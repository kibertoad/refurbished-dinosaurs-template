// Corrects the targets Ghidra 12.1.3 gives near relative transfers in 16-bit segmented code whose
// segment spans a linear 64K boundary. A near call, jump, conditional jump, loop or jcxz adds its
// signed displacement to IP and keeps CS, so its target is CS:((IP after it + displacement) &
// FFFF). Ghidra adds the displacement to the instruction's linear address and wraps the sum at that
// address's 64K linear page instead, which moves the target 64K up or down wherever the instruction
// and its target lie on two sides of a linear 0x?0000 boundary inside one segment.
//
// CS comes from the project's segment map (SegmentedInputs.java, docs/GHIDRA.md): the segment
// whose span holds the instruction's linear address in the default address space. An instruction
// outside every span, or in another address space such as an overlay block, takes the segment its
// memory block starts at, and the summary counts those as block_cs.
//
// Arguments: report or apply, the segment map (.json or .tsv) and, optionally, a declared-entries
// file and the view whose entries apply. A declared entry is never removed as a false function.
//
// Both modes print one WRONG line per transfer whose flows lack the CS target, with Ghidra's flows
// and the CS target, and one OUTSIDE line per computed-jump reference from a near indirect jump
// (FF /4) to an address outside CS:0000..CS:FFFF. Then they print FALSEFUNC for each function at a
// wrong target, with the number of references to it from other instructions, and NEWCALLEE for
// each CS call target with no function.
//
// apply also: removes the wrong flow references and the OUTSIDE references; adds the CS target
// with the transfer's reference type; clears code units no function body holds where the target
// has no instruction and disassembles it; removes a call's end-of-flow override when the CS callee
// is not marked no-return and disassembles its fall-through; creates a function at each CS call
// target that has an instruction and no function; removes each function at a wrong target that no
// other reference names and that is no declared entry (printed as KEPT otherwise), clears the code
// units of its body that no other function holds, and disassembles again each cleared address, or
// address just before cleared bytes, that a remaining instruction flows or falls into; and
// recomputes the body of each function that holds a corrected transfer, an OUTSIDE site or such a
// flow, or that ends where a wrong target began. Last, it disassembles each fall-through or flow
// target of an instruction in a function body that lies on undefined bytes and recomputes that
// body, until none is left. Run apply on a copy of a snapshot, without -readOnly; run it again
// after ApplyDeclaredFlows.java, whose decoding gives the transfers it decodes Ghidra's targets
// again. It prints addresses and counts only.
// @category Restoration

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import ghidra.app.cmd.function.CreateFunctionCmd;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressOutOfBoundsException;
import ghidra.program.model.address.AddressRange;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.address.AddressSetView;
import ghidra.program.model.address.AddressSpace;
import ghidra.program.model.address.SegmentedAddress;
import ghidra.program.model.address.SegmentedAddressSpace;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.FlowOverride;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.RefType;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.SourceType;

public class CorrectNearTransfers extends GhidraScript {
    private SegmentedInputs.SegmentMap map;
    private AddressSpace defaultSpace;
    private int blockCs = 0;

    private int cs(SegmentedAddress at) {
        if (at.getAddressSpace().equals(defaultSpace)) {
            int segment = map.segmentAt(at.getOffset());
            if (segment >= 0) {
                return segment;
            }
        }
        MemoryBlock block = currentProgram.getMemory().getBlock(at);
        if (block == null || !(block.getStart() instanceof SegmentedAddress start)) {
            throw new IllegalStateException("No segmented memory block holds " + at);
        }
        blockCs++;
        return start.getSegment();
    }

    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 2 || args.length > 4 || !Set.of("report", "apply").contains(args[0])) {
            throw new IllegalArgumentException(
                "Supply report or apply, the segment map and, optionally, a declared-entries file and its view.");
        }
        boolean apply = args[0].equals("apply");
        defaultSpace = currentProgram.getAddressFactory().getDefaultAddressSpace();
        if (!(defaultSpace instanceof SegmentedAddressSpace)) {
            throw new IllegalStateException("The program is not in a segmented address space.");
        }
        map = SegmentedInputs.readSegmentMap(Path.of(args[1]));
        println("SPANS\t" + map.spans().size());
        Set<Address> entries = new HashSet<>();
        if (args.length >= 3) {
            for (String entry : SegmentedInputs.readDeclaredEntries(Path.of(args[2]), args.length == 4 ? args[3] : null).entries()) {
                entries.add(toAddr(entry));
            }
            println("DECLARED_ENTRIES\t" + entries.size());
        }
        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();
        Memory mem = currentProgram.getMemory();
        int scanned = 0, wrong = 0;
        List<Object[]> fixes = new ArrayList<>();
        Map<Address, Integer> wrongTargets = new TreeMap<>();
        for (Instruction i : currentProgram.getListing().getInstructions(true)) {
            monitor.checkCancelled();
            if (!(i.getAddress() instanceof SegmentedAddress at)) {
                continue;
            }
            SegmentedInputs.NearTransfer near = SegmentedInputs.nearTransfer(i.getBytes());
            if (near == null) {
                continue;
            }
            scanned++;
            int cs = cs(at);
            int ip = SegmentedInputs.nearTargetOffset(cs, at.getOffset(), i.getLength(), near.displacement());
            Address right = ((SegmentedAddressSpace) at.getAddressSpace()).getAddress(cs, ip);
            Address[] flows = i.getFlows();
            if (Arrays.asList(flows).contains(right)) {
                continue;
            }
            wrong++;
            StringBuilder line = new StringBuilder("WRONG\t" + at + "\t" + i.getMnemonicString() + "\tcs=" + right + "\tghidra=");
            for (Address f : flows) {
                line.append(f).append(' ');
                wrongTargets.merge(f, 1, Integer::sum);
            }
            println(line.toString().trim());
            RefType type = switch (near.kind()) {
                case CALL -> RefType.UNCONDITIONAL_CALL;
                case JUMP -> RefType.UNCONDITIONAL_JUMP;
                case CONDITIONAL -> RefType.CONDITIONAL_JUMP;
            };
            fixes.add(new Object[] {i, right, type});
        }
        // A near indirect jump (FF /4) keeps CS, so a computed-jump reference from it to an address
        // outside CS:0000..CS:FFFF is wrong.
        Set<Address> wrongSites = new HashSet<>();
        for (Object[] x : fixes) {
            wrongSites.add(((Instruction) x[0]).getAddress());
        }
        List<Reference> outside = new ArrayList<>();
        for (Instruction i : currentProgram.getListing().getInstructions(true)) {
            monitor.checkCancelled();
            if (!(i.getAddress() instanceof SegmentedAddress at) || !SegmentedInputs.isNearIndirectJump(i.getBytes())) {
                continue;
            }
            long base = (long) cs(at) * 16;
            for (Reference r : i.getReferencesFrom()) {
                if (!r.getReferenceType().isComputed() || !r.getReferenceType().isJump()) {
                    continue;
                }
                Address to = r.getToAddress();
                if (to.getAddressSpace().equals(at.getAddressSpace()) && to.getOffset() >= base && to.getOffset() < base + 0x10000) {
                    continue;
                }
                outside.add(r);
                wrongSites.add(at);
                wrongTargets.merge(to, 1, Integer::sum);
                println("OUTSIDE\t" + at + "\t" + to);
            }
        }
        for (Map.Entry<Address, Integer> e : wrongTargets.entrySet()) {
            Function f = fm.getFunctionAt(e.getKey());
            if (f == null) {
                continue;
            }
            int others = 0;
            for (Reference r : rm.getReferencesTo(e.getKey())) {
                if (!wrongSites.contains(r.getFromAddress())) {
                    others++;
                }
            }
            println("FALSEFUNC\t" + e.getKey() + "\twrong=" + e.getValue() + "\tother_refs=" + others + "\tbody=" + f.getBody().getNumAddresses());
        }
        Set<Address> newCallees = new TreeSet<>();
        for (Object[] x : fixes) {
            if (((RefType) x[2]).isCall() && fm.getFunctionAt((Address) x[1]) == null) {
                newCallees.add((Address) x[1]);
            }
        }
        for (Address a : newCallees) {
            println("NEWCALLEE\t" + a + "\tinstruction=" + (getInstructionAt(a) != null));
        }
        int created = 0, cleared = 0, held = 0, removedFalse = 0, redecoded = 0, filled = 0;
        if (apply) {
            Set<Address> fix = new TreeSet<>();
            for (Object[] x : fixes) {
                Instruction i = (Instruction) x[0];
                Address right = (Address) x[1];
                RefType type = (RefType) x[2];
                for (Reference r : i.getReferencesFrom()) {
                    if (r.getReferenceType().isFlow()) {
                        rm.delete(r);
                    }
                }
                rm.addMemoryReference(i.getAddress(), right, type, SourceType.USER_DEFINED, 0);
                if (getInstructionAt(right) == null) {
                    CodeUnit u = currentProgram.getListing().getCodeUnitContaining(right);
                    if (u != null && !(u instanceof Data d && !d.isDefined())) {
                        if (fm.getFunctionContaining(u.getMinAddress()) != null) {
                            held++;
                            println("HELD\t" + right + "\t" + u.getMinAddress());
                        } else {
                            clearListing(u.getMinAddress(), u.getMaxAddress());
                            cleared++;
                        }
                    }
                    disassemble(right);
                }
                if (type.isCall() && i.getFlowOverride() == FlowOverride.CALL_RETURN) {
                    Function callee = fm.getFunctionAt(right);
                    if (callee == null || !callee.hasNoReturn()) {
                        i.setFlowOverride(FlowOverride.NONE);
                        Address next = i.getMaxAddress().add(1);
                        if (getInstructionAt(next) == null) {
                            disassemble(next);
                        }
                    }
                }
                Function holder = fm.getFunctionContaining(i.getAddress());
                if (holder != null) {
                    fix.add(holder.getEntryPoint());
                }
            }
            // A body that ends where a wrong target began (Ghidra stops a body at a call target) is
            // recomputed too.
            for (Address t : wrongTargets.keySet()) {
                Instruction before;
                try {
                    before = getInstructionContaining(t.subtract(1));
                } catch (AddressOutOfBoundsException x) {
                    continue;
                }
                Function holder = before != null ? fm.getFunctionContaining(before.getAddress()) : null;
                if (holder != null) {
                    fix.add(holder.getEntryPoint());
                }
            }
            for (Reference r : outside) {
                rm.delete(r);
                Function holder = fm.getFunctionContaining(r.getFromAddress());
                if (holder != null) {
                    fix.add(holder.getEntryPoint());
                }
            }
            for (Address a : newCallees) {
                if (getInstructionAt(a) == null || fm.getFunctionAt(a) != null) {
                    continue;
                }
                Function holder = fm.getFunctionContaining(a);
                if (holder != null) {
                    holder.setBody(new AddressSet(holder.getEntryPoint(), holder.getEntryPoint()));
                }
                Function f = createFunction(a, null);
                if (holder != null) {
                    CreateFunctionCmd.fixupFunctionBody(currentProgram, holder, monitor);
                    fix.add(holder.getEntryPoint());
                }
                if (f != null) {
                    created++;
                    println("CREATED\t" + a + "\t" + f.getBody().getNumAddresses());
                }
            }
            // A function at a wrong target that nothing else references was made from the wrong
            // transfer alone: remove it, clear the code units of its body that no other function
            // holds, and decode again only what flows from the remaining code reach.
            AddressSet clearedBodies = new AddressSet();
            for (Address target : wrongTargets.keySet()) {
                Function f = fm.getFunctionAt(target);
                if (f == null) {
                    continue;
                }
                boolean others = false;
                for (Reference r : rm.getReferencesTo(target)) {
                    if (!wrongSites.contains(r.getFromAddress())) {
                        others = true;
                    }
                }
                if (others) {
                    continue;
                }
                if (entries.contains(target)) {
                    println("KEPT\t" + target);
                    continue;
                }
                AddressSetView body = f.getBody();
                fm.removeFunction(target);
                removedFalse++;
                println("REMOVED\t" + target + "\t" + body.getNumAddresses());
                for (AddressRange r : body) {
                    for (CodeUnit u : currentProgram.getListing().getCodeUnits(new AddressSet(r), true)) {
                        if (fm.getFunctionContaining(u.getMinAddress()) != null) {
                            continue;
                        }
                        clearListing(u.getMinAddress(), u.getMaxAddress());
                        clearedBodies.add(u.getMinAddress(), u.getMaxAddress());
                    }
                }
            }
            // One pass suffices: the disassembler follows flows inside the cleared bytes from each
            // address it starts at, and a target it could not decode is not tried again.
            Set<Address> tried = new HashSet<>();
            if (!clearedBodies.isEmpty()) {
                List<Address[]> into = new ArrayList<>();
                for (Instruction i : currentProgram.getListing().getInstructions(true)) {
                    List<Address> targets = new ArrayList<>(Arrays.asList(i.getFlows()));
                    if (i.getFallThrough() != null) {
                        targets.add(i.getFallThrough());
                    }
                    // A target just before the cleared bytes failed to decode while they held code.
                    for (Address t : targets) {
                        if (clearedBodies.contains(t) || getInstructionAt(t) == null && clearedBodies.intersects(t, t.add(15))) {
                            into.add(new Address[] {i.getAddress(), t});
                        }
                    }
                }
                for (Address[] x : into) {
                    if (getInstructionAt(x[1]) != null || !tried.add(x[1])) {
                        continue;
                    }
                    disassemble(x[1]);
                    redecoded++;
                    Function holder = fm.getFunctionContaining(x[0]);
                    if (holder != null) {
                        fix.add(holder.getEntryPoint());
                    }
                }
            }
            for (int pass = 0; pass < 3; pass++) {
                for (Address a : fix) {
                    Function f = fm.getFunctionAt(a);
                    if (f != null) {
                        CreateFunctionCmd.fixupFunctionBody(currentProgram, f, monitor);
                    }
                }
            }
            // Then each fall-through or flow target of an instruction in a function body that lies
            // on undefined bytes is disassembled and the body recomputed, until none is left.
            for (int pass = 0; pass < 8; pass++) {
                Map<Address, Address> open = new TreeMap<>();
                for (Instruction i : currentProgram.getListing().getInstructions(true)) {
                    Function holder = fm.getFunctionContaining(i.getAddress());
                    if (holder == null) {
                        continue;
                    }
                    List<Address> targets = new ArrayList<>(Arrays.asList(i.getFlows()));
                    if (i.getFallThrough() != null) {
                        targets.add(i.getFallThrough());
                    }
                    for (Address t : targets) {
                        if (!mem.contains(t) || getInstructionAt(t) != null || tried.contains(t)) {
                            continue;
                        }
                        CodeUnit u = currentProgram.getListing().getCodeUnitAt(t);
                        if (u instanceof Data d && !d.isDefined()) {
                            open.put(t, holder.getEntryPoint());
                        }
                    }
                }
                if (open.isEmpty()) {
                    break;
                }
                Set<Address> holders = new TreeSet<>();
                for (Map.Entry<Address, Address> e : open.entrySet()) {
                    tried.add(e.getKey());
                    if (getInstructionAt(e.getKey()) == null) {
                        disassemble(e.getKey());
                    }
                    if (getInstructionAt(e.getKey()) != null) {
                        filled++;
                        holders.add(e.getValue());
                    }
                }
                for (Address a : holders) {
                    Function f = fm.getFunctionAt(a);
                    if (f != null) {
                        CreateFunctionCmd.fixupFunctionBody(currentProgram, f, monitor);
                    }
                }
            }
        }
        println("NEAR_COMPLETE\tmode=" + args[0] + "\tscanned=" + scanned + "\twrong=" + wrong + "\toutside=" + outside.size()
            + "\tblock_cs=" + blockCs + "\tfalse_candidates=" + wrongTargets.size() + "\tnew_callees=" + newCallees.size()
            + "\tcreated=" + created + "\tcleared=" + cleared + "\theld=" + held + "\tremoved=" + removedFalse
            + "\tredecoded=" + redecoded + "\tfilled=" + filled);
    }
}
