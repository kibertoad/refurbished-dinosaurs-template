using System.Security.Cryptography;
using System.Text;

namespace Restoration.Inspect;

/// <summary>
/// <c>Restoration.Inspect citations</c>: checks that every address cited in the documentation
/// exists in the owned executable it was taken from.
/// </summary>
public static class CitationCommand
{
    private const string Usage =
        "Usage: Restoration.Inspect citations --executable <owned.exe> --docs <directory> " +
        "[--sha256 <expected>] [--xxh3 <expected>] [--build <BLD-id>] [--instructions <edition.instructions.tsv>] [--report <file.csv>]";

    public static int Run(string[] args)
    {
        var executable = Option(args, "--executable");
        var docs = Option(args, "--docs");
        if (string.IsNullOrWhiteSpace(executable) || string.IsNullOrWhiteSpace(docs))
        {
            Console.Error.WriteLine(Usage);
            return 64;
        }

        try
        {
            var bytes = File.ReadAllBytes(executable);
            var sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));
            var expected = Option(args, "--sha256")?.Trim().ToLowerInvariant();
            if (expected is not null && expected != sha256)
            {
                Console.Error.WriteLine($"[citations_failed] {executable} has SHA-256 {sha256}, expected {expected}.");
                return 1;
            }
            // The build manifest in spec/builds gives the executable's xxh3.
            var xxh3 = SpecHash.Xxh3(bytes);
            var expectedXxh3 = Option(args, "--xxh3")?.Trim().ToLowerInvariant();
            if (expectedXxh3 is not null && expectedXxh3 != xxh3)
            {
                Console.Error.WriteLine($"[citations_failed] {executable} has xxh3 {xxh3}, expected {expectedXxh3}.");
                return 1;
            }

            var image = PortableExecutableImage.Read(bytes);
            var instructionsPath = Option(args, "--instructions");
            var instructions = instructionsPath is null ? null : InstructionInventory.Read(instructionsPath);
            if (instructions?.ExecutableSha256 is { } exported && exported != sha256)
            {
                Console.Error.WriteLine(
                    $"[citations_failed] {instructionsPath} was exported from SHA-256 {exported}, not {sha256}.");
                return 1;
            }

            var citations = AddressCitations.Find(docs, image, Option(args, "--build"));
            var results = AddressCitations.Check(image, citations, instructions);

            Console.WriteLine($"executable: {Path.GetFullPath(executable)}");
            Console.WriteLine($"sha256: {sha256}");
            Console.WriteLine($"xxh3: {xxh3}");
            Console.WriteLine($"image: 0x{image.ImageBase:X8}..0x{image.ImageBase + image.SizeOfImage:X8}, " +
                $"{image.Sections.Count} sections");
            Console.WriteLine($"cited addresses: {results.Count} " +
                $"({citations.Count} citations in {citations.Select(citation => citation.File).Distinct().Count()} files)");
            foreach (var kind in results.GroupBy(result => result.Kind).OrderBy(group => group.Key, StringComparer.Ordinal))
            {
                Console.WriteLine($"  {kind.Key}: {kind.Count()}");
            }

            var report = Option(args, "--report");
            if (report is not null)
            {
                WriteReport(report, results);
            }

            var failures = results.Where(result => result.Failed).ToList();
            foreach (var failure in failures)
            {
                Console.Error.WriteLine($"[citation_invalid] 0x{failure.Address:X8} {failure.Kind}: " +
                    string.Join(", ", failure.Citations.Select(citation => $"{citation.File}:{citation.Line}")));
            }
            return failures.Count == 0 ? 0 : 1;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException
                                          or InvalidDataException or FormatException or OverflowException)
        {
            Console.Error.WriteLine($"[citations_failed] {exception.Message}");
            return 1;
        }
    }

    /// <summary>
    /// Writes one row per cited address. The report carries no bytes from the executable, so it
    /// is safe to commit next to the documentation it describes.
    /// </summary>
    private static void WriteReport(string path, IReadOnlyList<CitedAddress> results)
    {
        var text = new StringBuilder("address,kind,section,citations\n");
        foreach (var result in results)
        {
            var address = result.Citations[0].IsRangeEnd ? $"..0x{result.Address:X8}" : $"0x{result.Address:X8}";
            text.Append(address).Append(',').Append(result.Kind).Append(',').Append(result.Section).Append(',')
                .Append(string.Join(';', result.Citations.Select(citation => $"{citation.File}:{citation.Line}")))
                .Append('\n');
        }
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (directory is not null)
        {
            Directory.CreateDirectory(directory);
        }
        File.WriteAllText(path, text.ToString());
    }

    private static string? Option(string[] arguments, string name)
    {
        var index = Array.FindIndex(arguments, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < arguments.Length ? arguments[index + 1] : null;
    }
}
