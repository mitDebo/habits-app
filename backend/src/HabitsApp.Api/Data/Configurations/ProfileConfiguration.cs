using HabitsApp.Api.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HabitsApp.Api.Data.Configurations;

public sealed class ProfileConfiguration : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> profile)
    {
        profile.ToTable("profiles", table =>
        {
            // The database refuses anything ProfileRules wouldn't allow.
            table.HasCheckConstraint("ck_profiles_week_start", $"week_start IN ({SqlList(ProfileRules.WeekStarts)})");
            table.HasCheckConstraint("ck_profiles_date_format", $"date_format IN ({SqlList(ProfileRules.DateFormats)})");
            table.HasCheckConstraint("ck_profiles_short_date_format",
                $"short_date_format IN ({SqlList(ProfileRules.ShortDateFormats)})");
        });

        profile.HasKey(p => p.UserId).HasName("pk_profiles");
        profile.Property(p => p.UserId).HasColumnName("user_id").ValueGeneratedNever();
        profile.Property(p => p.TimeZone).HasColumnName("time_zone");
        profile.Property(p => p.WeekStart).HasColumnName("week_start");
        profile.Property(p => p.DateFormat).HasColumnName("date_format");
        profile.Property(p => p.ShortDateFormat).HasColumnName("short_date_format");
        profile.Property(p => p.CreatedAt).HasColumnName("created_at");
        profile.Property(p => p.UpdatedAt).HasColumnName("updated_at");
    }

    // 'a', 'b', 'c': the ids are our own constants, so quoting them inline is safe.
    private static string SqlList(IEnumerable<string> values) => string.Join(", ", values.Select(v => $"'{v}'"));
}
