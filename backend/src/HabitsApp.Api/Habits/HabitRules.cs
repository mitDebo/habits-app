namespace HabitsApp.Api.Habits;

// What a habit may hold. Errors are keyed by the field's path in the API
// ("name", "settings.step", "settings.options[1].emoji"), ready for a 400.
// Slice 2 stub: nothing is implemented yet, so the slice 2 tests should fail.
public static class HabitRules
{
    // Every kind, in the order the app offers them. Feeds the "kind" check constraint.
    public static IReadOnlyList<string> Kinds { get; } = [];

    // Length as a person counts it: one emoji (even 👨‍👩‍👧 or 👍🏽) is one character.
    public static int TextLength(string text) => throw new NotImplementedException();

    // True for exactly one emoji (with any skin tone, joiners, flags or keycaps), nothing else.
    public static bool IsSingleEmoji(string? text) => throw new NotImplementedException();

    // The habit's name: required, at most 15 characters. Expects it already trimmed.
    public static IReadOnlyDictionary<string, string[]> ValidateName(string? name) =>
        throw new NotImplementedException();

    // The kind's settings. Expects text already trimmed (blank optional text = null).
    public static IReadOnlyDictionary<string, string[]> ValidateSettings(HabitSettings settings) =>
        throw new NotImplementedException();
}
