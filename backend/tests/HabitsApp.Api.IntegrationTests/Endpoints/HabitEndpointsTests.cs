using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HabitsApp.Api.Habits;
using HabitsApp.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HabitsApp.Api.IntegrationTests.Endpoints;

// Spec: v1-test-scenarios / slice 2 — create & list habits.
// Request:  { "name": "...", "kind": "toggle" | "number" | "choice", "settings": { ... } }
// Response: { "id", "kind", "name", "settings", "schedules" }; settings come back with defaults filled in
// and unset optional fields left out. The detailed settings rules are unit-tested in HabitRulesTests.
public class HabitEndpointsTests(HabitsApiFactory factory) : IClassFixture<HabitsApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed record HabitBody(Guid Id, string Kind, string Name, JsonElement Settings, JsonElement Schedules);

    // One valid habit per kind: what's sent, and the settings expected back.
    // Every kind in HabitRules.Kinds needs an entry, so a new kind can't skip these tests.
    private static readonly Dictionary<string, (string Request, string Settings)> Samples = new()
    {
        ["toggle"] = ("""{"name":"Read","kind":"toggle","settings":{"mark":"✗"}}""", """{"mark":"✗"}"""),
        ["number"] = (
            """{"name":"Pages","kind":"number","settings":{"unit":"pages","min":0,"max":50,"step":1,"show":"dial"}}""",
            """{"unit":"pages","min":0,"max":50,"step":1,"show":"dial"}"""),
        ["choice"] = (
            """{"name":"Lunch","kind":"choice","settings":{"options":[{"emoji":"🥗","name":"Salad"},{"emoji":"🍔"}],"show":"wheel"}}""",
            """{"options":[{"emoji":"🥗","name":"Salad"},{"emoji":"🍔"}],"show":"wheel"}"""),
    };

    public static TheoryData<string> Kinds => [.. HabitRules.Kinds];

    // A signed-in user who has been through first visit (POST /api/me).
    private async Task<HttpClient> NewUser(Guid? userId = null)
    {
        var client = factory.CreateClientFor(userId ?? Guid.NewGuid());
        var response = await client.PostAsJsonAsync("/api/me", new { timeZone = "America/New_York" }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return client;
    }

    private static Task<HttpResponseMessage> PostHabit(HttpClient client, string json) =>
        client.PostAsync("/api/habits", new StringContent(json, Encoding.UTF8, "application/json"), Ct);

    private static async Task<HabitBody> Created(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HabitBody>(Ct))!;
    }

    private static async Task<List<HabitBody>> ListHabits(HttpClient client)
    {
        var response = await client.GetAsync("/api/habits", Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<HabitBody>>(Ct))!;
    }

    private static void AssertJson(string expected, JsonElement actual) =>
        Assert.True(JsonElement.DeepEquals(JsonDocument.Parse(expected).RootElement, actual),
            $"Expected {expected} but got {actual.GetRawText()}");

    // ---- POST /api/habits ----------------------------------------------------------------

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task Every_kind_can_be_created_and_then_listed(string kind)
    {
        Assert.True(Samples.ContainsKey(kind), $"Add a sample for the \"{kind}\" kind.");
        var (request, settings) = Samples[kind];
        var client = await NewUser();

        var habit = await Created(await PostHabit(client, request));

        Assert.Equal(kind, habit.Kind);
        AssertJson(settings, habit.Settings);
        AssertJson("[]", habit.Schedules);
        var listed = Assert.Single(await ListHabits(client));
        Assert.Equal(habit.Id, listed.Id);
        Assert.Equal(habit.Name, listed.Name);
        AssertJson(settings, listed.Settings);
    }

    [Theory]
    [InlineData("""{"name":"Read","kind":"toggle"}""", """{"mark":"✓"}""")]
    [InlineData("""{"name":"Read","kind":"toggle","settings":{}}""", """{"mark":"✓"}""")]
    [InlineData("""{"name":"Pages","kind":"number","settings":{"step":1}}""", """{"step":1,"show":"entry"}""")]
    [InlineData("""{"name":"Lunch","kind":"choice","settings":{"options":[{"emoji":"🥗"},{"emoji":"🍔"}]}}""",
        """{"options":[{"emoji":"🥗"},{"emoji":"🍔"}],"show":"buttons"}""")]
    public async Task Defaults_are_filled_in(string request, string expectedSettings)
    {
        var client = await NewUser();

        var habit = await Created(await PostHabit(client, request));

        AssertJson(expectedSettings, habit.Settings);
    }

    [Fact]
    public async Task Text_is_trimmed_and_blank_optional_text_is_left_out()
    {
        var client = await NewUser();

        var number = await Created(await PostHabit(client,
            """{"name":"  Pages  ","kind":"number","settings":{"unit":"  pages ","step":1}}"""));
        var choice = await Created(await PostHabit(client,
            """{"name":"Lunch","kind":"choice","settings":{"options":[{"emoji":"🥗","name":" Salad "},{"emoji":"🍔","name":"   "}]}}"""));
        var blankUnit = await Created(await PostHabit(client,
            """{"name":"Laps","kind":"number","settings":{"unit":"  ","step":1}}"""));

        Assert.Equal("Pages", number.Name);
        AssertJson("""{"unit":"pages","step":1,"show":"entry"}""", number.Settings);
        AssertJson("""{"options":[{"emoji":"🥗","name":"Salad"},{"emoji":"🍔"}],"show":"buttons"}""", choice.Settings);
        AssertJson("""{"step":1,"show":"entry"}""", blankUnit.Settings);
    }

    [Fact]
    public async Task Number_settings_keep_their_exact_decimals()
    {
        var client = await NewUser();

        await Created(await PostHabit(client,
            """{"name":"Dose","kind":"number","settings":{"min":0.5,"max":2.25,"step":0.00003}}"""));

        var listed = Assert.Single(await ListHabits(client));
        Assert.Equal(0.5m, listed.Settings.GetProperty("min").GetDecimal());
        Assert.Equal(2.25m, listed.Settings.GetProperty("max").GetDecimal());
        Assert.Equal(0.00003m, listed.Settings.GetProperty("step").GetDecimal());
    }

    // A new habit is the first version of itself: its lasting identity (root) is its own id.
    [Fact]
    public async Task A_new_habit_is_stored_as_its_own_first_version()
    {
        var userId = Guid.NewGuid();
        var client = await NewUser(userId);

        var habit = await Created(await PostHabit(client, Samples["number"].Request));

        await using var db = DatabaseFixture.CreateDbContext();
        var row = await db.Database.SqlQuery<HabitRow>($"""
            SELECT user_id AS "UserId", root_id AS "RootId", parent_id AS "ParentId", kind AS "Kind",
                   superseded_at AS "SupersededAt", deleted_at AS "DeletedAt"
            FROM habits.habits WHERE id = {habit.Id}
            """).SingleAsync(Ct);
        Assert.Equal(new HabitRow(userId, habit.Id, null, "number", null, null), row);
    }

    private sealed record HabitRow(
        Guid UserId, Guid RootId, Guid? ParentId, string Kind, DateTime? SupersededAt, DateTime? DeletedAt);

    [Fact]
    public async Task Duplicate_names_are_allowed()
    {
        var client = await NewUser();

        var first = await Created(await PostHabit(client, """{"name":"Read","kind":"toggle"}"""));
        var second = await Created(await PostHabit(client, """{"name":"Read","kind":"toggle"}"""));

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(2, (await ListHabits(client)).Count);
    }

    // A sample of each kind of mistake; HabitRulesTests covers every rule.
    [Theory]
    [InlineData("""{"name":"","kind":"toggle"}""", "name")]
    [InlineData("""{"name":"   ","kind":"toggle"}""", "name")]
    [InlineData("""{"kind":"toggle"}""", "name")]
    [InlineData("""{"name":"Sixteen chars!!!","kind":"toggle"}""", "name")]
    [InlineData("""{"name":"Read","kind":"streak"}""", "kind")]
    [InlineData("""{"name":"Read"}""", "kind")]
    [InlineData("""{"name":"Read","kind":"toggle","settings":{"mark":"x"}}""", "settings.mark")]
    [InlineData("""{"name":"Pages","kind":"number"}""", "settings")]                               // number needs a step
    [InlineData("""{"name":"Pages","kind":"number","settings":{"step":0}}""", "settings.step")]
    [InlineData("""{"name":"Pages","kind":"number","settings":{"step":"lots"}}""", "settings")]   // wrong type
    [InlineData("""{"name":"Lunch","kind":"choice"}""", "settings")]                              // choice needs options
    [InlineData("""{"name":"Lunch","kind":"choice","settings":{"options":[{"emoji":"🥗"}]}}""", "settings.options")]
    [InlineData("""{"name":"Lunch","kind":"choice","settings":{"options":[{"emoji":"🥗"},{"emoji":"a"}]}}""",
        "settings.options[1].emoji")]
    public async Task An_invalid_habit_is_400_naming_the_field_and_saves_nothing(string request, string field)
    {
        var client = await NewUser();

        var response = await PostHabit(client, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>(Ct);
        Assert.Contains(field, problem!.Errors.Keys);
        Assert.Empty(await ListHabits(client));
    }

    [Fact]
    public async Task Post_without_a_token_is_401()
    {
        var response = await PostHabit(factory.CreateClient(), Samples["toggle"].Request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Post_before_the_profile_exists_is_404()
    {
        var client = factory.CreateClientFor(Guid.NewGuid());

        var response = await PostHabit(client, Samples["toggle"].Request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- GET /api/habits -----------------------------------------------------------------

    [Fact]
    public async Task A_new_user_has_no_habits()
    {
        var client = await NewUser();

        Assert.Empty(await ListHabits(client));
    }

    [Fact]
    public async Task Habits_are_listed_oldest_first()
    {
        factory.Clock.Set(new DateTimeOffset(2026, 11, 18, 12, 0, 0, TimeSpan.Zero));
        var client = await NewUser();
        foreach (var name in new[] { "First", "Second", "Third" })
        {
            await Created(await PostHabit(client, $$"""{"name":"{{name}}","kind":"toggle"}"""));
            factory.Clock.Advance(TimeSpan.FromMinutes(1));
        }

        var names = (await ListHabits(client)).Select(h => h.Name);

        Assert.Equal(["First", "Second", "Third"], names);
    }

    [Fact]
    public async Task Other_users_habits_never_appear()
    {
        var alice = await NewUser();
        var bob = await NewUser();
        await Created(await PostHabit(alice, """{"name":"Alice's","kind":"toggle"}"""));

        await Created(await PostHabit(bob, """{"name":"Bob's","kind":"toggle"}"""));

        Assert.Equal(["Alice's"], (await ListHabits(alice)).Select(h => h.Name));
        Assert.Equal(["Bob's"], (await ListHabits(bob)).Select(h => h.Name));
    }

    // Versions and deletes arrive in slices 6 and 7; here the rows are marked by hand.
    [Theory]
    [InlineData("superseded_at")]
    [InlineData("deleted_at")]
    public async Task Only_current_undeleted_versions_are_listed(string column)
    {
        var client = await NewUser();
        var kept = await Created(await PostHabit(client, """{"name":"Kept","kind":"toggle"}"""));
        var hidden = await Created(await PostHabit(client, """{"name":"Hidden","kind":"toggle"}"""));

        await using var db = DatabaseFixture.CreateDbContext();
        // The column name is one of the two literals above, never user input.
        await db.Database.ExecuteSqlRawAsync(
            $"UPDATE habits.habits SET {column} = now() WHERE id = {{0}}", [hidden.Id], Ct);

        Assert.Equal([kept.Id], (await ListHabits(client)).Select(h => h.Id));
    }

    [Fact]
    public async Task Get_without_a_token_is_401()
    {
        var response = await factory.CreateClient().GetAsync("/api/habits", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
