using HabitsApp.Api.Profiles;
using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace HabitsApp.Api.Data;

public class HabitsDbContext(DbContextOptions<HabitsDbContext> options) : DbContext(options)
{
    // Every table, and EF's migration history, lives in this Postgres schema.
    public const string Schema = "habits";

    public DbSet<Profile> Profiles => Set<Profile>();

    // Npgsql settings shared by the app, the EF tools and the tests.
    public static void ConfigureNpgsql(NpgsqlDbContextOptionsBuilder npgsql) =>
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", Schema);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        // Picks up every IEntityTypeConfiguration in this project (Data/Configurations).
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HabitsDbContext).Assembly);
    }
}
