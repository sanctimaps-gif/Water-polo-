using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum AssistLevel
    {
        /// <summary>Strong help: auto target, auto aim inside the goal, wider catch radius.</summary>
        Assisted,
        /// <summary>Moderate help: direction biases the target choice.</summary>
        Standard,
        /// <summary>Precise control: passes follow the direction, shots can miss the frame.</summary>
        Pro,
    }

    /// <summary>
    /// One tick of intent for one player. Produced by touch input (human) or by the AI.
    /// The simulation only consumes commands, which keeps input, AI and (later) network
    /// replication interchangeable.
    /// </summary>
    public struct PlayerCommand
    {
        /// <summary>World-space flat move direction, magnitude 0..1.</summary>
        public Vec3 Move;
        public bool Sprint;

        /// <summary>Pass requested this tick.</summary>
        public bool Pass;
        /// <summary>Optional pass direction (swipe / joystick). Zero = fully automatic target.</summary>
        public Vec3 PassDirection;
        public bool LobPass;

        /// <summary>Shot button is held (charging).</summary>
        public bool ShootHeld;
        /// <summary>Shot button released this tick: the shot is taken.</summary>
        public bool ShootReleased;
        /// <summary>Instant shot with a fixed low charge (fast swipe).</summary>
        public bool QuickShot;
        public bool LobShot;
        /// <summary>Optional aim inside the goal: X = lateral (-1 left .. 1 right as seen by the shooter), Y = height (0 low .. 1 high).</summary>
        public float AimX;
        public float AimY;
        public bool HasAim;

        /// <summary>Defensive action: steal attempt near the carrier / raised arm to block.</summary>
        public bool Defend;

        public static PlayerCommand Idle => new PlayerCommand();
    }
}
