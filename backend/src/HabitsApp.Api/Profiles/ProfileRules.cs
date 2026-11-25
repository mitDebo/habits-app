namespace HabitsApp.Api.Profiles;

// What a profile's settings may hold, and what "today" is for a profile.
// The lists are also enforced by check constraints on habits.profiles.
public static class ProfileRules
{
    // Allowed week starts; the first is the default.
    public static IReadOnlyList<string> WeekStarts { get; } = ["sunday", "monday"];

    // Allowed long date formats, matching the frontend's ids and order
    // (frontend/src/settings/dateFormat.ts); the first is the default.
    public static IReadOnlyList<string> DateFormats { get; } =
        ["d-mon-y", "d-month-y", "mon-d-y", "month-d-y", "mdy-slash", "dmy-slash", "iso"];

    // Allowed short date formats (day and month only), same rules.
    public static IReadOnlyList<string> ShortDateFormats { get; } = ["d-mon", "mon-d", "m/d", "d/m", "m-d"];

    // True only for an IANA time zone name this server knows, such as "America/New_York".
    // .NET also resolves Windows names ("Eastern Standard Time"); those aren't IANA, so they're refused.
    public static bool IsValidTimeZone(string? timeZone) =>
        !string.IsNullOrWhiteSpace(timeZone)
        && TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out var zone)
        && zone.HasIanaId;

    // The calendar day it is right now in the given IANA time zone.
    public static DateOnly Today(DateTimeOffset now, string timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(timeZone));
        return DateOnly.FromDateTime(local.DateTime);
    }
}
