using UnityEngine;
using WaterPolo.Core;
using WaterPolo.Simulation;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace WaterPolo.Runtime
{
    /// <summary>Player-configurable control options (persisted by the settings screen, Phase 3).</summary>
    public sealed class ControlSettings
    {
        public bool SwipeGestures = true;
        /// <summary>Joystick pushed to the edge = sprint.</summary>
        public bool EdgeSprint = true;
        /// <summary>Double tap on the right zone: quick shot with the ball, switch player without.</summary>
        public bool DoubleTapAction = true;
        public bool Vibration = true;
        public float SwipeThresholdPixels = 60f;
        public float QuickSwipeSeconds = 0.2f;
        public float LobHoldSeconds = 0.35f;
    }

    /// <summary>
    /// Turns touch widgets (and a keyboard in the editor) into PlayerCommands.
    /// Buttons are contextual: with the ball A = SHOOT, B = PASS; without it A = DEFEND, B = SWITCH.
    /// The context is captured when the button is pressed so a possession change mid-press is safe.
    /// </summary>
    public sealed class HumanInputController
    {
        public readonly ControlSettings Settings = new ControlSettings();
        public VirtualJoystick Joystick;
        public ActionButton ButtonA;
        public ActionButton ButtonB;
        /// <summary>Hold to sprint (alternative to pushing the joystick to its edge).</summary>
        public ActionButton ButtonSprint;
        public TouchZone RightZone;
        public SportsCamera Camera;

        /// <summary>Last world-space move direction (also used by the pass target preview).</summary>
        public Vec3 CurrentWorldMove { get; private set; }

        public bool HasBallContext { get; private set; }

        private bool _aPressedWithBall;
        private bool _bPressedWithBall;

        public void Poll(MatchSimulation sim)
        {
            var me = sim.HumanPlayer;
            if (me == null) return;
            bool hasBall = sim.Ball.Owner == me;
            HasBallContext = hasBall;

            var cmd = new PlayerCommand();

            // ---- movement (camera relative)
            Vector2 stick = Joystick != null ? Joystick.Value : Vector2.zero;
            stick += KeyboardMove();
            stick = Vector2.ClampMagnitude(stick, 1f);
            cmd.Move = ScreenToWorld(stick);
            CurrentWorldMove = cmd.Move;
            cmd.Sprint = (Settings.EdgeSprint && stick.magnitude > VirtualJoystick.SprintThreshold) || KeySprint()
                         || (ButtonSprint != null && ButtonSprint.IsHeld);
            if (ButtonSprint != null) { ButtonSprint.ConsumePress(); ButtonSprint.ConsumeRelease(); }

            // ---- button A: SHOOT (with ball) / DEFEND (without)
            if (ButtonA != null)
            {
                if (ButtonA.ConsumePress())
                {
                    _aPressedWithBall = hasBall;
                    if (!hasBall) cmd.Defend = true;
                }
                if (_aPressedWithBall && hasBall) cmd.ShootHeld = ButtonA.IsHeld;
                if (ButtonA.ConsumeRelease() && _aPressedWithBall)
                {
                    cmd.ShootReleased = true;
                    ApplyShotSwipe(sim, ref cmd, ButtonA.LastSwipe, ButtonA.LastHoldDuration);
                    _aPressedWithBall = false;
                }
            }

            // ---- button B: PASS (with ball) / SWITCH (without)
            if (ButtonB != null)
            {
                if (ButtonB.ConsumePress())
                {
                    _bPressedWithBall = hasBall;
                    if (!hasBall) sim.SwitchHumanPlayer();
                }
                if (ButtonB.ConsumeRelease() && _bPressedWithBall)
                {
                    cmd.Pass = true;
                    Vector2 swipe = ButtonB.LastSwipe;
                    cmd.PassDirection = Settings.SwipeGestures && swipe.magnitude > Settings.SwipeThresholdPixels
                        ? ScreenToWorld(swipe.normalized)
                        : cmd.Move;
                    cmd.LobPass = ButtonB.LastHoldDuration > Settings.LobHoldSeconds;
                    _bPressedWithBall = false;
                }
            }

            // ---- right zone: camera pan + double tap
            if (RightZone != null)
            {
                if (Camera != null) Camera.UserPan = Mathf.Clamp(Camera.UserPan + RightZone.ConsumePan() * 0.02f, -6f, 6f);
                if (RightZone.ConsumeDoubleTap() && Settings.DoubleTapAction)
                {
                    if (hasBall) cmd.QuickShot = true;
                    else sim.SwitchHumanPlayer();
                }
            }

            KeyboardActions(sim, hasBall, ref cmd);
            sim.SetHumanCommand(cmd);
        }

        private void ApplyShotSwipe(MatchSimulation sim, ref PlayerCommand cmd, Vector2 swipe, float holdDuration)
        {
            if (!Settings.SwipeGestures || swipe.magnitude < Settings.SwipeThresholdPixels) return;
            var me = sim.HumanPlayer;
            float sign = sim.Config.AttackSign(me.TeamIndex);
            Vector2 n = swipe / Mathf.Max(1f, Screen.height * 0.25f);
            // Screen up = far post (+Z). "Right as seen by the shooter" is -Z when attacking +X.
            cmd.HasAim = true;
            cmd.AimX = Mathf.Clamp(-sign * n.y, -1.2f, 1.2f);
            // Swiping toward the goal = higher shot.
            cmd.AimY = Mathf.Clamp01(0.4f + n.x * sign * 0.6f);
            if (holdDuration < Settings.QuickSwipeSeconds) cmd.QuickShot = true;
        }

        /// <summary>Joystick/swipe screen vector to a flat world direction using the camera orientation.</summary>
        private Vec3 ScreenToWorld(Vector2 v)
        {
            Transform cam = Camera != null ? Camera.transform : null;
            Vector3 right = cam != null ? cam.right : Vector3.right;
            Vector3 fwd = cam != null ? Vector3.ProjectOnPlane(cam.forward, Vector3.up).normalized : Vector3.forward;
            right.y = 0f;
            right.Normalize();
            Vector3 w = right * v.x + fwd * v.y;
            return new Vec3(w.x, 0f, w.z);
        }

        // ------------------------------------------------------------------ keyboard (editor / desktop testing)

        private static Vector2 KeyboardMove()
        {
            Vector2 v = Vector2.zero;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k == null) return v;
            if (k.wKey.isPressed || k.upArrowKey.isPressed) v.y += 1f;
            if (k.sKey.isPressed || k.downArrowKey.isPressed) v.y -= 1f;
            if (k.dKey.isPressed || k.rightArrowKey.isPressed) v.x += 1f;
            if (k.aKey.isPressed || k.leftArrowKey.isPressed) v.x -= 1f;
#elif ENABLE_LEGACY_INPUT_MANAGER
            if (UnityEngine.Input.GetKey(KeyCode.W) || UnityEngine.Input.GetKey(KeyCode.UpArrow)) v.y += 1f;
            if (UnityEngine.Input.GetKey(KeyCode.S) || UnityEngine.Input.GetKey(KeyCode.DownArrow)) v.y -= 1f;
            if (UnityEngine.Input.GetKey(KeyCode.D) || UnityEngine.Input.GetKey(KeyCode.RightArrow)) v.x += 1f;
            if (UnityEngine.Input.GetKey(KeyCode.A) || UnityEngine.Input.GetKey(KeyCode.LeftArrow)) v.x -= 1f;
#endif
            return v;
        }

        private static bool KeySprint()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null && Keyboard.current.leftShiftKey.isPressed;
#elif ENABLE_LEGACY_INPUT_MANAGER
            return UnityEngine.Input.GetKey(KeyCode.LeftShift);
#else
            return false;
#endif
        }

        /// <summary>J = pass, K (hold) = shoot, L = defend, Q = switch.</summary>
        private static void KeyboardActions(MatchSimulation sim, bool hasBall, ref PlayerCommand cmd)
        {
            bool pass = false, shootHeld = false, shootUp = false, defend = false, swap = false;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k == null) return;
            pass = k.jKey.wasPressedThisFrame;
            shootHeld = k.kKey.isPressed;
            shootUp = k.kKey.wasReleasedThisFrame;
            defend = k.lKey.wasPressedThisFrame;
            swap = k.qKey.wasPressedThisFrame;
#elif ENABLE_LEGACY_INPUT_MANAGER
            pass = UnityEngine.Input.GetKeyDown(KeyCode.J);
            shootHeld = UnityEngine.Input.GetKey(KeyCode.K);
            shootUp = UnityEngine.Input.GetKeyUp(KeyCode.K);
            defend = UnityEngine.Input.GetKeyDown(KeyCode.L);
            swap = UnityEngine.Input.GetKeyDown(KeyCode.Q);
#endif
            if (hasBall)
            {
                if (pass) cmd.Pass = true;
                if (shootHeld) cmd.ShootHeld = true;
                if (shootUp) cmd.ShootReleased = true;
            }
            else
            {
                if (defend) cmd.Defend = true;
                if (swap) sim.SwitchHumanPlayer();
            }
        }
    }
}
