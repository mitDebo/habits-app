using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace HabitsApp.Api.Data;

// Slice 0 stub: no tables yet (profiles arrive in slice 1), and the schema
// isn't applied yet, so the schema tests should fail.
public class HabitsDbContext(DbContextOptions<HabitsDbContext> options) : DbContext(options)
{
    // Every table, and EF's migration history, lives in this Postgres schema.
    public const string Schema = "habits";

    // Npgsql settings shared by the app, the EF tools and the tests.
    public static void ConfigureNpgsql(NpgsqlDbContextOptionsBuilder npgsql)
    {
    }
}
