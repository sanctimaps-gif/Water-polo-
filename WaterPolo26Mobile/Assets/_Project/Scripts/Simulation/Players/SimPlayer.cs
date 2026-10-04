using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>Runtime state of one player in a match (engine independent).</summary>
    public sealed class SimPlayer
    {
        public int Id;
        public int TeamIndex;
        public int Number;
        public string Name;
        public PlayerRole Role;
        public Personality Personality;
        public PersonalityProfile Profile;
        public PlayerStats Stats;
        /// <summary>Formation slot 0..5 for field players, -1 for the goalkeeper.</summary>
        public int Slot;

        public Vec3 Position;
        public Vec3 Velocity;
        /// <summary>Flat unit vector the player is facing.</summary>
        public Vec3 Facing = Vec3.Right;

        /// <summary>0 = exhausted, 1 = fresh.</summary>
        public float Stamina = 1f;
        public bool IsSprinting;
        /// <summary>Sprint locked after exhaustion until stamina recovers (hysteresis).</summary>
        public bool SprintLocked;

        public bool IsHumanControlled;
        public PlayerCommand Command;

        // Action state
        public float ShotCharge;
        public bool IsChargingShot;
        public float ShotChargeHeldAtMax;
        public float ActionCooldown;
        public float StealCooldown;
        public float StunTimer;
        /// <summary>Time left with the arm raised to block a shot.</summary>
        public float BlockTimer;
        public float PossessionTime;

        // AI scratch state
        public float NextDecisionTime;
        public Vec3 AiTarget;
        public bool AiWantsSprint;
        public float AiShotTargetCharge = -1f;

        public bool IsGoalkeeper => Role == PlayerRole.Goalkeeper;

        // ---------------- fatigue-aware effective values ----------------

        /// <summary>Multiplier in [0.75, 1] applied to speed when tired.</summary>
        public float FatigueSpeedFactor => FMath.Lerp(0.75f, 1f, Stamina);
        /// <summary>Multiplier in [0.8, 1] applied to precision when tired.</summary>
        public float FatigueSkillFactor => FMath.Lerp(0.8f, 1f, Stamina);

        public float EffectiveAccuracy => PlayerStats.N(Stats.Accuracy) * FatigueSkillFactor;
        public float EffectiveShooting => PlayerStats.N(Stats.Shooting) * FatigueSkillFactor;
        public float EffectivePassing => PlayerStats.N(Stats.Passing) * FatigueSkillFactor;
        public float EffectivePower => PlayerStats.N(Stats.Power) * FMath.Lerp(0.85f, 1f, Stamina);
        public float EffectiveDefense => PlayerStats.N(Stats.Defense) * FatigueSkillFactor;

        /// <summary>Reaction delay in seconds (lower is better).</summary>
        public float ReactionTime => FMath.Lerp(0.42f, 0.12f, PlayerStats.N(Stats.Reaction)) / FMath.Lerp(0.8f, 1f, Stamina);

        public override string ToString() => $"#{Number} {Name} (T{TeamIndex} {Role})";
    }
}
