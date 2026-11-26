using HabitsApp.Api.Habits;

namespace HabitsApp.Api.UnitTests.Habits;

public class HabitRulesTests
{
    private static void AssertValid(IReadOnlyDictionary<string, string[]> errors) =>
        Assert.True(errors.Count == 0, "Unexpected errors: " + string.Join(", ", errors.Keys));

    private static void AssertInvalid(IReadOnlyDictionary<string, string[]> errors, string field) =>
        Assert.Contains(field, errors.Keys);

    private static ChoiceSettings Choice(params string[] emoji) => new([.. emoji.Select(e => new ChoiceOption(e))]);

    // ---- kinds ----

    [Fact]
    public void Kinds_are_toggle_number_and_choice()
    {
        Assert.Equal(["toggle", "number", "choice"], HabitRules.Kinds);
    }

    // ---- counting characters the way a person does ----

    [Theory]
    [InlineData("Read", 4)]
    [InlineData("Read 📚", 6)]
    [InlineData("👍🏽", 1)]      // thumbs up + skin tone
    [InlineData("👨‍👩‍👧", 1)]    // three people joined by zero-width joiners
    [InlineData("🇺🇸", 1)]      // a flag: two regional indicators
    [InlineData("cafe\u0301", 4)] // é written as e + combining accent
    public void Text_length_counts_what_a_person_sees(string text, int expected)
    {
        Assert.Equal(expected, HabitRules.TextLength(text));
    }

    // ---- emoji ----

    [Theory]
    [InlineData("🥗")]
    [InlineData("😀")]
    [InlineData("👍🏽")]
    [InlineData("👨‍👩‍👧")]
    [InlineData("🇺🇸")]
    [InlineData("❤️")]   // heart + emoji presentation selector
    [InlineData("1️⃣")]  // keycap
    [InlineData("✅")]
    public void A_single_emoji_is_an_emoji(string text)
    {
        Assert.True(HabitRules.IsSingleEmoji(text));
    }

    [Theory]
    [InlineData("a")]
    [InlineData("1")]
    [InlineData("🥗🥗")]
    [InlineData("😀a")]
    [InlineData(" 🥗")]
    [InlineData("")]
    [InlineData(null)]
    public void Anything_else_is_not_a_single_emoji(string? text)
    {
        Assert.False(HabitRules.IsSingleEmoji(text));
    }

    // ---- name ----

    [Theory]
    [InlineData("Read")]
    [InlineData("Fifteen chars!!")]       // exactly 15
    [InlineData("📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚")] // 15 emoji
    public void Names_up_to_15_characters_are_valid(string name)
    {
        AssertValid(HabitRules.ValidateName(name));
    }

    [Theory]
    [InlineData("Sixteen chars!!!")]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_or_long_names_are_invalid(string? name)
    {
        AssertInvalid(HabitRules.ValidateName(name), "name");
    }

    // ---- toggle ----

    [Theory]
    [InlineData("✓")]
    [InlineData("✗")]
    public void Toggle_marks_are_check_or_cross(string mark)
    {
        AssertValid(HabitRules.ValidateSettings(new ToggleSettings(mark)));
    }

    [Theory]
    [InlineData("x")]
    [InlineData("✔")] // a different check character
    [InlineData("")]
    public void Any_other_toggle_mark_is_invalid(string mark)
    {
        AssertInvalid(HabitRules.ValidateSettings(new ToggleSettings(mark)), "settings.mark");
    }

    // ---- number ----

    public static TheoryData<NumberSettings> ValidNumbers => new()
    {
        new NumberSettings(Step: 1m),
        new NumberSettings(Step: 1m, Min: 0m, Max: 50m, Unit: "pages"),
        new NumberSettings(Step: 3m),
        new NumberSettings(Step: 0.01m),
        new NumberSettings(Step: 0.00003m),
        new NumberSettings(Step: 0.0000000001m),                 // exactly 10 decimal places
        new NumberSettings(Step: 4m, Min: 1m, Max: 10m),          // max off-step: highest reachable is 9
        new NumberSettings(Step: 0.5m, Min: -5m, Max: 5m),
        new NumberSettings(Step: 1m, Min: 1m, Max: 5m, MinLabel: "Awful", MaxLabel: "Great"),
        new NumberSettings(Step: 1m, Min: 0m, Max: 10m, Show: "slider"),
        new NumberSettings(Step: 1m, Show: "dial"),               // a dial doesn't need ends
        new NumberSettings(Step: 1m, Min: 0m),                    // one end only
        new NumberSettings(Step: 1m, Unit: "Fifteen chars!!"),
    };

    [Theory]
    [MemberData(nameof(ValidNumbers))]
    public void Valid_number_settings_pass(NumberSettings settings)
    {
        AssertValid(HabitRules.ValidateSettings(settings));
    }

    public static TheoryData<NumberSettings, string> InvalidNumbers => new()
    {
        { new NumberSettings(Step: 0m), "settings.step" },
        { new NumberSettings(Step: -1m), "settings.step" },
        { new NumberSettings(Step: 0.00000000001m), "settings.step" },                 // 11 decimal places
        { new NumberSettings(Step: 1m, Min: 5m, Max: 5m), "settings.max" },            // min must be below max
        { new NumberSettings(Step: 1m, Min: 6m, Max: 5m), "settings.max" },
        { new NumberSettings(Step: 1m, Unit: "Sixteen chars!!!"), "settings.unit" },
        { new NumberSettings(Step: 1m, Min: 1m, MinLabel: "Awful"), "settings.minLabel" }, // labels need both ends
        { new NumberSettings(Step: 1m, Max: 5m, MaxLabel: "Great"), "settings.maxLabel" },
        { new NumberSettings(Step: 1m, Min: 1m, Max: 5m, MinLabel: "Sixteen chars!!!"), "settings.minLabel" },
        { new NumberSettings(Step: 1m, Min: 1m, Max: 5m, MaxLabel: "Sixteen chars!!!"), "settings.maxLabel" },
        { new NumberSettings(Step: 1m, Show: "box"), "settings.show" },
        { new NumberSettings(Step: 1m, Min: 0m, Show: "slider"), "settings.show" },     // a slider needs both ends
    };

    [Theory]
    [MemberData(nameof(InvalidNumbers))]
    public void Invalid_number_settings_name_the_field(NumberSettings settings, string field)
    {
        AssertInvalid(HabitRules.ValidateSettings(settings), field);
    }

    // ---- choice ----

    public static TheoryData<ChoiceSettings> ValidChoices => new()
    {
        Choice("🥗", "🍔"),
        Choice("😀", "🙂", "😐", "🙁", "😞"),
        Choice("👍🏽", "👎🏽", "🇺🇸", "1️⃣"),
        new ChoiceSettings([new("🥗", "Salad"), new("🍔", "Twenty characters!!!")]), // name exactly 20
        Choice("🥗", "🍔") with { Show = "dropdown" },
        Choice("🥗", "🍔") with { Show = "wheel" },
    };

    [Theory]
    [MemberData(nameof(ValidChoices))]
    public void Valid_choice_settings_pass(ChoiceSettings settings)
    {
        AssertValid(HabitRules.ValidateSettings(settings));
    }

    public static TheoryData<ChoiceSettings, string> InvalidChoices => new()
    {
        { Choice(), "settings.options" },
        { Choice("🥗"), "settings.options" },                       // at least two
        { Choice("🥗", "a"), "settings.options[1].emoji" },
        { Choice("🥗🍔", "😀"), "settings.options[0].emoji" },       // one emoji per option
        { Choice("🥗", ""), "settings.options[1].emoji" },
        { Choice("🥗", "🍔", "🥗"), "settings.options[2].emoji" },   // no two the same
        { new ChoiceSettings([new("🥗", "Twenty-one characters"), new("🍔")]), "settings.options[0].name" },
        { Choice("🥗", "🍔") with { Show = "list" }, "settings.show" },
    };

    [Theory]
    [MemberData(nameof(InvalidChoices))]
    public void Invalid_choice_settings_name_the_field(ChoiceSettings settings, string field)
    {
        AssertInvalid(HabitRules.ValidateSettings(settings), field);
    }
}
