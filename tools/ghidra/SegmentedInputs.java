// Inputs and arithmetic shared by CorrectNearTransfers.java, ApplyDeclaredEntries.java and
// ApplyDeclaredFlows.java. It uses no Ghidra class, so tests/upstream/ghidra-inputs.test.mjs
// compiles and runs it with a plain JDK. Ghidra compiles it with the scripts in this directory.
//
// The segment map gives, for each code segment of a 16-bit segmented view, the segment value as
// the view shows it and the half-open offset span its code occupies. A project derives it from its
// own MZ layout, overlay manager or segment table; nothing here reads a game's format. The
// declared entries and flows files give the function starts and control flow the project has
// established and Ghidra misses, in the view's segment:offset spelling. docs/GHIDRA.md documents
// all three formats.

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class SegmentedInputs {
    public static final long MAX_INPUT_BYTES = 16L * 1024 * 1024;
    public static final int MAX_DEPTH = 32;

    private SegmentedInputs() {
    }

    // ---- Near relative transfers ----

    public enum Kind { CALL, JUMP, CONDITIONAL }

    public record NearTransfer(Kind kind, int displacement) {
    }

    private static final Set<Integer> PREFIXES =
        Set.of(0x26, 0x2E, 0x36, 0x3E, 0x64, 0x65, 0x66, 0x67, 0xF0, 0xF2, 0xF3);

    // Reads an instruction's bytes as a near relative transfer of 16-bit code: E8 and E9 with a
    // 16-bit displacement, EB, 70..7F, E0..E3 (loopne, loope, loop, jcxz) with an 8-bit one, and
    // 0F 80..8F with a 16-bit one, after any prefixes. Returns null for anything else, including
    // a form whose length does not match, such as one with a 32-bit displacement.
    public static NearTransfer nearTransfer(byte[] bytes) {
        int k = 0;
        while (k < bytes.length && PREFIXES.contains(bytes[k] & 0xFF)) {
            k++;
        }
        if (k >= bytes.length) {
            return null;
        }
        int op = bytes[k] & 0xFF;
        int rest = bytes.length - k;
        if ((op == 0xE8 || op == 0xE9) && rest == 3) {
            return new NearTransfer(op == 0xE8 ? Kind.CALL : Kind.JUMP, word(bytes, k + 1));
        }
        if (rest == 2 && (op == 0xEB || (op >= 0x70 && op <= 0x7F) || (op >= 0xE0 && op <= 0xE3))) {
            return new NearTransfer(op == 0xEB ? Kind.JUMP : Kind.CONDITIONAL, bytes[k + 1]);
        }
        if (op == 0x0F && rest == 4 && (bytes[k + 1] & 0xFF) >= 0x80 && (bytes[k + 1] & 0xFF) <= 0x8F) {
            return new NearTransfer(Kind.CONDITIONAL, word(bytes, k + 2));
        }
        return null;
    }

    // True for a near indirect jump (FF /4), which keeps CS like a relative one.
    public static boolean isNearIndirectJump(byte[] bytes) {
        int k = 0;
        while (k < bytes.length && PREFIXES.contains(bytes[k] & 0xFF)) {
            k++;
        }
        return k + 1 < bytes.length && (bytes[k] & 0xFF) == 0xFF && ((bytes[k + 1] >> 3) & 7) == 4;
    }

    private static int word(byte[] bytes, int at) {
        return (short) ((bytes[at] & 0xFF) | (bytes[at + 1] << 8));
    }

    // The offset a near relative transfer reaches: the IP after the instruction plus the
    // displacement, modulo 64K, in the instruction's own CS. linear is the instruction's linear
    // address (segment * 16 + offset), which must lie in CS's 64K window.
    public static int nearTargetOffset(int cs, long linear, int length, int displacement) {
        long base = (long) cs * 16;
        if (cs < 0 || cs > 0xFFFF || linear < base || linear >= base + 0x10000) {
            throw new IllegalArgumentException(String.format(
                "Linear address %X lies outside segment %04X's 64K window.", linear, cs));
        }
        return (int) ((linear - base + length + displacement) & 0xFFFF);
    }

    // ---- Segment map ----

    public record Span(int segment, int start, int end) {
        long linearStart() {
            return (long) segment * 16 + start;
        }

        long linearEnd() {
            return (long) segment * 16 + end;
        }
    }

    public static final class SegmentMap {
        private final List<Span> spans;

        SegmentMap(List<Span> spans) {
            List<Span> sorted = new ArrayList<>(spans);
            sorted.sort((a, b) -> Long.compare(a.linearStart(), b.linearStart()));
            for (int i = 1; i < sorted.size(); i++) {
                Span before = sorted.get(i - 1);
                Span after = sorted.get(i);
                if (after.linearStart() < before.linearEnd()) {
                    throw new IllegalArgumentException(String.format(
                        "Segment map spans %04X:%04X..%04X:%04X and %04X:%04X..%04X:%04X overlap.",
                        before.segment(), before.start(), before.segment(), before.end(),
                        after.segment(), after.start(), after.segment(), after.end()));
                }
            }
            this.spans = Collections.unmodifiableList(sorted);
        }

        public List<Span> spans() {
            return spans;
        }

        // The segment whose span holds the linear address, or -1 when none does.
        public int segmentAt(long linear) {
            int low = 0;
            int high = spans.size() - 1;
            while (low <= high) {
                int middle = (low + high) >>> 1;
                Span span = spans.get(middle);
                if (linear < span.linearStart()) {
                    high = middle - 1;
                } else if (linear >= span.linearEnd()) {
                    low = middle + 1;
                } else {
                    return span.segment();
                }
            }
            return -1;
        }
    }

    // Reads a segment map from a .json or .tsv file (docs/GHIDRA.md).
    public static SegmentMap readSegmentMap(Path path) throws IOException {
        String text = readBounded(path);
        String name = path.getFileName().toString().toLowerCase();
        if (name.endsWith(".tsv")) {
            return parseSegmentMapTsv(text);
        }
        if (name.endsWith(".json")) {
            return parseSegmentMapJson(text);
        }
        throw new IllegalArgumentException("A segment map is a .json or .tsv file: " + path);
    }

    public static SegmentMap parseSegmentMapJson(String text) {
        Map<String, Object> root = object(Json.parse(text), "segment map");
        keys(root, "segment map", Set.of("schema", "segments"), Set.of("about", "build", "file", "evidence"));
        requireSchema(root, "restoration-segment-map-v1");
        List<Span> spans = new ArrayList<>();
        int index = 0;
        for (Object item : array(root.get("segments"), "segments")) {
            String where = "segments[" + index++ + "]";
            Map<String, Object> segment = object(item, where);
            keys(segment, where, Set.of("segment", "start", "end"), Set.of("name", "evidence"));
            spans.add(span(string(segment.get("segment"), where + ".segment"),
                string(segment.get("start"), where + ".start"),
                string(segment.get("end"), where + ".end"), where));
        }
        return new SegmentMap(spans);
    }

    public static SegmentMap parseSegmentMapTsv(String text) {
        String[] lines = text.split("\r?\n", -1);
        List<Span> spans = new ArrayList<>();
        boolean header = false;
        for (int number = 1; number <= lines.length; number++) {
            String line = lines[number - 1];
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] fields = line.split("\t", -1);
            if (!header) {
                if (fields.length < 3 || !fields[0].equals("segment") || !fields[1].equals("start")
                    || !fields[2].equals("end")) {
                    throw new IllegalArgumentException(
                        "A segment map TSV starts with the header segment, start, end.");
                }
                header = true;
                continue;
            }
            if (fields.length < 3) {
                throw new IllegalArgumentException("Segment map line " + number + " has fewer than three fields.");
            }
            spans.add(span(fields[0], fields[1], fields[2], "line " + number));
        }
        if (!header) {
            throw new IllegalArgumentException("A segment map TSV starts with the header segment, start, end.");
        }
        return new SegmentMap(spans);
    }

    private static Span span(String segment, String start, String end, String where) {
        int s = hex(segment, 0xFFFF, where + " segment");
        int from = hex(start, 0xFFFF, where + " start");
        int to = hex(end, 0x10000, where + " end");
        if (from >= to) {
            throw new IllegalArgumentException(where + ": the span's end must lie after its start.");
        }
        return new Span(s, from, to);
    }

    private static int hex(String text, int max, String where) {
        if (text == null || !text.matches("[0-9A-Fa-f]{1,5}")) {
            throw new IllegalArgumentException(where + " must be 1 to 5 hex digits without a prefix: " + text);
        }
        int value = Integer.parseInt(text, 16);
        if (value > max) {
            throw new IllegalArgumentException(where + " exceeds " + Integer.toHexString(max).toUpperCase() + ": " + text);
        }
        return value;
    }

    // ---- Declared entries and flows ----

    // A half-open range of view addresses, "A..B".
    public record Range(String start, String end) {
    }

    public record Removal(List<String> starts, Range clear, String owner) {
    }

    public record DeclaredEntries(List<String> entries, List<Removal> removals) {
    }

    public record Jump(String site, List<String> targets) {
    }

    public record Decode(Range range, String owner) {
    }

    public record DeclaredFlows(List<Jump> jumps, List<Decode> decodes, List<String> returns,
                                List<String> fallThroughs) {
    }

    private static final Set<String> NOTES = Set.of("reason", "evidence");

    public static DeclaredEntries readDeclaredEntries(Path path, String view) throws IOException {
        return parseDeclaredEntries(readBounded(path), view);
    }

    // Keeps the items whose view is the given one, and those that name no view. A null view keeps
    // only the items that name none.
    public static DeclaredEntries parseDeclaredEntries(String text, String view) {
        Map<String, Object> root = object(Json.parse(text), "declared entries");
        keys(root, "declared entries", Set.of("schema", "entries", "remove"), Set.of("about", "build", "file", "evidence"));
        requireSchema(root, "restoration-declared-entries-v1");
        List<String> entries = new ArrayList<>();
        int index = 0;
        for (Object item : array(root.get("entries"), "entries")) {
            String where = "entries[" + index++ + "]";
            Map<String, Object> entry = object(item, where);
            keys(entry, where, Set.of("at"), with(NOTES, "view"));
            if (inView(entry, view, where)) {
                entries.add(address(entry.get("at"), where + ".at"));
            }
        }
        List<Removal> removals = new ArrayList<>();
        index = 0;
        for (Object item : array(root.get("remove"), "remove")) {
            String where = "remove[" + index++ + "]";
            Map<String, Object> removal = object(item, where);
            keys(removal, where, Set.of("starts", "clear"), with(NOTES, "view", "owner"));
            if (!inView(removal, view, where)) {
                continue;
            }
            List<String> starts = new ArrayList<>();
            int s = 0;
            for (Object start : array(removal.get("starts"), where + ".starts")) {
                starts.add(address(start, where + ".starts[" + s++ + "]"));
            }
            removals.add(new Removal(starts, range(removal.get("clear"), where + ".clear"),
                removal.containsKey("owner") ? address(removal.get("owner"), where + ".owner") : null));
        }
        return new DeclaredEntries(entries, removals);
    }

    public static DeclaredFlows readDeclaredFlows(Path path, String view) throws IOException {
        return parseDeclaredFlows(readBounded(path), view);
    }

    public static DeclaredFlows parseDeclaredFlows(String text, String view) {
        Map<String, Object> root = object(Json.parse(text), "declared flows");
        keys(root, "declared flows", Set.of("schema", "jumps", "decode", "returns", "fallThroughs"),
            Set.of("about", "build", "file", "evidence"));
        requireSchema(root, "restoration-declared-flows-v1");
        List<Jump> jumps = new ArrayList<>();
        int index = 0;
        for (Object item : array(root.get("jumps"), "jumps")) {
            String where = "jumps[" + index++ + "]";
            Map<String, Object> jump = object(item, where);
            keys(jump, where, Set.of("site", "targets"), with(NOTES, "view", "table", "bound"));
            if (!inView(jump, view, where)) {
                continue;
            }
            List<String> targets = new ArrayList<>();
            int t = 0;
            for (Object target : array(jump.get("targets"), where + ".targets")) {
                targets.add(address(target, where + ".targets[" + t++ + "]"));
            }
            if (targets.isEmpty()) {
                throw new IllegalArgumentException(where + ".targets is empty.");
            }
            jumps.add(new Jump(address(jump.get("site"), where + ".site"), targets));
        }
        List<Decode> decodes = new ArrayList<>();
        index = 0;
        for (Object item : array(root.get("decode"), "decode")) {
            String where = "decode[" + index++ + "]";
            Map<String, Object> decode = object(item, where);
            keys(decode, where, Set.of("range"), with(NOTES, "view", "owner"));
            if (inView(decode, view, where)) {
                decodes.add(new Decode(range(decode.get("range"), where + ".range"),
                    decode.containsKey("owner") ? address(decode.get("owner"), where + ".owner") : null));
            }
        }
        List<String> returns = new ArrayList<>();
        index = 0;
        for (Object item : array(root.get("returns"), "returns")) {
            String where = "returns[" + index++ + "]";
            Map<String, Object> entry = object(item, where);
            keys(entry, where, Set.of("function", "reason"), Set.of("view", "evidence"));
            string(entry.get("reason"), where + ".reason");
            if (inView(entry, view, where)) {
                returns.add(address(entry.get("function"), where + ".function"));
            }
        }
        List<String> fallThroughs = new ArrayList<>();
        index = 0;
        for (Object item : array(root.get("fallThroughs"), "fallThroughs")) {
            String where = "fallThroughs[" + index++ + "]";
            Map<String, Object> entry = object(item, where);
            keys(entry, where, Set.of("at", "reason"), Set.of("view", "evidence"));
            string(entry.get("reason"), where + ".reason");
            if (inView(entry, view, where)) {
                fallThroughs.add(address(entry.get("at"), where + ".at"));
            }
        }
        return new DeclaredFlows(jumps, decodes, returns, fallThroughs);
    }

    private static Set<String> with(Set<String> base, String... more) {
        java.util.HashSet<String> result = new java.util.HashSet<>(base);
        Collections.addAll(result, more);
        return result;
    }

    private static boolean inView(Map<String, Object> item, String view, String where) {
        if (!item.containsKey("view")) {
            return true;
        }
        return string(item.get("view"), where + ".view").equals(view);
    }

    // An address in the view's segment:offset spelling (1 to 4 hex digits each), which the
    // scripts hand to toAddr. The upper-case form is returned.
    public static String address(Object value, String where) {
        String text = string(value, where);
        if (!text.matches("[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}")) {
            throw new IllegalArgumentException(where + " must be segment:offset in hex: " + text);
        }
        return text.toUpperCase();
    }

    public static Range range(Object value, String where) {
        String text = string(value, where);
        String[] pair = text.split("\\.\\.", -1);
        if (pair.length != 2) {
            throw new IllegalArgumentException(where + " must be a half-open range start..end: " + text);
        }
        String start = address(pair[0], where);
        String end = address(pair[1], where);
        String[] a = start.split(":");
        String[] b = end.split(":");
        if (Integer.parseInt(a[0], 16) != Integer.parseInt(b[0], 16)
            || Integer.parseInt(a[1], 16) >= Integer.parseInt(b[1], 16)) {
            throw new IllegalArgumentException(where + " must end after its start, in the same segment: " + text);
        }
        return new Range(start, end);
    }

    // ---- JSON helpers ----

    static String readBounded(Path path) throws IOException {
        long size = Files.size(path);
        if (size > MAX_INPUT_BYTES) {
            throw new IllegalArgumentException(path + " is larger than " + MAX_INPUT_BYTES + " bytes.");
        }
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }

    private static void requireSchema(Map<String, Object> root, String schema) {
        if (!schema.equals(root.get("schema"))) {
            throw new IllegalArgumentException("Expected \"schema\": \"" + schema + "\".");
        }
    }

    private static void keys(Map<String, Object> object, String where, Set<String> required, Set<String> optional) {
        for (String key : required) {
            if (!object.containsKey(key)) {
                throw new IllegalArgumentException(where + " lacks \"" + key + "\".");
            }
        }
        for (String key : object.keySet()) {
            if (!required.contains(key) && !optional.contains(key)) {
                throw new IllegalArgumentException(where + " has unknown key \"" + key + "\".");
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value, String where) {
        if (!(value instanceof Map)) {
            throw new IllegalArgumentException(where + " must be a JSON object.");
        }
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> array(Object value, String where) {
        if (!(value instanceof List)) {
            throw new IllegalArgumentException(where + " must be a JSON array.");
        }
        return (List<Object>) value;
    }

    private static String string(Object value, String where) {
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException(where + " must be a string.");
        }
        return text;
    }

    // A strict JSON reader: objects, arrays, strings, numbers, true, false and null, with nesting
    // bounded by MAX_DEPTH and duplicate keys rejected. Numbers are kept as their text.
    static final class Json {
        private final String text;
        private int at;

        private Json(String text) {
            this.text = text;
        }

        static Object parse(String text) {
            Json json = new Json(text.startsWith("﻿") ? text.substring(1) : text);
            Object value = json.value(0);
            json.space();
            if (json.at != json.text.length()) {
                throw json.error("Unexpected text after the JSON value");
            }
            return value;
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException(message + " at character " + at + ".");
        }

        private void space() {
            while (at < text.length() && " \t\r\n".indexOf(text.charAt(at)) >= 0) {
                at++;
            }
        }

        private Object value(int depth) {
            if (depth > MAX_DEPTH) {
                throw error("JSON nested deeper than " + MAX_DEPTH);
            }
            space();
            if (at >= text.length()) {
                throw error("Unexpected end of JSON");
            }
            char c = text.charAt(at);
            if (c == '{') {
                at++;
                Map<String, Object> result = new LinkedHashMap<>();
                space();
                if (at < text.length() && text.charAt(at) == '}') {
                    at++;
                    return result;
                }
                while (true) {
                    space();
                    if (at >= text.length() || text.charAt(at) != '"') {
                        throw error("Expected a key");
                    }
                    String key = string();
                    if (result.containsKey(key)) {
                        throw error("Duplicate key \"" + key + "\"");
                    }
                    space();
                    expect(':');
                    result.put(key, value(depth + 1));
                    space();
                    if (at < text.length() && text.charAt(at) == ',') {
                        at++;
                        continue;
                    }
                    expect('}');
                    return result;
                }
            }
            if (c == '[') {
                at++;
                List<Object> result = new ArrayList<>();
                space();
                if (at < text.length() && text.charAt(at) == ']') {
                    at++;
                    return result;
                }
                while (true) {
                    result.add(value(depth + 1));
                    space();
                    if (at < text.length() && text.charAt(at) == ',') {
                        at++;
                        continue;
                    }
                    expect(']');
                    return result;
                }
            }
            if (c == '"') {
                return string();
            }
            for (String word : new String[] {"true", "false", "null"}) {
                if (text.startsWith(word, at)) {
                    at += word.length();
                    return word.equals("null") ? null : Boolean.valueOf(word);
                }
            }
            int start = at;
            while (at < text.length() && "+-0123456789.eE".indexOf(text.charAt(at)) >= 0) {
                at++;
            }
            String number = text.substring(start, at);
            if (!number.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?")) {
                at = start;
                throw error("Unexpected JSON value");
            }
            return number;
        }

        private void expect(char c) {
            if (at >= text.length() || text.charAt(at) != c) {
                throw error("Expected '" + c + "'");
            }
            at++;
        }

        private String string() {
            at++;
            StringBuilder result = new StringBuilder();
            while (true) {
                if (at >= text.length()) {
                    throw error("Unterminated string");
                }
                char c = text.charAt(at++);
                if (c == '"') {
                    return result.toString();
                }
                if (c < 0x20) {
                    throw error("Control character in string");
                }
                if (c != '\\') {
                    result.append(c);
                    continue;
                }
                if (at >= text.length()) {
                    throw error("Unterminated escape");
                }
                char e = text.charAt(at++);
                switch (e) {
                    case '"', '\\', '/' -> result.append(e);
                    case 'b' -> result.append('\b');
                    case 'f' -> result.append('\f');
                    case 'n' -> result.append('\n');
                    case 'r' -> result.append('\r');
                    case 't' -> result.append('\t');
                    case 'u' -> {
                        if (at + 4 > text.length() || !text.substring(at, at + 4).matches("[0-9A-Fa-f]{4}")) {
                            throw error("Bad \\u escape");
                        }
                        result.append((char) Integer.parseInt(text.substring(at, at + 4), 16));
                        at += 4;
                    }
                    default -> throw error("Bad escape");
                }
            }
        }
    }
}
