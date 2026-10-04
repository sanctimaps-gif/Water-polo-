using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum BallState
    {
        Free,
        Possessed,
        Passed,
        Shot,
        Deflected,
        Blocked,
        Goal,
        Out,
    }

    /// <summary>Runtime state of the ball.</summary>
    public sealed class SimBall
    {
        /// <summary>Size 5 ball: ~0.69 m circumference.</summary>
        public const float Radius = 0.11f;
        public const float HoldHeight = 0.45f;

        public Vec3 Position;
        public Vec3 Velocity;
        public BallState State = BallState.Free;

        public SimPlayer Owner;
        public SimPlayer LastTouch;
        /// <summary>Last player of the given team that had possession (for assists/stats).</summary>
        public SimPlayer Passer;
        public SimPlayer IntendedReceiver;
        public SimPlayer Shooter;
        /// <summary>Team that last had possession (kept while the ball is in flight).</summary>
        public int PossessionTeam = -1;
        /// <summary>Time since the ball left the hand (pass/shot) or changed state.</summary>
        public float StateTime;
        /// <summary>The goalkeeper has already tried a save on the current shot.</summary>
        public bool SaveResolved;
        /// <summary>Bitmask of player ids that already tried to intercept the current flight.</summary>
        public ulong InterceptTried;

        public bool InFlight => State == BallState.Passed || State == BallState.Shot ||
                                State == BallState.Deflected || State == BallState.Blocked;

        public bool IsLoose => State == BallState.Free || State == BallState.Deflected || State == BallState.Blocked;

        public void SetState(BallState state)
        {
            State = state;
            StateTime = 0f;
            InterceptTried = 0;
            if (state != BallState.Shot) SaveResolved = false;
        }

        public void GiveTo(SimPlayer player)
        {
            Owner = player;
            LastTouch = player;
            PossessionTeam = player.TeamIndex;
            IntendedReceiver = null;
            Velocity = Vec3.Zero;
            SetState(BallState.Possessed);
            SnapToOwner();
        }

        public void Release(BallState state, Vec3 velocity)
        {
            if (Owner != null)
            {
                LastTouch = Owner;
                Owner.PossessionTime = 0f;
            }
            Owner = null;
            Velocity = velocity;
            SetState(state);
        }

        public void SnapToOwner()
        {
            if (Owner == null) return;
            Position = Owner.Position + Owner.Facing * 0.35f + Vec3.Up * HoldHeight;
        }
    }
}
