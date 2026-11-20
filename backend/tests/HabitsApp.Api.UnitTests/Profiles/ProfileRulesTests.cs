using HabitsApp.Api.Profiles;

namespace HabitsApp.Api.UnitTests.Profiles;

public class ProfileRulesTests
{
    // ---- allowed values (ids match frontend/src/settings/dateFormat.ts; first = default) ----

    [Fact]
    public void Week_starts_are_sunday_then_monday()
    {
        Assert.Equal(["sunday", "monday"], ProfileRules.WeekStarts);
    }

    [Fact]
    public void Long_date_formats_match_the_frontend_with_d_mon_y_first()
    {
        Assert.Equal(
            ["d-mon-y", "d-month-y", "mon-d-y", "month-d-y", "mdy-slash", "dmy-slash", "iso"],
            ProfileRules.DateFormats);
    }

    [Fact]
    public void Short_date_formats_match_the_frontend_with_d_mon_first()
    {
        Assert.Equal(["d-mon", "mon-d", "m/d", "d/m", "m-d"], ProfileRules.ShortDateFormats);
    }

    // ---- time zones ----

    [Theory]
    [InlineData("America/New_York")]
    [InlineData("Europe/London")]
    [InlineData("Asia/Kolkata")]
    [InlineData("Australia/Lord_Howe")] // half-hour DST shift
    [InlineData("UTC")]
    public void Iana_time_zones_are_valid(string timeZone)
    {
        Assert.True(ProfileRules.IsValidTimeZone(timeZone));
    }

    [Theory]
    [InlineData("Mars/Base")]
    [InlineData("Eastern Standard Time")] // Windows name: .NET can resolve it, but it isn't IANA
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Anything_else_is_invalid(string? timeZone)
    {
        Assert.False(ProfileRules.IsValidTimeZone(timeZone));
    }

    // ---- today ----

    [Theory]
    [InlineData("2026-11-17T03:00:00Z", "America/New_York", "2026-11-16")] // 22:00 the evening before
    [InlineData("2026-11-17T04:59:59Z", "America/New_York", "2026-11-16")] // one second before local midnight
    [InlineData("2026-11-17T05:00:00Z", "America/New_York", "2026-11-17")] // local midnight (EST, UTC-5)
    [InlineData("2026-07-17T04:00:00Z", "America/New_York", "2026-07-17")] // local midnight in summer (EDT, UTC-4)
    [InlineData("2026-11-16T23:30:00Z", "Asia/Tokyo", "2026-11-17")]       // ahead of UTC
    [InlineData("2026-11-17T03:00:00Z", "UTC", "2026-11-17")]
    public void Today_is_the_calendar_day_in_the_profile_time_zone(string utcNow, string timeZone, string expected)
    {
        var today = ProfileRules.Today(DateTimeOffset.Parse(utcNow), timeZone);

        Assert.Equal(DateOnly.Parse(expected), today);
    }
}
