using Microsoft.EntityFrameworkCore.Design;

namespace HabitsApp.Api.Data;

// Used by the EF tools (migrations add / bundle) so they don't need to boot the app.
// Slice 0 stub: not implemented yet.
public sealed class HabitsDbContextFactory : IDesignTimeDbContextFactory<HabitsDbContext>
{
    public HabitsDbContext CreateDbContext(string[] args) => throw new NotImplementedException();
}
