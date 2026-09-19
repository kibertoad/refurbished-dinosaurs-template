// Exports Ghidra's instruction-level correlation for explicitly paired functions.
//@category Restoration

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import ghidra.feature.vt.AbstractGhidraVersionTrackingScript;
import ghidra.feature.vt.api.correlator.address.VTHashedFunctionAddressCorrelation;
import ghidra.feature.vt.api.main.VTSession;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Program;
import ghidra.program.util.AddressCorrelationRange;

public class ExportFunctionAddressCorrelations extends AbstractGhidraVersionTrackingScript {
    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 4) {
            throw new IllegalArgumentException(
                "Expected session path, function-pairs TSV, addresses TSV, and output TSV");
        }

        openVersionTrackingSession(args[0]);
        VTSession session = getVTSession();
        Program source = session.getSourceProgram();
        Program destination = session.getDestinationProgram();
        Path output = requireLocalOutput(Path.of(args[3]));
        Files.createDirectories(output.getParent());

        try (BufferedWriter writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8);
             BufferedReader pairs = Files.newBufferedReader(Path.of(args[1]), StandardCharsets.UTF_8)) {
            writer.write("old_address\tnew_address\told_function\tnew_function\tcorrelator\n");
            pairs.readLine();
            String pairLine;
            while ((pairLine = pairs.readLine()) != null) {
                monitor.checkCancelled();
                String[] pair = pairLine.split("\\t", -1);
                if (pair.length < 2) continue;
                pair[0] = clean(pair[0]);
                pair[1] = clean(pair[1]);
                if (pair[0].isBlank() || pair[1].isBlank()) continue;
                Address oldEntry = source.getAddressFactory().getDefaultAddressSpace()
                    .getAddress(Long.parseUnsignedLong(pair[0], 16));
                Address newEntry = destination.getAddressFactory().getDefaultAddressSpace()
                    .getAddress(Long.parseUnsignedLong(pair[1], 16));
                Function oldFunction = source.getFunctionManager().getFunctionAt(oldEntry);
                Function newFunction = destination.getFunctionManager().getFunctionAt(newEntry);
                if (oldFunction == null || newFunction == null) {
                    println("Skipping missing function pair " + pair[0] + " -> " + pair[1]);
                    continue;
                }
                exportAddresses(args[2], writer, oldFunction, newFunction);
            }
        }
        println("Exported function address correlations to " + output);
    }

    private void exportAddresses(String addressFile, BufferedWriter writer,
            Function oldFunction, Function newFunction) throws Exception {
        VTHashedFunctionAddressCorrelation correlation =
            new VTHashedFunctionAddressCorrelation(oldFunction, newFunction);
        try (BufferedReader addresses = Files.newBufferedReader(
                Path.of(addressFile), StandardCharsets.UTF_8)) {
            addresses.readLine();
            String line;
            while ((line = addresses.readLine()) != null) {
                monitor.checkCancelled();
                String oldText = clean(line.split("\\t", -1)[0]);
                Address oldAddress = oldFunction.getEntryPoint().getAddressSpace()
                    .getAddress(Long.parseUnsignedLong(oldText, 16));
                if (!oldFunction.getBody().contains(oldAddress)) continue;
                AddressCorrelationRange range =
                    correlation.getCorrelatedDestinationRange(oldAddress, monitor);
                long offset = 0;
                if (range == null) {
                    CodeUnit unit = oldFunction.getProgram().getListing()
                        .getCodeUnitContaining(oldAddress);
                    if (unit != null) {
                        offset = oldAddress.subtract(unit.getMinAddress());
                        range = correlation.getCorrelatedDestinationRange(
                            unit.getMinAddress(), monitor);
                    }
                }
                if (range == null) continue;
                Address newAddress = range.getMinAddress().add(offset);
                writer.write(oldText + "\t" + newAddress + "\t" +
                    oldFunction.getEntryPoint() + "\t" + newFunction.getEntryPoint() + "\t" +
                    range.getCorrelatorName() + "\n");
            }
        }
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
