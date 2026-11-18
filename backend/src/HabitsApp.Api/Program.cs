// Slice 0 stub: just enough for the tests to compile. Nothing is wired up yet,
// so every slice 0 test should fail until the real implementation lands.
var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.Run();

// Makes the auto-generated Program class visible to the integration tests,
// which boot the app in memory via WebApplicationFactory<Program>.
public partial class Program { }
