using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace HabitsApp.Api.Data.HealthChecks;

// Healthy only if the app can actually open a connection with its configured credentials.
public sealed class DatabaseHealthCheck(HabitsDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default) =>
        await db.Database.CanConnectAsync(ct)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Cannot reach the database.");
}
