using UnityEngine;
using UnityEngine.UI;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Safety net for the LANDSCAPE ONLY rule. The OS orientation is locked at launch
    /// (<see cref="Orientation.LockLandscape"/>), but if the game window is ever taller than wide
    /// (editor, desktop window, unexpected multi-window), the game pauses behind a
    /// "ROTATE YOUR DEVICE" screen and resumes automatically once it is landscape again.
    /// </summary>
    public sealed class LandscapeGuard : MonoBehaviour
    {
        public static LandscapeGuard Instance { get; private set; }

        private GameObject _overlay;
        private RectTransform _phone;
        private Text _title, _hint;
        private bool _paused;

        public static bool IsPortrait => Screen.height > Screen.width;

        public static LandscapeGuard Create()
        {
            var canvas = UiFactory.CreateCanvas("Landscape Guard");
            canvas.sortingOrder = 32000;
            DontDestroyOnLoad(canvas.gameObject);
            var guard = canvas.gameObject.AddComponent<LandscapeGuard>();
            guard.Build(canvas.transform);
            return guard;
        }

        private void Awake() => Instance = this;

        private void Build(Transform canvas)
        {
            var root = UiFactory.Stretch("Overlay", canvas);
            UiFactory.Image(root, "Bg", null, new Color(0.04f, 0.07f, 0.13f, 1f), raycast: true);
            _phone = UiFactory.Rect("Phone", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 140f), new Vector2(110f, 190f));
            UiFactory.Image(_phone, "Frame", UiFactory.Rounded, Color.white);
            var screen = UiFactory.Rect("Screen", _phone, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-16f, -26f));
            screen.gameObject.AddComponent<Image>().color = new Color(0.1f, 0.45f, 0.75f);
            _title = UiFactory.Text(UiFactory.Rect("Title", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -40f), new Vector2(1000f, 90f)),
                "Text", 60, TextAnchor.MiddleCenter, Color.white);
            _hint = UiFactory.Text(UiFactory.Rect("Hint", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -110f), new Vector2(1000f, 60f)),
                "Text", 34, TextAnchor.MiddleCenter, new Color(1f, 1f, 1f, 0.7f), FontStyle.Normal);
            _overlay = root.gameObject;
            _overlay.SetActive(false);
        }

        private void Update()
        {
            bool portrait = IsPortrait;
            if (portrait != _overlay.activeSelf)
            {
                _overlay.SetActive(portrait);
                _title.text = Loc.Get("hud.rotate");
                _hint.text = Loc.Get("hud.rotate_hint");
            }

            if (portrait && !_paused) { Time.timeScale = 0f; _paused = true; }
            else if (!portrait && _paused) { Time.timeScale = 1f; _paused = false; }

            // Rotation hint animation (unscaled: runs while the game is paused).
            if (portrait)
            {
                float t = Mathf.Repeat(Time.unscaledTime / 2.2f, 1f);
                float angle = t < 0.2f ? 0f : (t < 0.55f ? Mathf.SmoothStep(0f, 90f, (t - 0.2f) / 0.35f) : 90f);
                _phone.localRotation = Quaternion.Euler(0f, 0f, angle);
            }
        }
    }
}
