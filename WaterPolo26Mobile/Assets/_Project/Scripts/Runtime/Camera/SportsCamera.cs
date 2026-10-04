using UnityEngine;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Broadcast-style camera: high on the side of the pool, slightly tilted, following
    /// the action with look-ahead in the attacking direction, tightening near the goals,
    /// and a short goal close-up (skippable in settings).
    /// Replay / cinematic cameras: NON IMPLÉMENTÉ (Phase 4, the deterministic sim makes replays cheap).
    /// </summary>
    public sealed class SportsCamera : MonoBehaviour
    {
        public bool GoalCinematics = true;
        /// <summary>Extra horizontal pan from the right-zone drag gesture (metres).</summary>
        public float UserPan;

        private MatchRunner _runner;
        private Camera _cam;
        private Vector3 _focus;
        private Vector3 _focusVelocity;
        private float _goalCamTimer;
        private Vector3 _goalPoint;

        public Camera Camera => _cam;

        public static SportsCamera Create(MatchRunner runner)
        {
            var go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            var cam = go.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.07f, 0.09f, 0.13f);
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 150f;
            go.AddComponent<AudioListener>();
            var sc = go.AddComponent<SportsCamera>();
            sc._runner = runner;
            sc._cam = cam;
            runner.MatchEventRaised += sc.OnMatchEvent;
            return sc;
        }

        private void OnDestroy()
        {
            if (_runner != null) _runner.MatchEventRaised -= OnMatchEvent;
        }

        private void OnMatchEvent(MatchEvent e)
        {
            if (e.Type == MatchEventType.Goal && GoalCinematics)
            {
                _goalCamTimer = 2.4f;
                _goalPoint = MatchRunner.ToUnity(e.Position);
            }
            else if (e.Type == MatchEventType.Restart || e.Type == MatchEventType.PeriodStart)
            {
                _goalCamTimer = 0f;
            }
        }

        private void LateUpdate()
        {
            var sim = _runner.Sim;
            if (sim == null) return;
            var cfg = sim.Config;

            Vector3 ball = _runner.GetBallPosition();
            Vector3 target = ball;
            if (sim.HumanPlayer != null)
                target = Vector3.Lerp(ball, _runner.GetPlayerPosition(sim.HumanPlayer.Id), 0.25f);

            int team = sim.TeamInPossession;
            if (team >= 0) target.x += cfg.AttackSign(team) * 2f;
            target.x += UserPan;
            target.x = Mathf.Clamp(target.x, -cfg.HalfLength + 6f, cfg.HalfLength - 6f);
            target.z = Mathf.Clamp(target.z * 0.35f, -2f, 2f);
            target.y = 0f;

            float nearGoal = Mathf.InverseLerp(6f, 11f, Mathf.Abs(ball.x));
            float height = Mathf.Lerp(12f, 10f, nearGoal);
            float back = cfg.HalfWidth + Mathf.Lerp(11f, 9f, nearGoal);
            float fov = Mathf.Lerp(46f, 40f, nearGoal); // landscape only

            if (_goalCamTimer > 0f)
            {
                _goalCamTimer -= Time.deltaTime;
                target = new Vector3(_goalPoint.x - Mathf.Sign(_goalPoint.x) * 3f, 0f, 0f);
                height = 5f;
                back = 9f;
                fov = 38f;
            }

            // Landscape screens narrower than 16:9 (4:3 tablets): keep the same horizontal view of the pool.
            const float refAspect = 16f / 9f;
            if (_cam.aspect < refAspect)
                fov = 2f * Mathf.Atan(Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad) * refAspect / _cam.aspect) * Mathf.Rad2Deg;

            _focus = Vector3.SmoothDamp(_focus, target, ref _focusVelocity, 0.35f);
            Vector3 desiredPos = _focus + new Vector3(0f, height, -back);
            transform.position = Vector3.Lerp(transform.position, desiredPos, 1f - Mathf.Exp(-Time.deltaTime * 4f));
            transform.rotation = Quaternion.LookRotation(_focus + Vector3.up * 0.5f - transform.position, Vector3.up);
            _cam.fieldOfView = Mathf.Lerp(_cam.fieldOfView, fov, 1f - Mathf.Exp(-Time.deltaTime * 3f));

            UserPan = Mathf.MoveTowards(UserPan, 0f, Time.deltaTime * 2f);
        }
    }
}
