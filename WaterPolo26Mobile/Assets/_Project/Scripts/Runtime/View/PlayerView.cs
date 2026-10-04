using UnityEngine;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// PROTOTYPE swimmer: primitives + procedural motion (bobbing, lean, raised arm).
    /// Reads the simulation, never writes to it. Phase 4 swaps in skinned meshes and animations.
    /// </summary>
    public sealed class PlayerView : MonoBehaviour
    {
        private static readonly Color Skin = new Color(0.93f, 0.76f, 0.62f);
        private static readonly Color GoalkeeperCap = new Color(0.85f, 0.1f, 0.12f);

        private MatchRunner _runner;
        private SimPlayer _player;
        private Transform _body;
        private Transform _arm;
        private GameObject _selection;
        private TextMesh _number;
        private float _phase;

        public SimPlayer Player => _player;

        public static PlayerView Create(MatchRunner runner, SimPlayer player, Transform parent)
        {
            var go = new GameObject($"Player {player.TeamIndex}-{player.Number}");
            go.transform.SetParent(parent, false);
            var view = go.AddComponent<PlayerView>();
            view.Init(runner, player);
            return view;
        }

        private void Init(MatchRunner runner, SimPlayer player)
        {
            _runner = runner;
            _player = player;
            _phase = player.Id * 0.77f;

            var team = runner.Sim.Teams[player.TeamIndex].Definition;
            Color kit = MaterialFactory.Hex(team.PrimaryColor);
            Color cap = player.IsGoalkeeper ? GoalkeeperCap : kit;

            _body = new GameObject("Body").transform;
            _body.SetParent(transform, false);
            PoolBuilder.Primitive(PrimitiveType.Capsule, _body, "Torso", new Vector3(0f, -0.25f, 0f), new Vector3(0.5f, 0.45f, 0.4f), Quaternion.identity, kit);
            PoolBuilder.Primitive(PrimitiveType.Sphere, _body, "Head", new Vector3(0f, 0.32f, 0f), new Vector3(0.24f, 0.26f, 0.24f), Quaternion.identity, Skin);
            PoolBuilder.Primitive(PrimitiveType.Sphere, _body, "Cap", new Vector3(0f, 0.38f, 0f), new Vector3(0.26f, 0.18f, 0.26f), Quaternion.identity, cap);

            _arm = new GameObject("ArmPivot").transform;
            _arm.SetParent(_body, false);
            _arm.localPosition = new Vector3(0f, 0.12f, -0.2f);
            PoolBuilder.Primitive(PrimitiveType.Capsule, _arm, "Arm", new Vector3(0f, 0.3f, 0f), new Vector3(0.1f, 0.3f, 0.1f), Quaternion.identity, Skin);

            _selection = PoolBuilder.Primitive(PrimitiveType.Cylinder, transform, "Selection", new Vector3(0f, 0.01f, 0f),
                new Vector3(1.1f, 0.005f, 1.1f), Quaternion.identity, new Color(1f, 0.85f, 0.1f));

            var numberGo = new GameObject("Number");
            numberGo.transform.SetParent(transform, false);
            numberGo.transform.localPosition = new Vector3(0f, 0.85f, 0f);
            _number = numberGo.AddComponent<TextMesh>();
            _number.text = player.Number.ToString();
            _number.characterSize = 0.07f;
            _number.fontSize = 48;
            _number.anchor = TextAnchor.MiddleCenter;
            _number.alignment = TextAlignment.Center;
            _number.color = Color.white;
            _number.font = UiFactory.DefaultFont;
            numberGo.GetComponent<MeshRenderer>().sharedMaterial = _number.font.material;
        }

        private void LateUpdate()
        {
            Vector3 pos = _runner.GetPlayerPosition(_player.Id);
            Vector3 vel = new Vector3(_player.Velocity.X, 0f, _player.Velocity.Z);
            float speed = vel.magnitude;

            // Bobbing gets stronger with speed (stroke rhythm); a goalkeeper or a charging shooter rises.
            _phase += Time.deltaTime * (2f + speed * 3f);
            float bob = Mathf.Sin(_phase) * (0.02f + speed * 0.02f);
            float rise = _player.IsChargingShot ? 0.18f * _player.ShotCharge : 0f;
            if (_player.IsGoalkeeper) rise += 0.08f;
            if (_player.BlockTimer > 0f) rise += 0.12f;
            transform.position = new Vector3(pos.x, bob + rise, pos.z);

            Vector3 facing = new Vector3(_player.Facing.X, 0f, _player.Facing.Z);
            if (facing.sqrMagnitude > 0.001f)
            {
                Quaternion look = Quaternion.LookRotation(facing, Vector3.up);
                float lean = Mathf.Clamp(speed * 12f, 0f, 30f); // swimmers lie forward when swimming fast
                _body.rotation = look * Quaternion.Euler(lean, 0f, 0f);
            }

            bool armUp = _player.IsChargingShot || _player.BlockTimer > 0f || _runner.Sim.Ball.Owner == _player;
            float armAngle = armUp ? (_player.IsChargingShot ? -30f - 40f * _player.ShotCharge : 0f) : 100f;
            _arm.localRotation = Quaternion.Slerp(_arm.localRotation, Quaternion.Euler(armAngle, 0f, 0f), Time.deltaTime * 14f);

            _selection.SetActive(_player.IsHumanControlled);

            var cam = Camera.main;
            if (cam != null) _number.transform.rotation = cam.transform.rotation;
        }
    }

    public sealed class BallView : MonoBehaviour
    {
        private MatchRunner _runner;
        private Transform _shadow;

        public static BallView Create(MatchRunner runner, Transform parent)
        {
            var go = PoolBuilder.Primitive(PrimitiveType.Sphere, parent, "Ball", Vector3.zero,
                Vector3.one * (SimBall.Radius * 2f), Quaternion.identity, new Color(1f, 0.85f, 0.05f), 0.5f);
            var view = go.AddComponent<BallView>();
            view._runner = runner;
            view._shadow = PoolBuilder.Primitive(PrimitiveType.Cylinder, parent, "BallShadow", Vector3.zero,
                new Vector3(0.25f, 0.002f, 0.25f), Quaternion.identity, new Color(0.02f, 0.2f, 0.3f)).transform;
            return view;
        }

        private void LateUpdate()
        {
            Vector3 p = _runner.GetBallPosition();
            transform.position = p;
            transform.Rotate(new Vector3(_runner.Sim.Ball.Velocity.Z, 0f, -_runner.Sim.Ball.Velocity.X) * (Time.deltaTime * 400f), Space.World);
            _shadow.position = new Vector3(p.x, 0.005f, p.z);
            float h = Mathf.Clamp01(p.y / 3f);
            _shadow.localScale = new Vector3(0.25f + h * 0.2f, 0.002f, 0.25f + h * 0.2f);
        }
    }

    /// <summary>Ring under the team-mate who would receive an automatic pass right now.</summary>
    public sealed class PassTargetIndicator : MonoBehaviour
    {
        private MatchRunner _runner;
        private HumanInputController _input;
        private GameObject _ring;

        public static PassTargetIndicator Create(MatchRunner runner, HumanInputController input, Transform parent)
        {
            var go = new GameObject("PassTargetIndicator");
            go.transform.SetParent(parent, false);
            var ind = go.AddComponent<PassTargetIndicator>();
            ind._runner = runner;
            ind._input = input;
            ind._ring = PoolBuilder.Primitive(PrimitiveType.Cylinder, go.transform, "Ring", Vector3.zero,
                new Vector3(0.9f, 0.004f, 0.9f), Quaternion.identity, new Color(0.3f, 1f, 0.45f));
            return ind;
        }

        private void LateUpdate()
        {
            var sim = _runner.Sim;
            var me = sim?.HumanPlayer;
            if (me == null || sim.Ball.Owner != me)
            {
                _ring.SetActive(false);
                return;
            }

            // Read-only query: no randomness involved, the simulation is not affected.
            var team = sim.Teams[me.TeamIndex];
            var target = PassSystem.ChooseTarget(sim, me, _input.CurrentWorldMove, sim.Config.Assist, me.Profile.PassRisk,
                team.TacticParams.CenterFeedBonus);
            _ring.SetActive(target != null);
            if (target != null)
            {
                Vector3 p = _runner.GetPlayerPosition(target.Id);
                _ring.transform.position = new Vector3(p.x, 0.012f, p.z);
            }
        }
    }
}
