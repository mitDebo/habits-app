using HabitsApp.Api.Data;
using HabitsApp.Api.Data.HealthChecks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// The app's clock. Tests swap in a FakeTimeProvider to control "now".
builder.Services.AddSingleton(TimeProvider.System);

// Database: "ConnectionStrings:Habits" comes from user-secrets locally and from the
// HABITS_DB_CONNECTION env var (via docker compose) in production.
builder.Services.AddDbContext<HabitsDbContext>(options =>
    options.UseNpgsql(config.GetConnectionString("Habits"), HabitsDbContext.ConfigureNpgsql));
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

// Authentication: validate Supabase access tokens (JWTs). Authority is the Supabase
// auth issuer; the handler fetches its public signing keys from there, so no secret is stored.
var issuer = config["Auth:Issuer"] ?? throw new InvalidOperationException("Auth:Issuer is not configured.");
var audience = config["Auth:Audience"] ?? "authenticated";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = issuer;
        options.Audience = audience;
        options.TokenValidationParameters.ValidIssuer = issuer;
        options.TokenValidationParameters.ValidAudience = audience;
        // Keep JWT claim names as-is, so "sub" stays "sub".
        options.MapInboundClaims = false;
        // Token expiry always uses the real clock, never the app's (possibly faked) one.
        options.TimeProvider = TimeProvider.System;
    });

// Secure by default: every endpoint needs a signed-in user unless it explicitly opts out.
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// The only anonymous endpoint: 200 when the database is reachable, 503 otherwise.
app.MapHealthChecks("/api/health").AllowAnonymous();

app.Run();

// Makes the auto-generated Program class visible to the integration tests,
// which boot the app in memory via WebApplicationFactory<Program>.
public partial class Program { }
