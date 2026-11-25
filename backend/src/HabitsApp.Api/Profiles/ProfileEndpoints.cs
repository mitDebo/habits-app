using System.Security.Claims;
using HabitsApp.Api.Auth;
using HabitsApp.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HabitsApp.Api.Profiles;

public static class ProfileEndpoints
{
    // POST body: the browser's time zone, used only if the profile doesn't exist yet.
    public sealed record EnsureProfileRequest(string? TimeZone);

    // PATCH body: any subset of the settings; a missing (or null) field is left as it is.
    public sealed record UpdateProfileRequest(
        string? TimeZone, string? WeekStart, string? DateFormat, string? ShortDateFormat);

    // What both endpoints return: the whole profile plus "today" in its time zone.
    public sealed record ProfileResponse(
        string TimeZone, string WeekStart, string DateFormat, string ShortDateFormat, DateOnly Today);

    // Handler parameters always say where they come from: [FromBody], [FromServices], [FromRoute],
    // [FromQuery]. ClaimsPrincipal (HttpContext.User) and CancellationToken (HttpContext.RequestAborted)
    // are filled from the current request and take no attribute.
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/me", EnsureProfile);
        app.MapPatch("/api/me", UpdateProfile);
        return app;
    }

    // First visit: create the profile if it's missing, then return it. 200 either way.
    private static async Task<IResult> EnsureProfile(
        [FromBody] EnsureProfileRequest body,
        ClaimsPrincipal user,
        [FromServices] HabitsDbContext db,
        [FromServices] TimeProvider clock,
        CancellationToken ct)
    {
        if (!ProfileRules.IsValidTimeZone(body.TimeZone))
            return Invalid("timeZone", "Must be an IANA time zone name, such as America/New_York.");

        var userId = user.UserId();
        var profile = await db.Profiles.FindAsync([userId], ct);
        if (profile is null)
        {
            var now = clock.GetUtcNow();
            profile = new Profile
            {
                UserId = userId,
                TimeZone = body.TimeZone!,
                WeekStart = ProfileRules.WeekStarts[0],
                DateFormat = ProfileRules.DateFormats[0],
                ShortDateFormat = ProfileRules.ShortDateFormats[0],
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Profiles.Add(profile);
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Two first visits raced (e.g. two tabs) and the other one won: use its row.
                db.ChangeTracker.Clear();
                profile = await db.Profiles.SingleAsync(p => p.UserId == userId, ct);
            }
        }

        return Results.Ok(ToResponse(profile, clock));
    }

    // Settings: change only the fields sent. Any invalid field rejects the whole request.
    private static async Task<IResult> UpdateProfile(
        [FromBody] UpdateProfileRequest body,
        ClaimsPrincipal user,
        [FromServices] HabitsDbContext db,
        [FromServices] TimeProvider clock,
        CancellationToken ct)
    {
        var profile = await db.Profiles.FindAsync([user.UserId()], ct);
        if (profile is null)
            return Results.NotFound();

        var errors = new Dictionary<string, string[]>();
        if (body.TimeZone is not null && !ProfileRules.IsValidTimeZone(body.TimeZone))
            errors["timeZone"] = ["Must be an IANA time zone name, such as America/New_York."];
        if (body.WeekStart is not null && !ProfileRules.WeekStarts.Contains(body.WeekStart))
            errors["weekStart"] = [$"Must be one of: {string.Join(", ", ProfileRules.WeekStarts)}."];
        if (body.DateFormat is not null && !ProfileRules.DateFormats.Contains(body.DateFormat))
            errors["dateFormat"] = [$"Must be one of: {string.Join(", ", ProfileRules.DateFormats)}."];
        if (body.ShortDateFormat is not null && !ProfileRules.ShortDateFormats.Contains(body.ShortDateFormat))
            errors["shortDateFormat"] = [$"Must be one of: {string.Join(", ", ProfileRules.ShortDateFormats)}."];
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        profile.TimeZone = body.TimeZone ?? profile.TimeZone;
        profile.WeekStart = body.WeekStart ?? profile.WeekStart;
        profile.DateFormat = body.DateFormat ?? profile.DateFormat;
        profile.ShortDateFormat = body.ShortDateFormat ?? profile.ShortDateFormat;
        profile.UpdatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        return Results.Ok(ToResponse(profile, clock));
    }

    private static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static ProfileResponse ToResponse(Profile profile, TimeProvider clock) =>
        new(profile.TimeZone, profile.WeekStart, profile.DateFormat, profile.ShortDateFormat,
            ProfileRules.Today(clock.GetUtcNow(), profile.TimeZone));
}
