using System.Globalization;
using System.Text.RegularExpressions;

namespace Restoration.Inspect;

/// <summary>One place in the documentation where an address is written down.</summary>
public sealed record AddressCitation(uint Address, string File, int Line, bool IsFunctionName, bool IsRangeEnd);

/// <summary>What the executable (and optionally a Ghidra instruction export) says about one cited address.</summary>
public sealed record CitedAddress(uint Address, string Kind, string Section, bool Failed,
    IReadOnlyList<AddressCitation> Citations);

public static partial class AddressCitations
{
    /// <summary>
    /// Plain <c>0x</c> values count as address citations only inside this window above the image
    /// base, so that file offsets and ordinary constants in the same notation are left alone.
    /// </summary>
    public const uint AddressWindow = 0x0100_0000;

    [GeneratedRegex(@"(?<![0-9A-Za-z_])(?<prefix>0x|fn_|g_)(?<address>[0-9A-Fa-f]{8})(?![0-9A-Za-z])")]
    private static partial Regex AddressPattern();

    [GeneratedRegex(@"\bBLD-[A-Za-z0-9._-]*[A-Za-z0-9]")]
    private static partial Regex BuildPattern();

    /// <summary>
    /// Finds address citations in every Markdown file under <paramref name="root"/>. With
    /// <paramref name="build"/> set, a file whose front matter names other builds and not this one
    /// is skipped, since its addresses belong to a different executable.
    /// </summary>
    public static IReadOnlyList<AddressCitation> Find(string root, PortableExecutableImage image, string? build)
    {
        var citations = new List<AddressCitation>();
        foreach (var path in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories)
                     .Order(StringComparer.Ordinal))
        {
            var lines = File.ReadAllLines(path);
            if (build is not null && !AppliesToBuild(lines, build))
            {
                continue;
            }
            var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
            for (var index = 0; index < lines.Length; index++)
            {
                foreach (Match match in AddressPattern().Matches(lines[index]))
                {
                    var address = uint.Parse(match.Groups["address"].Value, NumberStyles.HexNumber,
                        CultureInfo.InvariantCulture);
                    var named = match.Groups["prefix"].Value != "0x";
                    if (!named && address - image.ImageBase >= AddressWindow)
                    {
                        continue;
                    }
                    var rangeEnd = match.Index >= 2 && lines[index].AsSpan(match.Index - 2, 2) is "..";
                    citations.Add(new AddressCitation(address, relative, index + 1,
                        match.Groups["prefix"].Value == "fn_", rangeEnd));
                }
            }
        }
        return citations;
    }

    public static IReadOnlyList<CitedAddress> Check(PortableExecutableImage image,
        IReadOnlyList<AddressCitation> citations, InstructionInventory? instructions)
    {
        var results = new List<CitedAddress>();
        foreach (var group in citations.GroupBy(citation => (citation.Address, citation.IsRangeEnd))
                     .OrderBy(group => group.Key.Address).ThenBy(group => group.Key.IsRangeEnd))
        {
            var (address, rangeEnd) = group.Key;
            var functionName = group.Any(citation => citation.IsFunctionName);
            // A half-open range ends one byte past its last address, which may be the end of a section.
            var probe = rangeEnd ? address - 1 : address;
            var section = image.SectionAt(probe);
            string kind;
            var failed = false;
            if (section is null)
            {
                kind = image.IsHeader(probe) ? "header" : "outside-sections";
                failed = kind == "outside-sections";
            }
            else if (section.IsUninitialized(probe))
            {
                kind = "uninitialized";
            }
            else
            {
                kind = section.IsCode ? "code" : "data";
            }

            if (instructions is not null && section is { IsCode: true } && !rangeEnd)
            {
                kind = instructions.Classify(address);
                if (functionName && !instructions.IsFunctionEntry(address))
                {
                    kind = "not-a-function-entry";
                    failed = true;
                }
            }
            results.Add(new CitedAddress(address, kind, section?.Name ?? "", failed, group.ToList()));
        }
        return results;
    }

    private static bool AppliesToBuild(string[] lines, string build)
    {
        if (lines.Length == 0 || lines[0].Trim() != "---")
        {
            return true;
        }
        var named = new List<string>();
        for (var index = 1; index < lines.Length && lines[index].Trim() != "---"; index++)
        {
            var line = lines[index].TrimStart();
            if (line.StartsWith("build:", StringComparison.Ordinal) || line.StartsWith("builds:", StringComparison.Ordinal))
            {
                named.AddRange(BuildPattern().Matches(line).Select(match => match.Value));
            }
        }
        return named.Count == 0 || named.Contains(build, StringComparer.Ordinal);
    }
}

/// <summary>
/// Instruction boundaries from an <c>*.instructions.tsv</c> file written by
/// <c>tools/ghidra/ExportEditionAnalysis.java</c>.
/// </summary>
public sealed class InstructionInventory
{
    private readonly uint[] starts;
    private readonly uint[] ends;
    private readonly HashSet<uint> functions;

    private InstructionInventory(uint[] starts, uint[] ends, HashSet<uint> functions, string? executableSha256)
    {
        this.starts = starts;
        this.ends = ends;
        this.functions = functions;
        ExecutableSha256 = executableSha256;
    }

    public string? ExecutableSha256 { get; }

    public static InstructionInventory Read(string path)
    {
        string? sha256 = null;
        var rows = new SortedDictionary<uint, uint>();
        var functions = new HashSet<uint>();
        int functionColumn = -1, addressColumn = -1, bytesColumn = -1;
        foreach (var line in File.ReadLines(path))
        {
            if (line.StartsWith('#'))
            {
                const string hashKey = "# executable_sha256=";
                if (line.StartsWith(hashKey, StringComparison.Ordinal))
                {
                    sha256 = line[hashKey.Length..].Trim().ToLowerInvariant();
                }
                continue;
            }
            var fields = line.Split('\t');
            if (addressColumn < 0)
            {
                functionColumn = Array.IndexOf(fields, "function");
                addressColumn = Array.IndexOf(fields, "address");
                bytesColumn = Array.IndexOf(fields, "bytes");
                if (functionColumn < 0 || addressColumn < 0 || bytesColumn < 0)
                {
                    throw new InvalidDataException(
                        $"{path} is not an instruction inventory (needs function, address and bytes columns).");
                }
                continue;
            }
            var address = ParseAddress(fields[addressColumn]);
            rows[address] = address + (uint)(fields[bytesColumn].Length / 2);
            functions.Add(ParseAddress(fields[functionColumn]));
        }
        if (addressColumn < 0)
        {
            throw new InvalidDataException($"{path} has no header row.");
        }
        return new InstructionInventory(rows.Keys.ToArray(), rows.Values.ToArray(), functions, sha256);
    }

    public bool IsFunctionEntry(uint address) => functions.Contains(address);

    public string Classify(uint address)
    {
        var index = Array.BinarySearch(starts, address);
        if (index >= 0)
        {
            return functions.Contains(address) ? "function-entry" : "instruction-start";
        }
        var previous = ~index - 1;
        return previous >= 0 && address < ends[previous] ? "inside-instruction" : "not-disassembled";
    }

    private static uint ParseAddress(string value)
    {
        // Ghidra writes default-space addresses as plain hex, and prefixes other spaces ("ram:").
        var colon = value.LastIndexOf(':');
        return uint.Parse(colon >= 0 ? value[(colon + 1)..] : value, NumberStyles.HexNumber,
            CultureInfo.InvariantCulture);
    }
}
