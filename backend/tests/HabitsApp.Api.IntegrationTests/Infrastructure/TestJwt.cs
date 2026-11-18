using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HabitsApp.Api.IntegrationTests.Infrastructure;

// Mints access tokens shaped like Supabase's (ES256, iss/aud/sub/role),
// signed with a key that exists only inside the test run.
public static class TestJwt
{
    public const string Issuer = "https://test-project.supabase.co/auth/v1";
    public const string Audience = "authenticated";

    // The key the app is told to trust during tests.
    public static readonly ECDsaSecurityKey SigningKey = CreateKey("test-signing-key");

    // A different key the app does NOT trust (simulates a forged token).
    public static readonly ECDsaSecurityKey UntrustedKey = CreateKey("untrusted-key");

    // Token lifetimes use the real clock, never the app's fake one,
    // so tests can move "today" around without expiring their tokens.
    public static string Create(
        Guid? userId = null,
        DateTimeOffset? expires = null,
        string issuer = Issuer,
        string audience = Audience,
        SecurityKey? signingKey = null)
    {
        var expiresAt = expires ?? DateTimeOffset.UtcNow.AddHours(1);
        var issuedAt = expiresAt.AddHours(-1);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            IssuedAt = issuedAt.UtcDateTime,
            NotBefore = issuedAt.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            Subject = new ClaimsIdentity(
            [
                new Claim("sub", (userId ?? Guid.NewGuid()).ToString()),
                new Claim("role", "authenticated"),
            ]),
            SigningCredentials = new SigningCredentials(
                signingKey ?? SigningKey, SecurityAlgorithms.EcdsaSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    private static ECDsaSecurityKey CreateKey(string keyId) =>
        new(ECDsa.Create(ECCurve.NamedCurves.nistP256)) { KeyId = keyId };
}
