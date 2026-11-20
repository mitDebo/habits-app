namespace HabitsApp.Api.Profiles;

// What a profile's settings may hold, and what "today" is for a profile.
// Slice 1 stub: nothing is implemented yet, so the slice 1 tests should fail.
public static class ProfileRules
{
    // Allowed week starts; the first is the default.
    public static IReadOnlyList<string> WeekStarts { get; } = [];

    // Allowed long date formats, matching the frontend's ids and order; the first is the default.
    public static IReadOnlyList<string> DateFormats { get; } = [];

    // Allowed short date formats (day and month only), same rules.
    public static IReadOnlyList<string> ShortDateFormats { get; } = [];

    // True only for an IANA time zone name this server knows, such as "America/New_York".
    public static bool IsValidTimeZone(string? timeZone) => throw new NotImplementedException();

    // The calendar day it is right now in the given IANA time zone.
    public static DateOnly Today(DateTimeOffset now, string timeZone) => throw new NotImplementedException();
}
