using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum MatchEventType
    {
        PeriodStart,
        SwimOff,
        PossessionWon,
        PassMade,
        PassCompleted,
        PassIntercepted,
        ShotTaken,
        ShotSaved,
        ShotBlocked,
        ShotOffFrame,
        ShotHitFrame,
        Goal,
        Steal,
        Foul,
        BallOut,
        ShotClockViolation,
        Restart,
        PeriodEnd,
        MatchEnd,
        HumanPlayerSwitched,
        TacticChanged,
    }

    /// <summary>Something that happened during a tick. Consumed by HUD, camera, audio, crowd, stats, analytics.</summary>
    public struct MatchEvent
    {
        public MatchEventType Type;
        public float Time;
        public int Team;
        /// <summary>Main player id or -1.</summary>
        public int PlayerId;
        /// <summary>Secondary player id (receiver, goalkeeper, victim...) or -1.</summary>
        public int OtherPlayerId;
        public Vec3 Position;
        /// <summary>Free value (shot speed, charge, timing quality as int...).</summary>
        public float Value;

        public override string ToString() => $"[{Time:0.0}s] {Type} team={Team} p={PlayerId} o={OtherPlayerId} v={Value:0.00}";
    }
}
