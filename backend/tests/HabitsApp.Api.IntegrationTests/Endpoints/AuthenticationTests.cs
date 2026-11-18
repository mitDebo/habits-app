using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HabitsApp.Api.IntegrationTests.Infrastructure;

namespace HabitsApp.Api.IntegrationTests.Endpoints;

// Spec: v1-test-scenarios / slice 0 — secure by default.
// Every endpoint except /api/health needs a valid, unexpired Supabase access token; otherwise 401.
// Uses the test-only ProtectedProbe endpoint, which has no auth settings of its own.
public class AuthenticationTests(HabitsApiFactory factory) : IClassFixture<HabitsApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<HttpResponseMessage> GetProbeAsync(string? token)
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, ProtectedProbe.Path);
        if (token is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, Ct);
    }

    [Fact]
    public async Task Missing_token_is_rejected_with_401()
    {
        var response = await GetProbeAsync(token: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Garbage_token_is_rejected_with_401()
    {
        var response = await GetProbeAsync("not-a-jwt");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Expired_token_is_rejected_with_401()
    {
        // Well past the default 5-minute clock-skew allowance.
        var token = TestJwt.Create(expires: DateTimeOffset.UtcNow.AddMinutes(-10));

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Token_signed_with_an_untrusted_key_is_rejected_with_401()
    {
        var token = TestJwt.Create(signingKey: TestJwt.UntrustedKey);

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Token_from_another_issuer_is_rejected_with_401()
    {
        var token = TestJwt.Create(issuer: "https://some-other-project.supabase.co/auth/v1");

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Token_for_another_audience_is_rejected_with_401()
    {
        var token = TestJwt.Create(audience: "anon");

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Also proves the "sub" claim reaches the endpoint unrenamed: identity comes only from the token.
    [Fact]
    public async Task Valid_token_is_accepted_and_identifies_the_user()
    {
        var userId = Guid.NewGuid();
        var token = TestJwt.Create(userId: userId);

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ProtectedProbe.Response>(Ct);
        Assert.Equal(userId, body?.UserId);
    }

    // A real token passes even when the app's clock is far from the real one:
    // token expiry uses the real clock, "today" uses the app's TimeProvider.
    [Fact]
    public async Task Moving_the_app_clock_does_not_expire_tokens()
    {
        factory.FakeTime.SetUtcNow(new DateTimeOffset(2040, 1, 1, 0, 0, 0, TimeSpan.Zero));
        var token = TestJwt.Create();

        var response = await GetProbeAsync(token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
