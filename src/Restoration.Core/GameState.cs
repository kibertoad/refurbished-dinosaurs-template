namespace Restoration.Core;

/// <summary>Replace with the smallest deterministic state needed by the first vertical slice.</summary>
public sealed record GameState(int Turn, int Seed)
{
    public static GameState Create(int seed) => new(1, seed);
    public GameState AdvanceTurn() => this with { Turn = checked(Turn + 1) };
}
