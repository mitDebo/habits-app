using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HabitsApp.Api.Data;

// Used by the EF tools (migrations add / bundle) so they don't need to boot the app
// or any of its configuration. Generating a migration never opens a connection, so the
// connection string is a placeholder; the deploy hands the real one to the bundle.
public sealed class HabitsDbContextFactory : IDesignTimeDbContextFactory<HabitsDbContext>
{
    public HabitsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<HabitsDbContext>()
            .UseNpgsql("Host=localhost;Database=habits_design_time", HabitsDbContext.ConfigureNpgsql)
            .Options;
        return new HabitsDbContext(options);
    }
}
