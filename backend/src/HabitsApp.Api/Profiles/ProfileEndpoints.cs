namespace HabitsApp.Api.Profiles;

public static class ProfileEndpoints
{
    // Slice 1 stub: the routes exist (so sign-in is still required) but do nothing yet.
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/me", () => Results.StatusCode(StatusCodes.Status501NotImplemented));
        app.MapPatch("/api/me", () => Results.StatusCode(StatusCodes.Status501NotImplemented));
        return app;
    }
}
