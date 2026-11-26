namespace HabitsApp.Api.Habits;

// A habit's settings: one record per kind (a closed family). The kind itself travels next to
// the settings in the API ("kind": "number", "settings": { ... }) and has its own column.
public abstract record HabitSettings;

// Toggle: tapped to mark a day done. The mark is a check, or a cross ("crossed off", not "missed").
public sealed record ToggleSettings(string Mark = "✓") : HabitSettings;

// Number: a value per day. Steps count from Min (or 0 when there's no Min). The end labels
// ("Awful" … "Great") only make sense when both ends are set. Show: entry / dial / slider.
public sealed record NumberSettings(
    decimal Step,
    decimal? Min = null,
    decimal? Max = null,
    string? Unit = null,
    string? MinLabel = null,
    string? MaxLabel = null,
    string Show = "entry") : HabitSettings;

// Choice: one emoji per day, from the options, in the order given. Show: buttons / dropdown / wheel.
public sealed record ChoiceSettings(IReadOnlyList<ChoiceOption> Options, string Show = "buttons") : HabitSettings;

// One choice option: exactly one emoji (what the grid shows), with an optional name.
public sealed record ChoiceOption(string Emoji, string? Name = null);
