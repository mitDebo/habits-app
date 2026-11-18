using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitsApp.Api.IntegrationTests.Infrastructure;

// A test-only endpoint added after the app's own pipeline, so slice 0 can prove
// "every endpoint needs a valid token" before any real protected endpoint exists.
// It deliberately carries no [Authorize] of its own: only the app's
// secure-by-default fallback policy stands between it and an anonymous caller.
// It echoes the token's user id, so the valid-token test proves the request really got through.
public sealed class ProtectedProbe : IStartupFilter
{
    public const string Path = "/api/test/protected";

    public sealed record Response(Guid UserId);

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        next(app);
        app.UseRouting();
        app.UseEndpoints(endpoints => endpoints.MapGet(Path, (ClaimsPrincipal user) =>
            new Response(Guid.Parse(user.FindFirstValue("sub")!))));
    };
}
