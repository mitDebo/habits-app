namespace HabitsApp.Api.Profiles;

// One user's settings: a row in habits.profiles. Created on first visit, never soft-deleted.
public class Profile
{
    // The Supabase user id (the token's "sub"). No foreign key: auth lives outside our schema.
    public Guid UserId { get; set; }

    public required string TimeZone { get; set; }
    public required string WeekStart { get; set; }
    public required string DateFormat { get; set; }
    public required string ShortDateFormat { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
