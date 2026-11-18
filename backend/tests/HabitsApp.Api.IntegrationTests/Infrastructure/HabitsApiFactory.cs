using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace HabitsApp.Api.IntegrationTests.Infrastructure;

// Boots the real app in memory against the test database, trusting only TestJwt's key.
public class HabitsApiFactory : WebApplicationFactory<Program>
{
    // What "now" is for the app. Tests move it to whatever moment they need.
    public FakeTimeProvider FakeTime { get; } = new(new DateTimeOffset(2026, 11, 18, 12, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Same settings the app reads in production, pointed at test values.
        builder.UseSetting("Auth:Issuer", TestJwt.Issuer);
        builder.UseSetting("Auth:Audience", TestJwt.Audience);
        builder.UseSetting("ConnectionStrings:Habits", DatabaseFixture.ConnectionString);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(FakeTime);

            services.AddSingleton<IStartupFilter, ProtectedProbe>();

            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                // Token expiry always uses the real clock (see TestJwt).
                options.TimeProvider = TimeProvider.System;

                // Never contact Supabase from tests: hand the handler a fixed
                // configuration containing only the test signing key.
                var configuration = new OpenIdConnectConfiguration { Issuer = TestJwt.Issuer };
                configuration.SigningKeys.Add(TestJwt.SigningKey);
                options.Configuration = configuration;
                options.ConfigurationManager = null!;
                options.TokenValidationParameters.IssuerSigningKeyResolver = null!;
                options.TokenValidationParameters.IssuerSigningKeys = [TestJwt.SigningKey];
            });
        });
    }
}
