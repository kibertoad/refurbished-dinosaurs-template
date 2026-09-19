// Exports every Ghidra Version Tracking match with its correlator and status.
//@category Restoration

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import ghidra.feature.vt.AbstractGhidraVersionTrackingScript;
import ghidra.feature.vt.api.main.VTAssociation;
import ghidra.feature.vt.api.main.VTMatch;
import ghidra.feature.vt.api.main.VTMatchSet;
import ghidra.feature.vt.api.main.VTSession;

public class ExportVersionTrackingMatches extends AbstractGhidraVersionTrackingScript {
    @Override
    protected void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 2) {
            throw new IllegalArgumentException("Expected session path and output TSV path");
        }
        openVersionTrackingSession(args[0]);
        VTSession session = getVTSession();
        Path output = requireLocalOutput(Path.of(args[1]));
        Files.createDirectories(output.getParent());
        try (BufferedWriter writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8)) {
            writer.write("source\tdestination\ttype\tstatus\tvotes\tcorrelator\tsimilarity\tconfidence\tsource_length\tdestination_length\n");
            for (VTMatchSet set : session.getMatchSets()) {
                String correlator = set.getProgramCorrelatorInfo().getName();
                for (VTMatch match : set.getMatches()) {
                    monitor.checkCancelled();
                    VTAssociation association = match.getAssociation();
                    writer.write(tsv(match.getSourceAddress(), match.getDestinationAddress(),
                        association.getType(), association.getStatus(), association.getVoteCount(),
                        correlator, match.getSimilarityScore().toStorageString(),
                        match.getConfidenceScore().toStorageString(), match.getSourceLength(),
                        match.getDestinationLength()));
                }
            }
        }
        println("Exported Version Tracking matches to " + output);
    }

    private static String tsv(Object... values) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < values.length; index++) {
            if (index != 0) result.append('\t');
            result.append(values[index] == null ? "" : values[index].toString()
                .replace('\t', ' ').replace('\r', ' ').replace('\n', ' '));
        }
        return result.append('\n').toString();
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
