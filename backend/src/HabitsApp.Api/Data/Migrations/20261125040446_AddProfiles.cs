using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitsApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "habits");

            migrationBuilder.CreateTable(
                name: "profiles",
                schema: "habits",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    time_zone = table.Column<string>(type: "text", nullable: false),
                    week_start = table.Column<string>(type: "text", nullable: false),
                    date_format = table.Column<string>(type: "text", nullable: false),
                    short_date_format = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profiles", x => x.user_id);
                    table.CheckConstraint("ck_profiles_date_format", "date_format IN ('d-mon-y', 'd-month-y', 'mon-d-y', 'month-d-y', 'mdy-slash', 'dmy-slash', 'iso')");
                    table.CheckConstraint("ck_profiles_short_date_format", "short_date_format IN ('d-mon', 'mon-d', 'm/d', 'd/m', 'm-d')");
                    table.CheckConstraint("ck_profiles_week_start", "week_start IN ('sunday', 'monday')");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "profiles",
                schema: "habits");
        }
    }
}
