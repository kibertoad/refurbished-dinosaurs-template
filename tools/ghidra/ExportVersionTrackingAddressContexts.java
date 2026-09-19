// Exports source ownership and Version Tracking candidates for selected addresses.
//@category Restoration

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;

import ghidra.feature.vt.AbstractGhidraVersionTrackingScript;
import ghidra.feature.vt.api.main.VTAssociation;
import ghidra.feature.vt.api.main.VTMatch;
import ghidra.feature.vt.api.main.VTSession;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Program;

public class ExportVersionTrackingAddressContexts extends AbstractGhidraVersionTrackingScript {
    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 3) {
            throw new IllegalArgumentException("Expected session path, addresses TSV, output TSV");
        }
        openVersionTrackingSession(args[0]);
        VTSession session = getVTSession();
        Program source = session.getSourceProgram();
        Path output = requireLocalOutput(Path.of(args[2]));
        Files.createDirectories(output.getParent());
        try (BufferedReader input = Files.newBufferedReader(Path.of(args[1]), StandardCharsets.UTF_8);
             BufferedWriter writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8)) {
            writer.write("old_address\told_function\tcode_unit\tcandidate_function\tstatus\tvotes\tcorrelator\n");
            input.readLine();
            String line;
            while ((line = input.readLine()) != null) {
                monitor.checkCancelled();
                String oldText = clean(line.split("\\t", -1)[0]);
                Address oldAddress = source.getAddressFactory().getDefaultAddressSpace()
                    .getAddress(Long.parseUnsignedLong(oldText, 16));
                Function function = source.getFunctionManager().getFunctionContaining(oldAddress);
                CodeUnit unit = source.getListing().getCodeUnitContaining(oldAddress);
                if (function == null) {
                    write(writer, oldText, "", unit, null, null);
                    continue;
                }
                Collection<VTAssociation> associations = session.getAssociationManager()
                    .getRelatedAssociationsBySourceAddress(function.getEntryPoint());
                if (associations.isEmpty()) {
                    write(writer, oldText, function.getEntryPoint().toString(), unit, null, null);
                    continue;
                }
                for (VTAssociation association : associations) {
                    for (VTMatch match : session.getMatches(association)) {
                        write(writer, oldText, function.getEntryPoint().toString(), unit,
                            association, match);
                    }
                }
            }
        }
        println("Exported Version Tracking address contexts to " + output);
    }

    private static void write(BufferedWriter writer, String address, String function,
            CodeUnit unit, VTAssociation association, VTMatch match) throws Exception {
        writer.write(address + "\t" + function + "\t" + (unit == null ? "" : unit.getAddress()) +
            "\t" + (association == null ? "" : association.getDestinationAddress()) + "\t" +
            (association == null ? "" : association.getStatus()) + "\t" +
            (association == null ? "" : association.getVoteCount()) + "\t" +
            (match == null ? "" : match.getMatchSet().getProgramCorrelatorInfo().getName()) + "\n");
    }

    private static String clean(String value) {
        return value.replace("\"", "").trim();
    }

    private static Path requireLocalOutput(Path output) {
        Path absolute = output.toAbsolutePath().normalize();
        Path temporary = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        String normalized = absolute.toString().replace('\\', '/');
        if (!absolute.startsWith(temporary)
            && !normalized.contains("/analysis/original/")
            && !normalized.endsWith("/analysis/original")) {
            throw new IllegalArgumentException(
                "Broad Ghidra exports must stay below the system temporary directory or analysis/original.");
        }
        return absolute;
    }
}
