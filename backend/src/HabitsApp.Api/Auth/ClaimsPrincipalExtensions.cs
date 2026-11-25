using System.Security.Claims;

namespace HabitsApp.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    // The signed-in user's id: the token's "sub". Identity never comes from the request body or URL.
    // Only called on endpoints behind the fallback policy, so a valid token (and its "sub") is guaranteed.
    public static Guid UserId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue("sub")!);
}
