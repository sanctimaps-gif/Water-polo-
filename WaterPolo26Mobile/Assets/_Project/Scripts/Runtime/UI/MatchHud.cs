using System;
using UnityEngine;
using UnityEngine.UI;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Landscape match HUD: scoreboard + clocks, contextual touch controls, stamina and
    /// shot-charge bars (with the optional timing window), event toasts, tactic switch,
    /// full-time panel with statistics. Kept deliberately light to leave the pool visible.
    /// </summary>
    public sealed class MatchHud : MonoBehaviour
    {
        private static readonly TacticStyle[] TacticCycle =
        {
            TacticStyle.Balanced, TacticStyle.Fast, TacticStyle.Offensive, TacticStyle.Defensive,
            TacticStyle.Pressure, TacticStyle.Center, TacticStyle.CounterAttack,
        };

        private static readonly Color ButtonShoot = new Color(0.9f, 0.35f, 0.15f, 0.85f);
        private static readonly Color ButtonPass = new Color(0.15f, 0.55f, 0.95f, 0.85f);
        private static readonly Color ButtonDefend = new Color(0.55f, 0.25f, 0.85f, 0.85f);
        private static readonly Color ButtonSwitch = new Color(0.25f, 0.65f, 0.4f, 0.85f);

        private MatchRunner _runner;
        private HumanInputController _input;
        private Action _onExit;

        private Text _homeScore, _awayScore, _clock, _shotClock, _toast, _timing, _tacticLabel, _info;
        private RectTransform _staminaFill, _chargeFill, _chargeRoot, _timingZone;
        private RectTransform _endPanel;
        private Text _endTitle, _endStats;
        private float _toastTimer, _timingTimer;
        private int _tacticIndex;

        public static MatchHud Create(MatchRunner runner, HumanInputController input, SportsCamera camera, Action onExit)
        {
            var canvas = UiFactory.CreateCanvas("Match HUD");
            var hud = canvas.gameObject.AddComponent<MatchHud>();
            hud._runner = runner;
            hud._input = input;
            hud._onExit = onExit;
            hud.Build(canvas.transform, camera);
            runner.MatchEventRaised += hud.OnMatchEvent;
            return hud;
        }

        private void OnDestroy()
        {
            if (_runner != null) _runner.MatchEventRaised -= OnMatchEvent;
        }

        // ------------------------------------------------------------------ construction

        private void Build(Transform canvas, SportsCamera camera)
        {
            var sim = _runner.Sim;
            var safe = UiFactory.Stretch("SafeArea", canvas);
            safe.gameObject.AddComponent<SafeArea>();

            // Touch zones first (behind everything else).
            var rightZone = UiFactory.Rect("RightZone", safe, new Vector2(0.45f, 0f), new Vector2(1f, 0.85f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            rightZone.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            _input.RightZone = rightZone.gameObject.AddComponent<TouchZone>();

            var stickZone = UiFactory.Rect("JoystickZone", safe, new Vector2(0f, 0f), new Vector2(0.45f, 0.75f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            stickZone.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var stick = stickZone.gameObject.AddComponent<VirtualJoystick>();
            var stickBase = UiFactory.Rect("Base", stickZone, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(240f, 240f));
            var ring = UiFactory.Image(stickBase, "SprintRing", UiFactory.Ring, new Color(1f, 1f, 1f, 0.25f));
            UiFactory.Image(stickBase, "Bg", UiFactory.Circle, new Color(1f, 1f, 1f, 0.12f));
            var knob = UiFactory.Rect("Knob", stickBase, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(110f, 110f));
            knob.gameObject.AddComponent<Image>().sprite = UiFactory.Circle;
            knob.GetComponent<Image>().color = new Color(1f, 1f, 1f, 0.6f);
            knob.GetComponent<Image>().raycastTarget = false;
            stick.Base = stickBase;
            stick.Knob = knob;
            stick.SprintRing = ring;
            stickBase.anchoredPosition = new Vector2(250f, 230f);
            _input.Joystick = stick;

            _input.ButtonA = UiFactory.ActionButton(safe, "ButtonA", new Vector2(-200f, 210f), 230f, ButtonShoot);
            _input.ButtonB = UiFactory.ActionButton(safe, "ButtonB", new Vector2(-430f, 130f), 170f, ButtonPass);
            _input.Camera = camera;

            // Scoreboard.
            var board = UiFactory.Rect("Scoreboard", safe, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -16f), new Vector2(640f, 120f));
            UiFactory.Image(board, "Bg", UiFactory.Rounded, new Color(0.05f, 0.08f, 0.14f, 0.82f));
            var home = sim.Teams[0].Definition;
            var away = sim.Teams[1].Definition;
            TeamChip(board, home, new Vector2(-250f, 18f));
            TeamChip(board, away, new Vector2(250f, 18f));
            _homeScore = Label(board, "HomeScore", 64, new Vector2(-70f, 18f), new Vector2(120f, 70f));
            _awayScore = Label(board, "AwayScore", 64, new Vector2(70f, 18f), new Vector2(120f, 70f));
            var dash = Label(board, "Dash", 52, new Vector2(0f, 18f), new Vector2(40f, 70f));
            dash.text = "-";
            _clock = Label(board, "Clock", 30, new Vector2(-40f, -38f), new Vector2(260f, 36f));
            var shotBox = UiFactory.Rect("ShotClockBox", board, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(150f, -38f), new Vector2(72f, 40f));
            UiFactory.Image(shotBox, "Bg", UiFactory.Rounded, new Color(0.9f, 0.2f, 0.15f, 0.9f));
            _shotClock = UiFactory.Text(shotBox, "Value", 28, TextAnchor.MiddleCenter, Color.white);

            // Stamina + shot charge (bottom centre).
            var bars = UiFactory.Rect("Bars", safe, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-80f, 30f), new Vector2(360f, 90f));
            _staminaFill = Bar(bars, "Stamina", new Vector2(0f, 0f), new Vector2(360f, 14f), new Color(0.3f, 0.9f, 0.5f));
            _chargeRoot = UiFactory.Rect("Charge", bars, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 30f), new Vector2(360f, 28f));
            UiFactory.Image(_chargeRoot, "Bg", UiFactory.Rounded, new Color(0f, 0f, 0f, 0.55f));
            _timingZone = UiFactory.Rect("TimingZone", _chargeRoot, new Vector2(ShotTiming.ExcellentMin, 0f), new Vector2(ShotTiming.ExcellentMax, 1f), new Vector2(0f, 0.5f), Vector2.zero, Vector2.zero);
            _timingZone.gameObject.AddComponent<Image>().color = new Color(1f, 0.85f, 0.1f, 0.55f);
            _chargeFill = UiFactory.Rect("Fill", _chargeRoot, new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), Vector2.zero, Vector2.zero);
            _chargeFill.gameObject.AddComponent<Image>().color = new Color(1f, 0.45f, 0.15f, 0.95f);
            _timing = Label(bars, "TimingResult", 34, new Vector2(0f, 95f), new Vector2(360f, 44f));

            _toast = UiFactory.Text(UiFactory.Rect("Toast", safe, new Vector2(0.5f, 0.62f), new Vector2(0.5f, 0.62f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1200f, 160f)),
                "Text", 96, TextAnchor.MiddleCenter, Color.white);

            // Tactic switch (top right) and info (top left).
            var tacticBtn = UiFactory.Button(safe, "Tactic", "", new Vector2(1f, 1f), new Vector2(-190f, -60f), new Vector2(340f, 76f),
                new Color(0.1f, 0.15f, 0.25f, 0.85f), CycleTactic);
            _tacticLabel = tacticBtn.GetComponentInChildren<Text>();
            _tacticLabel.fontSize = 26;
            if (sim.HumanPlayer != null)
                _tacticIndex = Array.IndexOf(TacticCycle, sim.Teams[sim.HumanPlayer.TeamIndex].Tactic);
            RefreshTacticLabel();

            _info = UiFactory.Text(UiFactory.Rect("Info", safe, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(20f, -14f), new Vector2(420f, 60f)),
                "Text", 20, TextAnchor.UpperLeft, new Color(1f, 1f, 1f, 0.7f), FontStyle.Normal);

            BuildEndPanel(safe);
        }

        private void TeamChip(Transform board, TeamDefinition team, Vector2 pos)
        {
            var chip = UiFactory.Rect("Chip " + team.ShortName, board, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), pos, new Vector2(120f, 56f));
            UiFactory.Image(chip, "Bg", UiFactory.Rounded, MaterialFactory.Hex(team.PrimaryColor));
            var t = UiFactory.Text(chip, "Name", 30, TextAnchor.MiddleCenter, Color.white);
            t.text = team.ShortName;
        }

        private static Text Label(Transform parent, string name, int size, Vector2 pos, Vector2 box)
        {
            var rt = UiFactory.Rect(name, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), pos, box);
            return UiFactory.Text(rt, "Text", size, TextAnchor.MiddleCenter, Color.white);
        }

        private static RectTransform Bar(Transform parent, string name, Vector2 pos, Vector2 size, Color fill)
        {
            var root = UiFactory.Rect(name, parent, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), pos, size);
            UiFactory.Image(root, "Bg", UiFactory.Rounded, new Color(0f, 0f, 0f, 0.5f));
            var f = UiFactory.Rect("Fill", root, new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0f, 0.5f), Vector2.zero, Vector2.zero);
            f.gameObject.AddComponent<Image>().color = fill;
            return f;
        }

        private void BuildEndPanel(Transform safe)
        {
            _endPanel = UiFactory.Stretch("EndPanel", safe);
            UiFactory.Image(_endPanel, "Dim", null, new Color(0f, 0f, 0f, 0.7f), raycast: true);
            _endTitle = Label(_endPanel, "Title", 90, new Vector2(0f, 260f), new Vector2(1000f, 120f));
            var statsRt = UiFactory.Rect("Stats", _endPanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 10f), new Vector2(900f, 340f));
            _endStats = UiFactory.Text(statsRt, "Text", 36, TextAnchor.MiddleCenter, Color.white, FontStyle.Normal);
            UiFactory.Button(_endPanel, "Again", Loc.Get("btn.restart"), new Vector2(0.5f, 0.5f), new Vector2(0f, -260f), new Vector2(420f, 100f),
                new Color(0.95f, 0.45f, 0.15f, 1f), () => _onExit?.Invoke());
            _endPanel.gameObject.SetActive(false);
        }

        // ------------------------------------------------------------------ runtime

        private void Update()
        {
            var sim = _runner.Sim;
            if (sim == null) return;

            _homeScore.text = sim.Teams[0].Score.ToString();
            _awayScore.text = sim.Teams[1].Score.ToString();
            float t = Mathf.Max(0f, sim.Rules.PeriodTimeRemaining);
            _clock.text = $"{Loc.Format("hud.period", sim.Rules.Period)}  {(int)t / 60:00}:{(int)t % 60:00}";
            _shotClock.text = Mathf.CeilToInt(Mathf.Max(0f, sim.Rules.ShotClockRemaining)).ToString();

            var me = sim.HumanPlayer;
            if (me != null)
            {
                _staminaFill.anchorMax = new Vector2(Mathf.Clamp01(me.Stamina), 1f);
                _staminaFill.GetComponent<Image>().color = me.SprintLocked ? new Color(0.9f, 0.3f, 0.2f) : new Color(0.3f, 0.9f, 0.5f);
                _chargeRoot.gameObject.SetActive(me.IsChargingShot);
                _chargeFill.anchorMax = new Vector2(me.ShotCharge, 1f);
                _timingZone.gameObject.SetActive(sim.Config.ShotTimingEnabled);
            }

            bool withBall = _input.HasBallContext;
            _input.ButtonA.SetLabel(Loc.Get(withBall ? "btn.shoot" : "btn.defend"), withBall ? ButtonShoot : ButtonDefend);
            _input.ButtonB.SetLabel(Loc.Get(withBall ? "btn.pass" : "btn.switch"), withBall ? ButtonPass : ButtonSwitch);

            if (_toastTimer > 0f)
            {
                _toastTimer -= Time.deltaTime;
                _toast.color = new Color(1f, 1f, 1f, Mathf.Clamp01(_toastTimer * 2f));
            }
            if (_timingTimer > 0f)
            {
                _timingTimer -= Time.deltaTime;
                if (_timingTimer <= 0f) _timing.text = string.Empty;
            }

            var q = QualityManager.Instance != null ? QualityManager.Instance.Current : null;
            float fps = 1f / Mathf.Max(0.0001f, Time.smoothDeltaTime);
            _info.text = $"{Loc.Get("hud.prototype")}  {(q != null ? Loc.Format("label.quality", q.Tier) : string.Empty)}  {fps:0} fps";
        }

        private void OnMatchEvent(MatchEvent e)
        {
            var sim = _runner.Sim;
            int humanTeam = sim.HumanPlayer != null ? sim.HumanPlayer.TeamIndex : -1;
            switch (e.Type)
            {
                case MatchEventType.Goal:
                    Toast(Loc.Get("hud.goal"), 2.5f);
                    if (e.Team == humanTeam) Vibrate();
                    break;
                case MatchEventType.ShotSaved: Toast(Loc.Get("hud.save"), 1.2f); break;
                case MatchEventType.ShotBlocked: Toast(Loc.Get("hud.blocked"), 1f); break;
                case MatchEventType.ShotHitFrame: Toast(Loc.Get("hud.frame"), 1f); break;
                case MatchEventType.PassIntercepted: Toast(Loc.Get("hud.intercepted"), 1f); break;
                case MatchEventType.Steal: Toast(Loc.Get("hud.steal"), 1f); break;
                case MatchEventType.Foul: Toast(Loc.Get("hud.foul"), 0.8f); break;
                case MatchEventType.BallOut: Toast(Loc.Get("hud.out"), 0.8f); break;
                case MatchEventType.ShotClockViolation: Toast(Loc.Get("hud.shotclock_violation"), 1.2f); break;
                case MatchEventType.SwimOff: Toast(Loc.Get("hud.swimoff"), 1.2f); break;
                case MatchEventType.PeriodEnd: Toast(Loc.Format("hud.period_end", (int)e.Value), 2.5f); break;
                case MatchEventType.ShotTaken:
                    if (e.Team == humanTeam && e.OtherPlayerId != (int)TimingQuality.None) ShowTiming((TimingQuality)e.OtherPlayerId);
                    break;
                case MatchEventType.MatchEnd:
                    ShowEndPanel(e.Team, humanTeam);
                    break;
            }
        }

        private void Toast(string text, float seconds)
        {
            _toast.text = text;
            _toastTimer = seconds;
        }

        private void ShowTiming(TimingQuality q)
        {
            string key = q == TimingQuality.Excellent ? "hud.timing.excellent" : (q == TimingQuality.Good ? "hud.timing.good" : "hud.timing.poor");
            _timing.text = Loc.Get(key);
            _timing.color = q == TimingQuality.Excellent ? new Color(1f, 0.85f, 0.1f) : (q == TimingQuality.Good ? Color.white : new Color(1f, 0.4f, 0.3f));
            _timingTimer = 1.2f;
        }

        private void CycleTactic()
        {
            var sim = _runner.Sim;
            if (sim?.HumanPlayer == null) return;
            _tacticIndex = (_tacticIndex + 1) % TacticCycle.Length;
            sim.SetTactic(sim.HumanPlayer.TeamIndex, TacticCycle[_tacticIndex]);
            RefreshTacticLabel();
        }

        private void RefreshTacticLabel()
        {
            if (_tacticIndex < 0) _tacticIndex = 0;
            _tacticLabel.text = $"{Loc.Get("btn.tactic")}: {Loc.Get(TacticKey(TacticCycle[_tacticIndex]))}";
        }

        public static string TacticKey(TacticStyle s)
        {
            switch (s)
            {
                case TacticStyle.Fast: return "tactic.fast";
                case TacticStyle.Offensive: return "tactic.offensive";
                case TacticStyle.Defensive: return "tactic.defensive";
                case TacticStyle.Pressure: return "tactic.pressure";
                case TacticStyle.Center: return "tactic.center";
                case TacticStyle.CounterAttack: return "tactic.counter";
                default: return "tactic.balanced";
            }
        }

        private void ShowEndPanel(int winner, int humanTeam)
        {
            var sim = _runner.Sim;
            _endPanel.gameObject.SetActive(true);
            string title = winner < 0 ? "result.draw" : (winner == humanTeam || humanTeam < 0 ? "result.win" : "result.loss");
            _endTitle.text = $"{Loc.Get(title)}  {sim.Teams[0].Score} - {sim.Teams[1].Score}";

            var a = sim.Stats.Teams[0];
            var b = sim.Stats.Teams[1];
            _endStats.text =
                $"{a.Shots}   {Loc.Get("stats.shots")}   {b.Shots}\n" +
                $"{a.Saves}   {Loc.Get("stats.saves")}   {b.Saves}\n" +
                $"{a.PassAccuracy * 100f:0}%   {Loc.Get("stats.passes")}   {b.PassAccuracy * 100f:0}%\n" +
                $"{sim.Stats.PossessionShare(0) * 100f:0}%   {Loc.Get("stats.possession")}   {sim.Stats.PossessionShare(1) * 100f:0}%\n" +
                $"{a.Steals + a.Interceptions}   {Loc.Get("stats.steals")}   {b.Steals + b.Interceptions}";
        }

        private void Vibrate()
        {
#if UNITY_ANDROID || UNITY_IOS
            if (_input.Settings.Vibration) Handheld.Vibrate();
#endif
        }
    }
}
