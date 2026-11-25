namespace HabitsApp.Api.IntegrationTests.Infrastructure;

// The app's clock during tests: "now" is whatever the test says, and can move
// backwards as well as forwards (.NET's FakeTimeProvider can only move forwards,
// which doesn't suit tests sharing one app and each picking its own moment).
public sealed class TestClock(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Set(DateTimeOffset now) => _now = now;

    public void Advance(TimeSpan by) => _now += by;
}
