using System;
using UnityEngine;
using UnityEngine.UI;
using WaterPolo.Core.Localization;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>Options chosen on the quick-match screen.</summary>
    public sealed class QuickMatchOptions
    {
        public int HumanTeam;          // 0 = home (Riviera), 1 = away (Northshore)
        public int Difficulty = 1;     // 0 easy, 1 normal, 2 hard
        public AssistLevel Assist = AssistLevel.Standard;
        public int PeriodMinutes = 2;
        public bool ShotTiming = true;

        public static readonly int[] MinuteChoices = { 1, 2, 4, 8 };
        public static readonly float[] DifficultyScale = { 0.75f, 1f, 1.15f };
        public static readonly string[] DifficultyKeys = { "difficulty.easy", "difficulty.normal", "difficulty.hard" };

        public MatchConfig ToConfig()
        {
            return new MatchConfig
            {
                HumanTeam = HumanTeam,
                CpuDifficulty = DifficultyScale[Mathf.Clamp(Difficulty, 0, 2)],
                Assist = Assist,
                PeriodDuration = PeriodMinutes * 60f,
                ShotTimingEnabled = ShotTiming,
                Seed = Environment.TickCount,
            };
        }
    }

    /// <summary>
    /// QUICK MATCH screen (landscape): team, difficulty, assistance,
    /// period length, shot timing, language. PROTOTYPE of the Phase 5 match setup flow.
    /// </summary>
    public sealed class PreMatchPanel : MonoBehaviour
    {
        private QuickMatchOptions _options;
        private Action<QuickMatchOptions> _onPlay;
        private Transform _root;

        public static PreMatchPanel Create(QuickMatchOptions options, Action<QuickMatchOptions> onPlay)
        {
            var canvas = UiFactory.CreateCanvas("Quick Match");
            var panel = canvas.gameObject.AddComponent<PreMatchPanel>();
            panel._options = options;
            panel._onPlay = onPlay;
            panel.Rebuild();
            return panel;
        }

        private void Rebuild()
        {
            if (_root != null) Destroy(_root.gameObject);
            var safe = UiFactory.Stretch("SafeArea", transform);
            safe.gameObject.AddComponent<SafeArea>();
            _root = safe;
            UiFactory.Image(safe, "Bg", null, new Color(0.04f, 0.1f, 0.18f, 1f), raycast: true);

            var title = UiFactory.Text(UiFactory.Rect("Title", safe, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -40f), new Vector2(1200f, 90f)),
                "Text", 64, TextAnchor.MiddleCenter, Color.white);
            title.text = Loc.Get("app.title");
            var sub = UiFactory.Text(UiFactory.Rect("Sub", safe, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -125f), new Vector2(1200f, 60f)),
                "Text", 40, TextAnchor.MiddleCenter, new Color(0.6f, 0.85f, 1f));
            sub.text = Loc.Get("menu.quick_match");

            var home = DemoTeams.Home();
            var away = DemoTeams.Away();
            var my = _options.HumanTeam == 0 ? home : away;

            float y = 170f;
            const float step = 92f;
            Row("menu.team", my.Name, y, () => _options.HumanTeam = 1 - _options.HumanTeam); y -= step;
            Row("menu.difficulty", Loc.Get(QuickMatchOptions.DifficultyKeys[_options.Difficulty]), y, () => _options.Difficulty = (_options.Difficulty + 1) % 3); y -= step;
            Row("menu.assist", Loc.Get(AssistKey(_options.Assist)), y, () => _options.Assist = (AssistLevel)(((int)_options.Assist + 1) % 3)); y -= step;
            Row("menu.duration", Loc.Format("menu.minutes", _options.PeriodMinutes), y, () =>
            {
                int i = Array.IndexOf(QuickMatchOptions.MinuteChoices, _options.PeriodMinutes);
                _options.PeriodMinutes = QuickMatchOptions.MinuteChoices[(i + 1) % QuickMatchOptions.MinuteChoices.Length];
            }); y -= step;
            Row("menu.timing", Loc.Get(_options.ShotTiming ? "value.on" : "value.off"), y, () => _options.ShotTiming = !_options.ShotTiming); y -= step;
            Row("menu.language", Loc.Get("lang.name"), y, () =>
            {
                int i = Array.IndexOf(LocalizationTable.SupportedLanguages, Loc.Language);
                Loc.SetLanguage(LocalizationTable.SupportedLanguages[(i + 1) % LocalizationTable.SupportedLanguages.Length]);
            });

            UiFactory.Button(safe, "Play", Loc.Get("menu.play"), new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(460f, 110f),
                new Color(0.95f, 0.45f, 0.15f, 1f), () => _onPlay?.Invoke(_options));

            var hint = UiFactory.Text(UiFactory.Rect("Hint", safe, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(1700f, 50f)),
                "Text", 24, TextAnchor.MiddleCenter, new Color(1f, 1f, 1f, 0.7f), FontStyle.Normal);
            hint.text = Loc.Get("menu.controls_hint");
        }

        private void Row(string labelKey, string value, float y, Action change)
        {
            var row = UiFactory.Rect(labelKey, _root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, y), new Vector2(900f, 80f));
            var label = UiFactory.Text(UiFactory.Rect("Label", row, new Vector2(0f, 0f), new Vector2(0.5f, 1f), new Vector2(0f, 0.5f), Vector2.zero, Vector2.zero),
                "Text", 34, TextAnchor.MiddleLeft, Color.white, FontStyle.Normal);
            label.text = Loc.Get(labelKey);
            var btn = UiFactory.Button(row, "Value", value, new Vector2(1f, 0.5f), new Vector2(-210f, 0f), new Vector2(420f, 72f),
                new Color(0.15f, 0.35f, 0.6f, 1f), () =>
                {
                    change();
                    Rebuild();
                });
            btn.GetComponentInChildren<Text>().fontSize = 30;
        }

        public static string AssistKey(AssistLevel a)
        {
            switch (a)
            {
                case AssistLevel.Assisted: return "assist.assisted";
                case AssistLevel.Pro: return "assist.pro";
                default: return "assist.standard";
            }
        }
    }
}
