using System.Net;
using HabitsApp.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Hosting;

namespace HabitsApp.Api.IntegrationTests.Endpoints;

// Spec: v1-test-scenarios / slice 0 — GET /api/health, no token needed.
// 200 only when the app can actually reach its database, so a deploy with a
// broken connection string is caught by the post-deploy health check.
public class HealthEndpointsTests(HabitsApiFactory factory) : IClassFixture<HabitsApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Same app, pointed at a database that isn't there.
    private sealed class UnreachableDatabaseFactory : HabitsApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("ConnectionStrings:Habits",
                "Host=127.0.0.1;Port=1;Database=habits;Username=nobody;Password=nothing;Timeout=2");
        }
    }

    [Fact]
    public async Task Health_is_200_without_a_token_when_the_database_is_reachable()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Health_is_503_when_the_database_is_unreachable()
    {
        await using var unreachable = new UnreachableDatabaseFactory();
        var client = unreachable.CreateClient();

        var response = await client.GetAsync("/api/health", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }
}
