using UnityEngine;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Entry point of the prototype. Put it on one empty GameObject in an empty scene
    /// (menu "Water Polo 26 > Create Prototype Scene" does it) and press Play.
    /// Flow: QUICK MATCH screen (portrait or landscape) -> landscape match -> full time -> back.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        private readonly QuickMatchOptions _options = new QuickMatchOptions();
        private PreMatchPanel _menu;
        private GameObject _matchRoot;

        private void Awake()
        {
            Application.runInBackground = false;
            if (QualityManager.Instance == null)
            {
                var q = new GameObject("QualityManager");
                DontDestroyOnLoad(q);
                q.AddComponent<QualityManager>();
            }
            ShowMenu();
        }

        private void ShowMenu()
        {
            if (_matchRoot != null) Destroy(_matchRoot);
            Orientation.AllowAll();
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
            EnsureMenuCamera();
            _menu = PreMatchPanel.Create(_options, StartMatch);
        }

        private void StartMatch(QuickMatchOptions options)
        {
            if (_menu != null) Destroy(_menu.gameObject);
            StartCoroutine(Orientation.EnterLandscape());
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            _matchRoot = new GameObject("Match");
            var cfg = options.ToConfig();
            PoolBuilder.Build(cfg).SetParent(_matchRoot.transform, false);

            var runner = _matchRoot.AddComponent<MatchRunner>();
            var home = DemoTeams.Home();
            var away = DemoTeams.Away();
            runner.StartNewMatch(cfg, home, away);

            var actors = new GameObject("Actors").transform;
            actors.SetParent(_matchRoot.transform, false);
            foreach (var p in runner.Sim.Players) PlayerView.Create(runner, p, actors);
            BallView.Create(runner, actors);

            DestroyMenuCamera();
            var cam = SportsCamera.Create(runner);
            cam.transform.SetParent(_matchRoot.transform, false);

            var input = new HumanInputController();
            runner.Input = input;
            PassTargetIndicator.Create(runner, input, actors);

            var hud = MatchHud.Create(runner, input, cam, ShowMenu);
            hud.transform.SetParent(_matchRoot.transform, false);
        }

        private GameObject _menuCamera;

        private void EnsureMenuCamera()
        {
            if (_menuCamera != null) return;
            _menuCamera = new GameObject("Menu Camera");
            var c = _menuCamera.AddComponent<Camera>();
            c.clearFlags = CameraClearFlags.SolidColor;
            c.backgroundColor = new Color(0.04f, 0.1f, 0.18f);
            c.cullingMask = 0;
        }

        private void DestroyMenuCamera()
        {
            if (_menuCamera != null) Destroy(_menuCamera);
            _menuCamera = null;
        }
    }

    /// <summary>Menus may rotate freely; matches are played in landscape.</summary>
    public static class Orientation
    {
        public static void AllowAll()
        {
            Screen.autorotateToPortrait = true;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;
            Screen.orientation = ScreenOrientation.AutoRotation;
        }

        public static System.Collections.IEnumerator EnterLandscape()
        {
            Screen.autorotateToPortrait = false;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;
            // Force landscape first, then re-enable auto-rotation (landscape only, per the flags above)
            // a couple of frames later so the player can still flip the phone.
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            yield return null;
            yield return null;
            Screen.orientation = ScreenOrientation.AutoRotation;
        }
    }
}
