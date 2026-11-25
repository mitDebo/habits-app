using System.Net;
using System.Net.Http.Json;
using System.Text;
using HabitsApp.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HabitsApp.Api.IntegrationTests.Endpoints;

// Spec: v1-test-scenarios / slice 1 — profile & settings.
// POST /api/me on first visit creates the profile; PATCH /api/me changes settings.
// Both answer with the whole profile plus "today" in the profile's time zone.
public class ProfileEndpointsTests(HabitsApiFactory factory) : IClassFixture<HabitsApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private const string NewYork = "America/New_York";
    private const string London = "Europe/London";

    // 03:00 UTC on 17 Nov 2026: still the 16th in New York, already the 17th in London.
    private static readonly DateTimeOffset EarlyOnThe17thUtc = new(2026, 11, 17, 3, 0, 0, TimeSpan.Zero);

    private sealed record ProfileBody(
        string TimeZone, string WeekStart, string DateFormat, string ShortDateFormat, DateOnly Today);

    private static async Task<ProfileBody> ReadProfile(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProfileBody>(Ct))!;
    }

    private static Task<HttpResponseMessage> PostMe(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/me", body, Ct);

    private static Task<HttpResponseMessage> PatchMe(HttpClient client, string json) =>
        client.PatchAsync("/api/me", new StringContent(json, Encoding.UTF8, "application/json"), Ct);

    private static async Task AssertBadRequestNaming(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>(Ct);
        Assert.Contains(field, problem!.Errors.Keys);
    }

    // Read straight from the table: updated_at isn't part of the API.
    private static async Task<DateTime> UpdatedAt(Guid userId)
    {
        await using var db = DatabaseFixture.CreateDbContext();
        return await db.Database
            .SqlQuery<DateTime>($"""SELECT updated_at AS "Value" FROM habits.profiles WHERE user_id = {userId}""")
            .SingleAsync(Ct);
    }

    // ---- POST /api/me --------------------------------------------------------------------

    [Fact]
    public async Task First_visit_creates_a_profile_with_the_browser_time_zone_and_the_defaults()
    {
        factory.Clock.Set(new DateTimeOffset(2026, 11, 18, 12, 0, 0, TimeSpan.Zero));
        var client = factory.CreateClientFor(Guid.NewGuid());

        var profile = await ReadProfile(await PostMe(client, new { timeZone = NewYork }));

        Assert.Equal(new ProfileBody(NewYork, "sunday", "d-mon-y", "d-mon", new DateOnly(2026, 11, 18)), profile);
    }

    [Fact]
    public async Task Calling_it_again_returns_the_existing_profile_unchanged()
    {
        var client = factory.CreateClientFor(Guid.NewGuid());
        await ReadProfile(await PostMe(client, new { timeZone = NewYork }));
        await ReadProfile(await PatchMe(client, """{"weekStart":"monday"}"""));

        // e.g. signing in later from a laptop set to another time zone
        var profile = await ReadProfile(await PostMe(client, new { timeZone = London }));

        Assert.Equal(NewYork, profile.TimeZone);
        Assert.Equal("monday", profile.WeekStart);
    }

    [Theory]
    [InlineData("Mars/Base")]
    [InlineData("Eastern Standard Time")] // a Windows name, not IANA
    [InlineData("")]
    public async Task An_invalid_time_zone_is_400_naming_the_field_and_creates_nothing(string timeZone)
    {
        var client = factory.CreateClientFor(Guid.NewGuid());

        var response = await PostMe(client, new { timeZone });

        await AssertBadRequestNaming(response, "timeZone");
        Assert.Equal(HttpStatusCode.NotFound, (await PatchMe(client, """{"weekStart":"monday"}""")).StatusCode);
    }

    [Fact]
    public async Task A_missing_time_zone_is_400_naming_the_field()
    {
        var client = factory.CreateClientFor(Guid.NewGuid());

        var response = await PostMe(client, new { });

        await AssertBadRequestNaming(response, "timeZone");
    }

    [Theory]
    [InlineData(NewYork, "2026-11-16")]
    [InlineData(London, "2026-11-17")]
    [InlineData("Asia/Tokyo", "2026-11-17")]
    public async Task Today_follows_the_profile_time_zone(string timeZone, string expectedToday)
    {
        factory.Clock.Set(EarlyOnThe17thUtc);
        var client = factory.CreateClientFor(Guid.NewGuid());

        var profile = await ReadProfile(await PostMe(client, new { timeZone }));

        Assert.Equal(DateOnly.Parse(expectedToday), profile.Today);
    }

    [Fact]
    public async Task Users_only_ever_get_their_own_profile()
    {
        var alice = factory.CreateClientFor(Guid.NewGuid());
        var bob = factory.CreateClientFor(Guid.NewGuid());
        await ReadProfile(await PostMe(alice, new { timeZone = NewYork }));

        var bobsProfile = await ReadProfile(await PostMe(bob, new { timeZone = London }));
        var alicesProfile = await ReadProfile(await PostMe(alice, new { timeZone = London }));

        Assert.Equal(London, bobsProfile.TimeZone);
        Assert.Equal(NewYork, alicesProfile.TimeZone);
    }

    [Fact]
    public async Task Post_without_a_token_is_401()
    {
        var response = await PostMe(factory.CreateClient(), new { timeZone = NewYork });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---- PATCH /api/me -------------------------------------------------------------------

    [Fact]
    public async Task Patch_changes_only_the_fields_sent()
    {
        var client = factory.CreateClientFor(Guid.NewGuid());
        await ReadProfile(await PostMe(client, new { timeZone = NewYork }));

        var profile = await ReadProfile(await PatchMe(client, """{"weekStart":"monday"}"""));

        Assert.Equal(NewYork, profile.TimeZone);
        Assert.Equal("monday", profile.WeekStart);
        Assert.Equal("d-mon-y", profile.DateFormat);
        Assert.Equal("d-mon", profile.ShortDateFormat);
    }

    [Fact]
    public async Task Patch_can_change_every_setting_at_once_and_returns_the_whole_profile()
    {
        factory.Clock.Set(EarlyOnThe17thUtc);
        var client = factory.CreateClientFor(Guid.NewGuid());
        await ReadProfile(await PostMe(client, new { timeZone = NewYork }));

        var profile = await ReadProfile(await PatchMe(client,
            """{"timeZone":"Europe/London","weekStart":"monday","dateFormat":"iso","shortDateFormat":"m/d"}"""));

        Assert.Equal(new ProfileBody(London, "monday", "iso", "m/d", new DateOnly(2026, 11, 17)), profile);
    }

    [Theory]
    [InlineData("""{"weekStart":"monday","timeZone":"Mars/Base"}""", "timeZone")]
    [InlineData("""{"weekStart":"tuesday"}""", "weekStart")]
    [InlineData("""{"weekStart":"Monday"}""", "weekStart")] // ids are exact, lowercase
    [InlineData("""{"weekStart":"monday","dateFormat":"yyyy/mm/dd"}""", "dateFormat")]
    [InlineData("""{"weekStart":"monday","shortDateFormat":"dd.mm"}""", "shortDateFormat")]
    [InlineData("""{"weekStart":"monday","dateFormat":"d-mon"}""", "dateFormat")] // a short format isn't a long one
    public async Task Patch_with_an_invalid_value_is_400_naming_the_field_and_saves_nothing(string json, string field)
    {
        var client = factory.CreateClientFor(Guid.NewGuid());
        var before = await ReadProfile(await PostMe(client, new { timeZone = NewYork }));

        var response = await PatchMe(client, json);

        await AssertBadRequestNaming(response, field);
        Assert.Equal(before, await ReadProfile(await PostMe(client, new { timeZone = NewYork })));
    }

    [Fact]
    public async Task Today_is_recalculated_when_the_time_zone_changes()
    {
        factory.Clock.Set(EarlyOnThe17thUtc);
        var client = factory.CreateClientFor(Guid.NewGuid());
        var inLondon = await ReadProfile(await PostMe(client, new { timeZone = London }));

        var inNewYork = await ReadProfile(await PatchMe(client, """{"timeZone":"America/New_York"}"""));

        Assert.Equal(new DateOnly(2026, 11, 17), inLondon.Today);
        Assert.Equal(new DateOnly(2026, 11, 16), inNewYork.Today);
    }

    [Fact]
    public async Task Patch_moves_updated_at_forward()
    {
        factory.Clock.Set(new DateTimeOffset(2026, 11, 18, 12, 0, 0, TimeSpan.Zero));
        var userId = Guid.NewGuid();
        var client = factory.CreateClientFor(userId);
        await ReadProfile(await PostMe(client, new { timeZone = NewYork }));
        var before = await UpdatedAt(userId);

        factory.Clock.Advance(TimeSpan.FromHours(1));
        await ReadProfile(await PatchMe(client, """{"weekStart":"monday"}"""));

        Assert.Equal(before.AddHours(1), await UpdatedAt(userId));
    }

    [Fact]
    public async Task Patch_only_changes_the_callers_profile()
    {
        var alice = factory.CreateClientFor(Guid.NewGuid());
        var bob = factory.CreateClientFor(Guid.NewGuid());
        var alicesBefore = await ReadProfile(await PostMe(alice, new { timeZone = NewYork }));
        await ReadProfile(await PostMe(bob, new { timeZone = NewYork }));

        await ReadProfile(await PatchMe(bob, """{"timeZone":"Europe/London","weekStart":"monday"}"""));

        Assert.Equal(alicesBefore, await ReadProfile(await PostMe(alice, new { timeZone = NewYork })));
    }

    [Fact]
    public async Task Patch_without_a_token_is_401()
    {
        var response = await PatchMe(factory.CreateClient(), """{"weekStart":"monday"}""");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Patch_before_the_profile_exists_is_404()
    {
        var client = factory.CreateClientFor(Guid.NewGuid());

        var response = await PatchMe(client, """{"weekStart":"monday"}""");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
