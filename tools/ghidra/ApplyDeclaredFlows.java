// Applies a declared-flows file (schema restoration-declared-flows-v1, docs/GHIDRA.md) to one
// Ghidra view. Arguments: the flows file and, optionally, the view name; items that name another
// view are skipped, and items that name none apply to every view.
//
// In order: for each `jumps` item, each computed-jump reference from the site to an address the
// item does not list is removed (DROPPED), and the bodies of the function holding the site and of
// each function that held such an address are recomputed. Each `decode` range is decoded as one
// run of consecutive instructions from its start: each code unit in the range that is not one of
// them is cleared (CONFLICT when a function held it), each function whose entry lies inside one of
// them is removed (FALSESTART), and each of them the listing lacks is disassembled. For each
// `jumps` item, a computed-jump reference is added from the site to each target, and each target
// without an instruction is decoded as a one-instruction range. For each `returns` function, its
// no-return mark is removed, and every call to it whose flow override ends the flow at the call
// has the override removed and its fall-through disassembled. For each `fallThroughs`
// instruction, its fall-through is set to the byte after it and disassembled there. The body of
// each function that holds a site, a call so repaired, a conflict or a decode range's `owner`, or
// that held an address a removed reference named, is recomputed again, until no body changes.
// Last, each function whose entry holds no instruction is decoded again there, after the code
// units from its entry on that no other function holds are cleared. Run it on a copy of a
// snapshot, without -readOnly, after ApplyDeclaredEntries.java, and run CorrectNearTransfers.java
// again after it. It prints addresses and counts only.
// @category Restoration

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import ghidra.app.cmd.function.CreateFunctionCmd;
import ghidra.app.script.GhidraScript;
import ghidra.app.util.PseudoDisassembler;
import ghidra.app.util.PseudoInstruction;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.FlowOverride;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.Listing;
import ghidra.program.model.symbol.RefType;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.SourceType;

public class ApplyDeclaredFlows extends GhidraScript {
    private final Set<Address> fix = new TreeSet<>();
    private int falseStarts = 0;

    // Decodes the half-open range from low as consecutive instructions: each code unit in it (or
    // running into it) that is not one of those instructions is cleared, and the function that
    // held it, if any, is printed as CONFLICT and has its body recomputed later; a function whose
    // entry lies inside one of the instructions is removed (FALSESTART). A unit that is one of
    // those instructions stays. Each of the instructions is then disassembled where the listing
    // has none. The range is extended to the end of its last instruction, so a single target is
    // decoded with its whole first instruction.
    private int decode(Address low, Address end) throws Exception {
        FunctionManager fm = currentProgram.getFunctionManager();
        Listing listing = currentProgram.getListing();
        PseudoDisassembler pd = new PseudoDisassembler(currentProgram);
        Map<Address, Integer> lengths = new HashMap<>();
        Address p = low;
        Address last = end;
        while (p.compareTo(end) < 0) {
            PseudoInstruction pi;
            try {
                pi = pd.disassemble(p);
            } catch (Exception x) {
                pi = null;
            }
            if (pi == null) {
                println("NOPSEUDO\t" + p);
                break;
            }
            lengths.put(p, pi.getLength());
            p = p.add(pi.getLength());
            if (p.compareTo(last) > 0) {
                last = p;
            }
        }
        int conflicts = 0;
        List<CodeUnit> clear = new ArrayList<>();
        CodeUnit before = listing.getCodeUnitContaining(low);
        if (before != null && before.getMinAddress().compareTo(low) < 0) {
            clear.add(before);
        }
        for (CodeUnit u : listing.getCodeUnits(new AddressSet(low, last.subtract(1)), true)) {
            Integer length = lengths.get(u.getMinAddress());
            if (u instanceof Instruction && length != null && length == u.getLength()) {
                continue;
            }
            clear.add(u);
        }
        for (CodeUnit u : clear) {
            if (u instanceof Data d && !d.isDefined()) {
                continue;
            }
            Function f = fm.getFunctionContaining(u.getMinAddress());
            if (f != null) {
                conflicts++;
                fix.add(f.getEntryPoint());
                println("CONFLICT\t" + u.getMinAddress() + "\t" + f.getEntryPoint());
            }
            // A function whose entry lies inside one of the instructions starts at no instruction.
            for (Address x = u.getMinAddress(); x.compareTo(u.getMaxAddress()) <= 0; x = x.add(1)) {
                if (x.compareTo(low) < 0 || x.compareTo(last) >= 0 || lengths.containsKey(x)) {
                    continue;
                }
                if (fm.getFunctionAt(x) == null) {
                    continue;
                }
                fm.removeFunction(x);
                fix.remove(x);
                falseStarts++;
                println("FALSESTART\t" + x);
            }
            clearListing(u.getMinAddress(), u.getMaxAddress());
        }
        List<Address> starts = new ArrayList<>(lengths.keySet());
        Collections.sort(starts);
        for (Address x : starts) {
            if (getInstructionAt(x) == null) {
                disassemble(x);
            }
        }
        if (getInstructionAt(low) == null) {
            println("NOINSTRUCTION\t" + low);
        }
        return conflicts;
    }

    private Set<Address> targets(SegmentedInputs.Jump jump) {
        Set<Address> result = new HashSet<>();
        for (String t : jump.targets()) {
            result.add(toAddr(t));
        }
        return result;
    }

    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1 || args.length > 2) {
            throw new IllegalArgumentException("Supply the declared-flows file and, optionally, the view.");
        }
        String view = args.length == 2 ? args[1] : null;
        SegmentedInputs.DeclaredFlows flows = SegmentedInputs.readDeclaredFlows(Path.of(args[0]), view);
        FunctionManager fm = currentProgram.getFunctionManager();
        ReferenceManager rm = currentProgram.getReferenceManager();
        int decoded = 0, conflicts = 0, jumps = 0, refs = 0, repaired = 0, dropped = 0, fallThroughs = 0;
        // The computed-jump references a site's item does not list go first, and the bodies that
        // held their targets are recomputed, so that code decoded from a wrong target no longer
        // counts as held when the decode ranges are cleared.
        Set<Address> early = new TreeSet<>();
        for (SegmentedInputs.Jump jump : flows.jumps()) {
            Address site = toAddr(jump.site());
            Instruction i = getInstructionAt(site);
            if (i == null) {
                continue;
            }
            Set<Address> declared = targets(jump);
            for (Reference r : i.getReferencesFrom()) {
                if (r.getReferenceType().isComputed() && r.getReferenceType().isJump() && !declared.contains(r.getToAddress())) {
                    Function h = fm.getFunctionContaining(r.getToAddress());
                    if (h != null && !h.getEntryPoint().equals(r.getToAddress())) {
                        early.add(h.getEntryPoint());
                    }
                    rm.delete(r);
                    dropped++;
                    println("DROPPED\t" + site + "\t" + r.getToAddress());
                }
            }
            Function f = fm.getFunctionContaining(site);
            if (f != null) {
                early.add(f.getEntryPoint());
            }
        }
        for (Address a : early) {
            Function f = fm.getFunctionAt(a);
            if (f != null) {
                CreateFunctionCmd.fixupFunctionBody(currentProgram, f, monitor);
            }
        }
        fix.addAll(early);
        for (SegmentedInputs.Decode d : flows.decodes()) {
            conflicts += decode(toAddr(d.range().start()), toAddr(d.range().end()));
            decoded++;
            if (d.owner() != null) {
                fix.add(toAddr(d.owner()));
            }
        }
        for (SegmentedInputs.Jump jump : flows.jumps()) {
            Address site = toAddr(jump.site());
            Instruction i = getInstructionAt(site);
            if (i == null) {
                println("NOSITE\t" + site);
                continue;
            }
            jumps++;
            for (Address target : targets(jump)) {
                if (getInstructionAt(target) == null) {
                    conflicts += decode(target, target.add(1));
                }
                rm.addMemoryReference(site, target, RefType.COMPUTED_JUMP, SourceType.USER_DEFINED, 0);
                refs++;
            }
            Function f = fm.getFunctionContaining(site);
            if (f != null) {
                fix.add(f.getEntryPoint());
            } else {
                println("NOFUNCTION\t" + site);
            }
        }
        for (String text : flows.returns()) {
            Address a = toAddr(text);
            Function f = fm.getFunctionAt(a);
            if (f == null) {
                println("NORETURNS\t" + a);
                continue;
            }
            f.setNoReturn(false);
            for (Reference r : rm.getReferencesTo(a)) {
                if (!r.getReferenceType().isCall()) {
                    continue;
                }
                Instruction call = getInstructionAt(r.getFromAddress());
                if (call == null || call.getFlowOverride() != FlowOverride.CALL_RETURN) {
                    continue;
                }
                call.setFlowOverride(FlowOverride.NONE);
                Address next = call.getMaxAddress().add(1);
                if (getInstructionAt(next) == null) {
                    disassemble(next);
                }
                repaired++;
                println("REPAIRED\t" + call.getAddress() + "\t" + a);
                Function holder = fm.getFunctionContaining(call.getAddress());
                if (holder != null) {
                    fix.add(holder.getEntryPoint());
                }
            }
        }
        for (String text : flows.fallThroughs()) {
            Address a = toAddr(text);
            Instruction i = getInstructionAt(a);
            if (i == null) {
                println("NOFALLTHROUGH\t" + a);
                continue;
            }
            Address next = i.getMaxAddress().add(1);
            i.setFallThrough(next);
            if (getInstructionAt(next) == null) {
                disassemble(next);
            }
            fallThroughs++;
            Function f = fm.getFunctionContaining(a);
            if (f != null) {
                fix.add(f.getEntryPoint());
            }
        }
        int passes = 0;
        boolean changed = true;
        while (changed && passes < 8) {
            changed = false;
            passes++;
            for (Address a : fix) {
                Function f = fm.getFunctionAt(a);
                if (f == null) {
                    println("NOOWNER\t" + a);
                    continue;
                }
                long before = f.getBody().getNumAddresses();
                CreateFunctionCmd.fixupFunctionBody(currentProgram, f, monitor);
                if (f.getBody().getNumAddresses() != before) {
                    changed = true;
                }
            }
        }
        // A function whose entry holds no instruction is decoded again at its entry once the bodies
        // above no longer hold the bytes there.
        int entries = 0;
        List<Function> undecoded = new ArrayList<>();
        for (Function f : fm.getFunctions(true)) {
            if (getInstructionAt(f.getEntryPoint()) == null) {
                undecoded.add(f);
            }
        }
        for (Function f : undecoded) {
            Address a = f.getEntryPoint();
            Function holder = null;
            CodeUnit u = currentProgram.getListing().getCodeUnitContaining(a);
            if (u != null) {
                holder = fm.getFunctionContaining(u.getMinAddress());
            }
            if (holder != null && !holder.equals(f)) {
                println("ENTRYHELD\t" + a + "\t" + holder.getEntryPoint());
                continue;
            }
            // Clear the code units no function holds from the entry on: within the first 16 bytes
            // (the longest instruction) past undefined bytes, then up to the first undefined byte
            // or held unit. They are a decode that started inside the entry's bytes.
            Address p = u != null ? u.getMinAddress() : a;
            while (p.subtract(a) < 4096) {
                CodeUnit c = currentProgram.getListing().getCodeUnitContaining(p);
                if (c == null) {
                    break;
                }
                if (c instanceof Data d && !d.isDefined()) {
                    if (p.subtract(a) >= 16) {
                        break;
                    }
                    p = p.add(1);
                    continue;
                }
                Function h = fm.getFunctionContaining(c.getMinAddress());
                if (h != null && !h.equals(f)) {
                    break;
                }
                clearListing(c.getMinAddress(), c.getMaxAddress());
                p = c.getMaxAddress().add(1);
            }
            disassemble(a);
            if (getInstructionAt(a) == null) {
                println("ENTRYFAILED\t" + a);
                continue;
            }
            CreateFunctionCmd.fixupFunctionBody(currentProgram, f, monitor);
            entries++;
            println("ENTRYDECODED\t" + a + "\t" + f.getBody().getNumAddresses());
        }
        for (Address a : fix) {
            Function f = fm.getFunctionAt(a);
            if (f != null) {
                println("BODY\t" + a + "\t" + f.getBody().getNumAddresses());
            }
        }
        println("FLOWS_COMPLETE\tview=" + (view == null ? "" : view) + "\tdecoded=" + decoded + "\tconflicts=" + conflicts
            + "\tfalse_starts=" + falseStarts + "\tjumps=" + jumps + "\trefs=" + refs + "\trepaired=" + repaired
            + "\tdropped=" + dropped + "\tfallthroughs=" + fallThroughs + "\tentries=" + entries
            + "\tfunctions=" + fix.size() + "\tpasses=" + passes);
    }
}
