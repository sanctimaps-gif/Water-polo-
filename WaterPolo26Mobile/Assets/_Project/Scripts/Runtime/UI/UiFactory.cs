using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace WaterPolo.Runtime
{
    /// <summary>Builds the prototype UGUI hierarchy from code (no prefabs needed to run the prototype).</summary>
    public static class UiFactory
    {
        private static Font _font;
        private static Sprite _circle;
        private static Sprite _ring;
        private static Sprite _rounded;

        public static Font DefaultFont
        {
            get
            {
                if (_font != null) return _font;
#if UNITY_2022_2_OR_NEWER
                _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
#else
                _font = Resources.GetBuiltinResource<Font>("Arial.ttf");
#endif
                return _font;
            }
        }

        public static Sprite Circle => _circle != null ? _circle : (_circle = MakeCircle(128, 0f));
        public static Sprite Ring => _ring != null ? _ring : (_ring = MakeCircle(128, 0.82f));
        public static Sprite Rounded => _rounded != null ? _rounded : (_rounded = MakeRounded(64, 16));

        public static Canvas CreateCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            EnsureEventSystem();
            return canvas;
        }

        public static void EnsureEventSystem()
        {
            if (EventSystem.current != null) return;
            var go = new GameObject("EventSystem");
            go.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
            go.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
            go.AddComponent<StandaloneInputModule>();
#endif
        }

        public static RectTransform Rect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot,
            Vector2 anchoredPos, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = pivot;
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = size;
            return rt;
        }

        public static RectTransform Stretch(string name, Transform parent)
        {
            var rt = Rect(name, parent, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            return rt;
        }

        public static Image Image(Transform parent, string name, Sprite sprite, Color color, bool raycast = false)
        {
            var rt = Stretch(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = raycast;
            if (sprite == Rounded) img.type = UnityEngine.UI.Image.Type.Sliced;
            return img;
        }

        public static Text Text(Transform parent, string name, int size, TextAnchor anchor, Color color, FontStyle style = FontStyle.Bold)
        {
            var rt = Stretch(name, parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = DefaultFont;
            t.fontSize = size;
            t.alignment = anchor;
            t.color = color;
            t.fontStyle = style;
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            var shadow = rt.gameObject.AddComponent<Shadow>();
            shadow.effectColor = new Color(0f, 0f, 0f, 0.6f);
            shadow.effectDistance = new Vector2(2f, -2f);
            return t;
        }

        public static Button Button(Transform parent, string name, string label, Vector2 anchor, Vector2 pos, Vector2 size,
            Color color, System.Action onClick)
        {
            var rt = Rect(name, parent, anchor, anchor, new Vector2(0.5f, 0.5f), pos, size);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = Rounded;
            img.type = UnityEngine.UI.Image.Type.Sliced;
            img.color = color;
            var btn = rt.gameObject.AddComponent<Button>();
            btn.onClick.AddListener(() => onClick());
            var t = Text(rt, "Label", 34, TextAnchor.MiddleCenter, Color.white);
            t.text = label;
            return btn;
        }

        public static ActionButton ActionButton(Transform parent, string name, Vector2 pos, float diameter, Color color)
        {
            var rt = Rect(name, parent, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0.5f), pos, new Vector2(diameter, diameter));
            var bg = rt.gameObject.AddComponent<Image>();
            bg.sprite = Circle;
            bg.color = color;
            var ab = rt.gameObject.AddComponent<ActionButton>();
            ab.Background = bg;
            ab.Label = Text(rt, "Label", (int)(diameter * 0.17f), TextAnchor.MiddleCenter, Color.white);
            return ab;
        }

        private static Sprite MakeCircle(int size, float innerRatio)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            float r = size * 0.5f;
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(r, r)) / r;
                float outer = Mathf.Clamp01((1f - d) * r);
                float inner = innerRatio > 0f ? Mathf.Clamp01((d - innerRatio) * r) : 1f;
                byte a = (byte)(255 * Mathf.Min(outer, inner));
                px[y * size + x] = new Color32(255, 255, 255, a);
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

        private static Sprite MakeRounded(int size, int radius)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float cx = Mathf.Clamp(x + 0.5f, radius, size - radius);
                float cy = Mathf.Clamp(y + 0.5f, radius, size - radius);
                float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
                byte a = (byte)(255 * Mathf.Clamp01(radius - d));
                px[y * size + x] = new Color32(255, 255, 255, a);
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect,
                new Vector4(radius, radius, radius, radius));
        }
    }

    /// <summary>Keeps UI inside Screen.safeArea (notches, rounded corners, home indicator).</summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeArea : MonoBehaviour
    {
        private Rect _applied;
        private RectTransform _rt;

        private void Awake()
        {
            _rt = (RectTransform)transform;
            Apply();
        }

        private void Update()
        {
            if (_applied != Screen.safeArea) Apply();
        }

        private void Apply()
        {
            Rect s = Screen.safeArea;
            _applied = s;
            if (Screen.width <= 0 || Screen.height <= 0) return;
            _rt.anchorMin = new Vector2(s.xMin / Screen.width, s.yMin / Screen.height);
            _rt.anchorMax = new Vector2(s.xMax / Screen.width, s.yMax / Screen.height);
            _rt.offsetMin = Vector2.zero;
            _rt.offsetMax = Vector2.zero;
        }
    }
}
