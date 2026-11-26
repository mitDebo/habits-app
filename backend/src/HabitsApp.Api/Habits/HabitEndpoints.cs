namespace HabitsApp.Api.Habits;

public static class HabitEndpoints
{
    // Slice 2 stub: the routes exist (so sign-in is still required) but do nothing yet.
    public static IEndpointRouteBuilder MapHabitEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/habits", () => Results.StatusCode(StatusCodes.Status501NotImplemented));
        app.MapGet("/api/habits", () => Results.StatusCode(StatusCodes.Status501NotImplemented));
        return app;
    }
}
