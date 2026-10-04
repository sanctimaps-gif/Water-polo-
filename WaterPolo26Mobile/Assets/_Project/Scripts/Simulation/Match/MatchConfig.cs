using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>Match settings and pool geometry. Defaults follow the field-of-play rules (25 x 20 m, 3 x 0.9 m goals).</summary>
    public sealed class MatchConfig
    {
        // ---- Pool geometry (metres) ----
        public float PoolLength = 25f;
        public float PoolWidth = 20f;
        public float GoalWidth = 3f;
        /// <summary>Crossbar height above the water surface.</summary>
        public float GoalHeight = 0.9f;
        public float GoalDepth = 0.4f;

        // ---- Time ----
        /// <summary>Running-clock duration of one period in seconds (prototype default: short session-friendly periods).</summary>
        public float PeriodDuration = 120f;
        public int Periods = 4;
        public float ShotClock = 30f;
        /// <summary>Shot clock after an offensive rebound (shot hit the goal/GK and the attack kept the ball).</summary>
        public float ShotClockRebound = 20f;
        public float GoalPauseDuration = 3f;
        public float DeadBallPauseDuration = 1.2f;
        public float PeriodBreakDuration = 3f;
        public float FixedDeltaTime = 1f / 50f;

        // ---- Gameplay options ----
        public int Seed = 12345;
        /// <summary>Index of the human-controlled team, or -1 for AI vs AI.</summary>
        public int HumanTeam = 0;
        public AssistLevel Assist = AssistLevel.Standard;
        public bool ShotTimingEnabled = true;
        /// <summary>Global AI skill multiplier for the CPU team (0.7 easy .. 1.15 hard).</summary>
        public float CpuDifficulty = 1f;

        public float HalfLength => PoolLength * 0.5f;
        public float HalfWidth => PoolWidth * 0.5f;

        /// <summary>Centre of the goal that team <paramref name="team"/> DEFENDS. Team 0 defends -X, team 1 defends +X.</summary>
        public Vec3 OwnGoalCenter(int team) => new Vec3(team == 0 ? -HalfLength : HalfLength, 0f, 0f);

        /// <summary>Centre of the goal that team <paramref name="team"/> ATTACKS.</summary>
        public Vec3 TargetGoalCenter(int team) => OwnGoalCenter(1 - team);

        /// <summary>+1 if the team attacks toward +X, -1 otherwise.</summary>
        public float AttackSign(int team) => team == 0 ? 1f : -1f;
    }
}
