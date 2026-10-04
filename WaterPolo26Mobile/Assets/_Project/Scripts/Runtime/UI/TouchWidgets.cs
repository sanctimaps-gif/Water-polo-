using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Floating virtual joystick: appears where the thumb lands inside its zone.
    /// Pushing to the outer ring (&gt; SprintThreshold) means sprint.
    /// </summary>
    public sealed class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public float Radius = 110f;
        public const float SprintThreshold = 0.92f;

        public RectTransform Base;
        public RectTransform Knob;
        public Image SprintRing;

        public Vector2 Value { get; private set; }
        public bool IsActive { get; private set; }

        private RectTransform _zone;
        private Vector2 _restPosition;
        private Vector2 _origin;

        private void Awake()
        {
            _zone = (RectTransform)transform;
        }

        private void Start()
        {
            _restPosition = Base.anchoredPosition;
        }

        public void OnPointerDown(PointerEventData e)
        {
            IsActive = true;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_zone, e.position, e.pressEventCamera, out _origin);
            // Local points are relative to the zone pivot; the base is anchored to the zone's bottom-left corner.
            Base.anchoredPosition = _origin - _zone.rect.min;
            OnDrag(e);
        }

        public void OnDrag(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_zone, e.position, e.pressEventCamera, out var local);
            Vector2 delta = Vector2.ClampMagnitude(local - _origin, Radius);
            Knob.anchoredPosition = delta;
            Value = delta / Radius;
            if (SprintRing != null) SprintRing.color = Value.magnitude > SprintThreshold ? new Color(1f, 0.8f, 0.2f, 0.9f) : new Color(1f, 1f, 1f, 0.25f);
        }

        public void OnPointerUp(PointerEventData e)
        {
            IsActive = false;
            Value = Vector2.zero;
            Knob.anchoredPosition = Vector2.zero;
            Base.anchoredPosition = _restPosition;
            if (SprintRing != null) SprintRing.color = new Color(1f, 1f, 1f, 0.25f);
        }
    }

    /// <summary>
    /// Touch button with hold / release / swipe-on-release detection.
    /// Press and release are latched and consumed once, so the result does not depend
    /// on script execution order between the EventSystem and the reader.
    /// </summary>
    public sealed class ActionButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IDragHandler
    {
        public Text Label;
        public Image Background;

        public bool IsHeld { get; private set; }
        public float HoldTime => IsHeld ? Time.unscaledTime - _downTime : _lastHoldDuration;
        /// <summary>Drag vector (pixels) of the last release.</summary>
        public Vector2 LastSwipe { get; private set; }
        public float LastHoldDuration => _lastHoldDuration;

        private bool _pressLatched;
        private bool _releaseLatched;
        private float _downTime;
        private float _lastHoldDuration;
        private Vector2 _downPos;
        private Vector2 _currentPos;
        private Color _baseColor;

        private void Awake()
        {
            if (Background != null) _baseColor = Background.color;
        }

        public void OnPointerDown(PointerEventData e)
        {
            IsHeld = true;
            _pressLatched = true;
            _downTime = Time.unscaledTime;
            _downPos = e.position;
            _currentPos = e.position;
            if (Background != null) Background.color = _baseColor * 1.35f;
        }

        public void OnDrag(PointerEventData e)
        {
            _currentPos = e.position;
        }

        public void OnPointerUp(PointerEventData e)
        {
            IsHeld = false;
            _releaseLatched = true;
            _lastHoldDuration = Time.unscaledTime - _downTime;
            LastSwipe = e.position - _downPos;
            if (Background != null) Background.color = _baseColor;
        }

        /// <summary>Current drag while held (pixels).</summary>
        public Vector2 CurrentDrag => IsHeld ? _currentPos - _downPos : Vector2.zero;

        public bool ConsumePress()
        {
            bool v = _pressLatched;
            _pressLatched = false;
            return v;
        }

        public bool ConsumeRelease()
        {
            bool v = _releaseLatched;
            _releaseLatched = false;
            return v;
        }

        public void SetLabel(string text, Color color)
        {
            if (Label != null) Label.text = text;
            if (Background != null && !IsHeld)
            {
                _baseColor = color;
                Background.color = color;
            }
        }
    }

    /// <summary>
    /// Empty right part of the screen: horizontal drag pans the camera,
    /// double tap triggers the contextual action.
    /// </summary>
    public sealed class TouchZone : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerClickHandler
    {
        public float DoubleTapWindow = 0.3f;
        public float PanDelta { get; private set; }

        private bool _doubleTapLatched;
        private float _lastTap = -1f;

        public void OnPointerDown(PointerEventData e) { }

        public void OnDrag(PointerEventData e)
        {
            PanDelta += e.delta.x;
        }

        public void OnPointerClick(PointerEventData e)
        {
            if (e.dragging) return;
            if (Time.unscaledTime - _lastTap < DoubleTapWindow)
            {
                _doubleTapLatched = true;
                _lastTap = -1f;
            }
            else
            {
                _lastTap = Time.unscaledTime;
            }
        }

        public float ConsumePan()
        {
            float v = PanDelta;
            PanDelta = 0f;
            return v;
        }

        public bool ConsumeDoubleTap()
        {
            bool v = _doubleTapLatched;
            _doubleTapLatched = false;
            return v;
        }
    }
}
