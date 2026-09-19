// Exports deterministic, edition-labelled Ghidra analysis inventories.
//@category Restoration

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import ghidra.app.script.GhidraScript;
import ghidra.framework.Application;
import ghidra.program.model.address.Address;
import ghidra.program.model.lang.Register;
import ghidra.program.model.scalar.Scalar;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.listing.Listing;
import ghidra.program.model.mem.MemoryAccessException;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.Symbol;

public class ExportEditionAnalysis extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 2) {
            throw new IllegalArgumentException("Expected output directory and edition label");
        }

        Path output = requireLocalOutput(Path.of(args[0]));
        String edition = args[1];
        Files.createDirectories(output);

        List<Function> functions = new ArrayList<>();
        currentProgram.getFunctionManager().getFunctions(true).forEachRemaining(functions::add);
        functions.sort(Comparator.comparing(Function::getEntryPoint));

        try (BufferedWriter functionWriter = writer(output, edition, "functions");
             BufferedWriter instructionWriter = writer(output, edition, "instructions");
             BufferedWriter referenceWriter = writer(output, edition, "references")) {
            writeMetadata(functionWriter, edition);
            writeMetadata(instructionWriter, edition);
            writeMetadata(referenceWriter, edition);
            functionWriter.write("entry\tname\tbody_addresses\tinstructions\tbytes_sha256\tmnemonics_sha256\tshape_sha256\tsemantic_sha256\n");
            instructionWriter.write("function\taddress\tbytes\tmnemonic\toperands\tflow\tsemantic\n");
            referenceWriter.write("function\tfrom\tto\ttype\ttarget_symbol\ttarget_value\n");

            Listing listing = currentProgram.getListing();
            for (Function function : functions) {
                monitor.checkCancelled();
                MessageDigest bytesHash = sha256();
                MessageDigest mnemonicHash = sha256();
                MessageDigest shapeHash = sha256();
                MessageDigest semanticHash = sha256();
                int instructionCount = 0;
                InstructionIterator instructions = listing.getInstructions(function.getBody(), true);
                while (instructions.hasNext()) {
                    Instruction instruction = instructions.next();
                    instructionCount++;
                    byte[] bytes = instruction.getBytes();
                    bytesHash.update(bytes);
                    update(mnemonicHash, instruction.getMnemonicString());
                    update(mnemonicHash, "\n");
                    update(shapeHash, instruction.getMnemonicString());
                    update(shapeHash, "|");
                    update(shapeHash, Integer.toString(instruction.getNumOperands()));
                    update(shapeHash, "|");
                    update(shapeHash, instruction.getFlowType().toString());
                    update(shapeHash, "\n");
                    String semantic = instructionSemantic(instruction);
                    update(semanticHash, semantic);
                    update(semanticHash, "\n");

                    instructionWriter.write(tsv(function.getEntryPoint(), instruction.getAddress(),
                        hex(bytes), instruction.getMnemonicString(), instructionOperands(instruction),
                        instruction.getFlowType(), semantic));
                    for (Reference reference : instruction.getReferencesFrom()) {
                        Address target = reference.getToAddress();
                        Symbol symbol = currentProgram.getSymbolTable().getPrimarySymbol(target);
                        Data data = listing.getDataAt(target);
                        Object value = data != null && data.hasStringValue() ? data.getValue() : null;
                        referenceWriter.write(tsv(function.getEntryPoint(), instruction.getAddress(), target,
                            reference.getReferenceType(), symbol == null ? "" : symbol.getName(true),
                            value == null ? "" : value));
                    }
                }

                functionWriter.write(tsv(function.getEntryPoint(), function.getName(true),
                    function.getBody().getNumAddresses(), instructionCount, digest(bytesHash),
                    digest(mnemonicHash), digest(shapeHash), digest(semanticHash)));
            }
        }

        println("Exported " + functions.size() + " functions for edition " + edition + " to " + output);
    }

    private BufferedWriter writer(Path output, String edition, String kind) throws Exception {
        return Files.newBufferedWriter(output.resolve(edition + "." + kind + ".tsv"),
            StandardCharsets.UTF_8);
    }

    private void writeMetadata(BufferedWriter writer, String edition) throws Exception {
        writer.write("# schema=restoration-ghidra-analysis-v1\n");
        writer.write("# edition=" + clean(edition) + "\n");
        writer.write("# ghidra=" + clean(Application.getApplicationVersion()) + "\n");
        writer.write("# program=" + clean(currentProgram.getName()) + "\n");
        writer.write("# executable_sha256=" + clean(currentProgram.getExecutableSHA256()) + "\n");
        writer.write("# image_base=" + currentProgram.getImageBase() + "\n");
        writer.write("# language=" + clean(currentProgram.getLanguageID()) + "\n");
    }

    private static String instructionOperands(Instruction instruction) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < instruction.getNumOperands(); index++) {
            if (index != 0) {
                result.append(", ");
            }
            result.append(instruction.getDefaultOperandRepresentation(index));
        }
        return result.toString();
    }

    private static MessageDigest sha256() throws Exception {
        return MessageDigest.getInstance("SHA-256");
    }

    private String normalizedOperandObject(Object object) {
        if (object instanceof Address) {
            return "address";
        }
        if (object instanceof Register register) {
            return "register:" + register.getName();
        }
        if (object instanceof Scalar scalar) {
            Address candidate = currentProgram.getAddressFactory().getDefaultAddressSpace()
                .getAddress(scalar.getUnsignedValue());
            if (currentProgram.getMemory().contains(candidate)) {
                return "address";
            }
            return "scalar:" + scalar.bitLength() + ":" +
                Long.toUnsignedString(scalar.getUnsignedValue());
        }
        return object.getClass().getSimpleName() + ":" + clean(object);
    }

    private String instructionSemantic(Instruction instruction) {
        StringBuilder result = new StringBuilder(instruction.getMnemonicString());
        for (int operandIndex = 0;
             operandIndex < instruction.getNumOperands();
             operandIndex++) {
            result.append('|').append(instruction.getOperandType(operandIndex));
            for (Object object : instruction.getOpObjects(operandIndex)) {
                result.append(':').append(normalizedOperandObject(object));
            }
        }
        return result.append('|').append(instruction.getFlowType()).toString();
    }

    private static void update(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String digest(MessageDigest digest) {
        return hex(digest.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            result.append(String.format("%02x", value & 0xff));
        }
        return result.toString();
    }

    private static String tsv(Object... values) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < values.length; index++) {
            if (index != 0) {
                result.append('\t');
            }
            result.append(clean(values[index]));
        }
        return result.append('\n').toString();
    }

    private static String clean(Object value) {
        return value == null ? "" : value.toString().replace('\t', ' ').replace('\r', ' ').replace('\n', ' ');
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
