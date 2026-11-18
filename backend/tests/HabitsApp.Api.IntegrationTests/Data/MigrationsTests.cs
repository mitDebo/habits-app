using HabitsApp.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HabitsApp.Api.IntegrationTests.Data;

// Everything the app owns lives in the "habits" schema, including EF's own
// bookkeeping, so nothing leaks into Supabase's public schema.
public class MigrationsTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Migrations_are_recorded_in_the_habits_schema()
    {
        await using var db = DatabaseFixture.CreateDbContext();

        var exists = await db.Database
            .SqlQueryRaw<bool>("""SELECT to_regclass('habits."__EFMigrationsHistory"') IS NOT NULL AS "Value" """)
            .SingleAsync(Ct);

        Assert.True(exists);
    }

    [Fact]
    public async Task Nothing_is_created_in_the_public_schema()
    {
        await using var db = DatabaseFixture.CreateDbContext();

        var publicTables = await db.Database
            .SqlQueryRaw<int>("""SELECT count(*)::int AS "Value" FROM information_schema.tables WHERE table_schema = 'public'""")
            .SingleAsync(Ct);

        Assert.Equal(0, publicTables);
    }
}
