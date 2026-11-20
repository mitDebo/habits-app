using HabitsApp.Api.Data;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(HabitsApp.Api.IntegrationTests.Infrastructure.DatabaseFixture))]

namespace HabitsApp.Api.IntegrationTests.Infrastructure;

// One throwaway Postgres (in Docker) for the whole test run, with every EF
// migration applied. Same major version as the Supabase project.
public sealed class DatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    // Read by HabitsApiFactory; set once the container is up.
    public static string ConnectionString { get; private set; } = "";

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    // A context wired the same way as the app's, for tests that look at the database directly.
    public static HabitsDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<HabitsDbContext>()
            .UseNpgsql(ConnectionString, HabitsDbContext.ConfigureNpgsql)
            .Options;
        return new HabitsDbContext(options);
    }

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();
}
